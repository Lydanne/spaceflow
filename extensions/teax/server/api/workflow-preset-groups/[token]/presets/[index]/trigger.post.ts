import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { buildTriggerLockRefresh, recordTriggerHistory } from "~~/server/services/preset-lock.service";
import { presetWorkflowQueue } from "~~/server/queue-services/preset-workflow";

/**
 * 触发子预设的 CI
 *
 * queue_enabled=true 时：
 *   统一走 enqueueAndTrigger → consumer(dispatchAndPoll) → complete → triggerNext
 *   空闲时立即执行，忙碌时排队等待，形成完整闭环。
 *
 * queue_enabled=false 时：
 *   直接调用 gitea.dispatchWorkflow（原有逻辑）。
 *   如果当前 preset 有 CI 运行中则返回 409。
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const token = getRouterParam(event, "token");
  const indexStr = getRouterParam(event, "index");

  if (!token || !indexStr) {
    throw createError({ statusCode: 400, message: "Missing parameters" });
  }

  const presetIndex = parseInt(indexStr, 10);
  if (isNaN(presetIndex)) {
    throw createError({ statusCode: 400, message: "Invalid preset index" });
  }

  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({
      id: schema.workflowPresetGroups.id,
      workflow_path: schema.workflowPresetGroups.workflow_path,
      repository_id: schema.workflowPresetGroups.repository_id,
      auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes,
      queue_enabled: schema.workflowPresetGroups.queue_enabled,
    })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  // 获取子预设
  const [preset] = await db
    .select()
    .from(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.group_id, group.id),
        eq(schema.workflowPresets.preset_index, presetIndex),
      ),
    );

  if (!preset) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  const branch = preset.branch;
  const inputs = (preset.inputs || {}) as Record<string, string | boolean | number>;

  // ─── 队列模式：统一走 enqueueAndTrigger ─────────────────
  if (group.queue_enabled) {
    const queue = await presetWorkflowQueue.findOrCreate(
      [group.repository_id, group.workflow_path],
      { name: `Workflow: ${group.workflow_path}`, createdBy: session.user.id },
    );

    const result = await presetWorkflowQueue.enqueueAndTrigger(
      queue.id,
      {
        preset_id: preset.id,
        group_id: group.id,
        queued_by: session.user.id,
        branch,
        inputs,
      },
      session.user.id,
    );

    // 记录入队/触发历史（锁更新由 consumer 内 persistPresetTriggerResult 统一处理）
    await recordTriggerHistory(preset.id, session.user.id, {
      run_id: null,
      run_number: null,
      branch,
      inputs,
      ...(result.triggered ? {} : { queued: true, position: result.position }),
    } as Parameters<typeof recordTriggerHistory>[2]);

    if (result.triggered) {
      return {
        success: true,
        queued: false,
        message: "Workflow dispatched via queue",
      };
    }

    return {
      success: true,
      queued: true,
      queue_item_id: result.itemId,
      position: result.position,
      message: `已加入排队队列，当前排队位置: ${result.position}`,
    };
  }

  // ─── 非队列模式：直接触发 ──────────────────────────────
  if (preset.current_run_id) {
    throw createError({ statusCode: 409, message: "A CI run is already in progress" });
  }

  // 获取仓库信息
  const [repo] = await db
    .select({
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, group.repository_id));

  if (!repo) {
    throw createError({ statusCode: 404, message: "Repository not found" });
  }

  const parts = repo.full_name.split("/");
  const owner = parts[0] || "";
  const repoName = parts[1] || "";

  if (!owner || !repoName) {
    throw createError({ statusCode: 500, message: "Invalid repository full_name" });
  }

  const gitea = await useGiteaSdk(event).role("user");

  try {
    await gitea.dispatchWorkflow(
      owner,
      repoName,
      group.workflow_path,
      branch,
      inputs,
    );

    await db.transaction(async (tx) => {
      const lockRefresh = buildTriggerLockRefresh({
        currentLockedBy: preset.locked_by,
        actorId: session.user.id,
        autoUnlockMinutes: group.auto_unlock_minutes,
      });

      await tx
        .update(schema.workflowPresets)
        .set({
          last_triggered_by: session.user.id,
          locked_by: lockRefresh.lockOwner,
          locked_at: lockRefresh.lockedAt,
          auto_unlock_at: lockRefresh.autoUnlockAt,
        })
        .where(eq(schema.workflowPresets.id, preset.id));

      await tx.insert(schema.workflowPresetHistory).values({
        preset_id: preset.id,
        action: "trigger",
        actor_id: session.user.id,
        details: { branch, inputs },
      });
    });

    return {
      success: true,
      queued: false,
      message: "Workflow dispatched successfully",
    };
  } catch (error) {
    console.error("[trigger] Failed to trigger workflow:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to trigger workflow: ${(error as Error).message}`,
    });
  }
});
