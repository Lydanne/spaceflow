import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";
import {
  buildTriggerLockRefresh,
  recordAutoLockHistory,
  recordTriggerHistory,
} from "~~/server/services/preset-lock.service";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 读取用户提交的覆盖参数
  const body = await readBody(event).catch(() => ({}));
  const finalInputs: Record<string, string | number | boolean> = { ...(preset.inputs || {}) };
  let finalBranch = preset.branch;
  const isLockedByOther = !!(
    preset.group_id
    && preset.locked_by
    && preset.locked_by !== session.user.id
  );
  const canModifyOverride = !isLockedByOther;
  const lockedInputs = new Set<string>(preset.locked_inputs || []);

  // 参数覆盖：受 allow_input_override 总开关控制；锁定字段不可改
  if (canModifyOverride && preset.allow_input_override && body?.inputs && typeof body.inputs === "object") {
    for (const [key, value] of Object.entries(body.inputs as Record<string, unknown>)) {
      if (lockedInputs.has(key)) continue;
      finalInputs[key] = value as string | number | boolean;
    }
  }

  // 分支覆盖：遵循分支开关；被他人锁定时忽略用户提交
  if (canModifyOverride && preset.allow_branch_override && body?.branch) {
    finalBranch = body.branch;
  }

  // 检查权限
  await requirePermission(event, repo.organization_id, "actions:trigger", repo.id);

  const gitea = await useGiteaSdk(event).role("user");
  const workflowFileName = preset.workflow_path.replace(/^.*\//, "");

  // 检查 preset 是否已有运行中的工作流（全局互斥，不区分用户）
  console.log("[run.post] preset.current_run_id:", preset.current_run_id);
  if (preset.current_run_id) {
    try {
      const currentRun = await gitea.getWorkflowRun(owner, repoName, preset.current_run_id);
      const isRunning = currentRun?.status === "running" || currentRun?.status === "waiting" || currentRun?.status === "queued" || currentRun?.status === "in_progress";
      if (isRunning) {
        throw createError({
          statusCode: 409,
          message: "当前有一个正在运行的工作流，请等待完成后再试",
          data: { run_id: currentRun.id, run_number: currentRun.run_number },
        });
      }
      // 已完成，允许继续触发新的工作流（会覆盖 current_run_id）
    } catch (err: unknown) {
      if ((err as { statusCode?: number })?.statusCode === 409) {
        throw err;
      }
      // 其他错误忽略（可能是 run 已被删除）
    }
  }

  // 获取触发前的最新 run ID（用于后续比对）
  let latestRunId = 0;
  try {
    const runs = await gitea.getRepoWorkflowRuns(owner, repoName, 1, 5);
    const latestRun = runs.workflow_runs?.find((run) => run.path?.includes(workflowFileName));
    if (latestRun) {
      latestRunId = latestRun.id;
    }
  } catch {
    // 忽略错误
  }

  // 触发工作流 - Gitea API 需要文件名而非完整路径
  const workflowFile = preset.workflow_path.split("/").pop() || preset.workflow_path;
  try {
    await gitea.dispatchWorkflow(owner, repoName, workflowFile, finalBranch, finalInputs);
  } catch (err: unknown) {
    console.error("[dispatchWorkflow] Error:", err);
    const errObj = err as { data?: { message?: string }; message?: string; statusCode?: number };
    const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
    throw createError({ statusCode: 502, message: msg });
  }

  // 轮询获取新创建的 run ID（最多等待 10 秒）
  let newRunId: number | null = null;
  let newRunNumber: number | null = null;
  const maxAttempts = 10;
  const delay = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const runs = await gitea.getRepoWorkflowRuns(owner, repoName, 1, 5);
      const newRun = runs.workflow_runs?.find((run) => {
        const isSameWorkflow = run.path?.includes(workflowFileName);
        const isNewRun = run.id > latestRunId;
        return isSameWorkflow && isNewRun;
      });

      if (newRun) {
        newRunId = newRun.id;
        newRunNumber = newRun.run_number;
        break;
      }
    } catch {
      // 忽略错误，继续轮询
    }
  }

  // 保存 runId 到数据库；子预设每次触发都重算自动解锁时间
  const db = useDB();
  let lockInfo: { locked_by: string; locked_at: string; auto_unlock_at: string | null } | null = null;

  if (newRunId) {
    const updateData: Record<string, unknown> = {
      current_run_id: newRunId,
      last_triggered_by: session.user.id,
    };

    // 子预设每次触发都刷新锁定时间和自动解锁时间
    if (preset.group_id) {
      const [group] = await db
        .select({ auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes })
        .from(schema.workflowPresetGroups)
        .where(eq(schema.workflowPresetGroups.id, preset.group_id))
        .limit(1);
      const lockRefresh = buildTriggerLockRefresh({
        currentLockedBy: preset.locked_by,
        actorId: session.user.id,
        autoUnlockMinutes: group?.auto_unlock_minutes,
      });
      updateData.locked_by = lockRefresh.lockOwner;
      updateData.locked_at = lockRefresh.lockedAt;
      updateData.auto_unlock_at = lockRefresh.autoUnlockAt;
      lockInfo = lockRefresh.lockInfo;
    }

    await db
      .update(schema.workflowPresets)
      .set(updateData)
      .where(eq(schema.workflowPresets.id, preset.id));
    console.log("[run.post] Saved current_run_id:", newRunId, preset.group_id ? "(lock refreshed)" : "");

    // 写入历史记录（仅子预设）
    if (preset.group_id) {
      await recordTriggerHistory(preset.id, session.user.id, {
        run_id: newRunId,
        run_number: newRunNumber,
        branch: finalBranch,
        inputs: finalInputs,
      });

      // 如果自动锁定了，也记录锁定历史
      if (lockInfo) {
        await recordAutoLockHistory(preset.id, session.user.id, lockInfo.auto_unlock_at);
      }
    }
  } else {
    console.log("[run.post] No newRunId found after polling");
  }

  return {
    success: true,
    message: "工作流已触发",
    run_id: newRunId,
    run_number: newRunNumber,
    lock_info: lockInfo,
  };
});
