import { requireAuth } from "~~/server/utils/auth";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";
import { runWorkflowWithPreset } from "~~/server/services/workflow-run.service";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 读取用户提交的覆盖参数
  const body = (await readBody(event).catch(() => ({}))) as {
    branch?: unknown;
    inputs?: Record<string, unknown>;
  };

  // 检查权限
  await requirePermission(event, repo.organization_id, "actions:trigger", repo.id);

  const gitea = await useGiteaSdk(event).role("user");
  let runResult: Awaited<ReturnType<typeof runWorkflowWithPreset>>;
  try {
    runResult = await runWorkflowWithPreset({
      preset,
      owner,
      repoName,
      actorId: session.user.id,
      gitea,
      branchOverride: body.branch,
      inputOverrides: body.inputs,
      allowSyncToPreset: false,
    });
  } catch (err: unknown) {
    console.error("[dispatchWorkflow] Error:", err);
    if ((err as { statusCode?: number })?.statusCode === 409) {
      throw err;
    }
    const errObj = err as { data?: { message?: string }; message?: string };
    const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
    throw createError({ statusCode: 502, message: msg });
  }

  return {
    success: true,
    message: runResult.queued
      ? `已加入排队队列，当前排队位置: ${runResult.position}`
      : "工作流已触发",
    run_id: runResult.runId,
    run_number: runResult.runNumber,
    lock_info: runResult.lockInfo,
    queued: runResult.queued ?? false,
    position: runResult.position,
  };
});
