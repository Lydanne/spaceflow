import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { buildTriggerLockRefresh } from "~~/server/services/preset-lock.service";

/**
 * 触发子预设的 CI
 * - 锁定者：使用当前配置触发
 * - 非锁定者：也使用当前配置触发（不能修改）
 * - 如果有 CI 正在运行，不能触发新的
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

  // 检查是否有 CI 正在运行
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

  // 从 full_name 解析 owner
  const parts = repo.full_name.split("/");
  const owner = parts[0] || "";
  const repoName = parts[1] || "";

  if (!owner || !repoName) {
    throw createError({ statusCode: 500, message: "Invalid repository full_name" });
  }

  // 触发 Gitea Actions
  const gitea = await useGiteaSdk(event).role("user");
  const branch = preset.branch;
  const inputs = preset.inputs || {};

  try {
    // dispatchWorkflow 不返回 run_id，需要后续通过其他方式获取
    await gitea.dispatchWorkflow(
      owner,
      repoName,
      group.workflow_path,
      branch,
      inputs as Record<string, string | boolean | number>,
    );

    // 更新子预设状态（暂时不设置 current_run_id，因为 dispatch 不返回）
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

      // 记录历史
      await tx.insert(schema.workflowPresetHistory).values({
        preset_id: preset.id,
        action: "trigger",
        actor_id: session.user.id,
        details: {
          branch,
          inputs,
        },
      });
    });

    return {
      success: true,
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
