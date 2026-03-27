import { requireAuth } from "~~/server/utils/auth";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";
import { dispatchAndPoll } from "~~/server/utils/workflow-trigger";
import { buildRunConfig, persistPresetTriggerResult } from "~~/server/services/preset-run.service";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 读取用户提交的覆盖参数
  const body = (await readBody(event).catch(() => ({}))) as {
    branch?: unknown;
    inputs?: Record<string, unknown>;
  };
  const { finalInputs, finalBranch } = buildRunConfig({
    preset,
    actorId: session.user.id,
    branchOverride: body.branch,
    inputOverrides: body.inputs,
  });

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

  let newRunId: number | null = null;
  let newRunNumber: number | null = null;
  try {
    const workflowFile = preset.workflow_path.split("/").pop() || preset.workflow_path;
    const result = await dispatchAndPoll(gitea, {
      owner,
      repo: repoName,
      workflowFileName: workflowFile,
      branch: finalBranch,
      inputs: finalInputs as Record<string, string | number | boolean>,
    });
    newRunId = result.runId;
    newRunNumber = result.runNumber;
  } catch (err: unknown) {
    console.error("[dispatchWorkflow] Error:", err);
    const errObj = err as { data?: { message?: string }; message?: string };
    const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
    throw createError({ statusCode: 502, message: msg });
  }

  const { lock_info: lockInfo } = await persistPresetTriggerResult({
    preset,
    actorId: session.user.id,
    runId: newRunId,
    runNumber: newRunNumber,
    branch: finalBranch,
    inputs: finalInputs,
  });

  return {
    success: true,
    message: "工作流已触发",
    run_id: newRunId,
    run_number: newRunNumber,
    lock_info: lockInfo,
  };
});
