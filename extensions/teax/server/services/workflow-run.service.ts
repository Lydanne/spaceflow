import type { GiteaService } from "~~/server/utils/gitea";
import { dispatchAndPoll } from "~~/server/utils/workflow-trigger";
import type { ResolvedPreset } from "~~/server/utils/resolve-preset";
import {
  buildRunConfig,
  persistPresetTriggerResult,
} from "./preset-run.service";

export interface RunWorkflowWithPresetParams {
  preset: ResolvedPreset["preset"];
  owner: string;
  repoName: string;
  actorId: string;
  gitea: GiteaService;
  branchOverride?: unknown;
  inputOverrides?: Record<string, unknown>;
  allowSyncToPreset?: boolean;
}

export interface RunWorkflowWithPresetResult {
  finalBranch: string;
  finalInputs: Record<string, unknown>;
  canModifyOverride: boolean;
  runId: number | null;
  runNumber: number | null;
  lockInfo: {
    locked_by: string;
    locked_at: string;
    auto_unlock_at: string | null;
  } | null;
}

/**
 * 统一执行预设工作流：
 * 1) 合并最终运行参数
 * 2) 检查运行中状态
 * 3) dispatch + poll
 * 4) 持久化 run 与锁定/历史
 */
export async function runWorkflowWithPreset(
  params: RunWorkflowWithPresetParams,
): Promise<RunWorkflowWithPresetResult> {
  const {
    preset,
    owner,
    repoName,
    actorId,
    gitea,
    branchOverride,
    inputOverrides,
    allowSyncToPreset = false,
  } = params;

  const { finalInputs, finalBranch, canModifyOverride } = buildRunConfig({
    preset,
    actorId,
    branchOverride,
    inputOverrides,
  });

  if (preset.current_run_id) {
    try {
      const currentRun = await gitea.getWorkflowRun(owner, repoName, preset.current_run_id);
      const isRunning = [
        "running",
        "waiting",
        "queued",
        "in_progress",
      ].includes(currentRun?.status || "");
      if (isRunning) {
        throw createError({
          statusCode: 409,
          message: "当前有一个正在运行的工作流，请等待完成后再试",
          data: { run_id: currentRun.id, run_number: currentRun.run_number },
        });
      }
    } catch (err: unknown) {
      if ((err as { statusCode?: number })?.statusCode === 409) {
        throw err;
      }
      // 其他错误忽略（可能是 run 已被删除）
    }
  }

  const workflowFileName = preset.workflow_path.split("/").pop() || preset.workflow_path;
  const runResult = await dispatchAndPoll(gitea, {
    owner,
    repo: repoName,
    workflowFileName,
    branch: finalBranch,
    inputs: finalInputs as Record<string, string | number | boolean>,
  });

  const persistInputs: Record<string, unknown> = { ...finalInputs };
  const persistedBranch = allowSyncToPreset
    && preset.allow_sync_override
    && canModifyOverride
    && preset.allow_branch_override
    ? finalBranch
    : preset.branch;
  const persistedInputs = allowSyncToPreset
    && preset.allow_sync_override
    && canModifyOverride
    && preset.allow_input_override
    ? (persistInputs as Record<string, string | boolean | number>)
    : preset.inputs;

  const persistResult = await persistPresetTriggerResult({
    preset: {
      ...preset,
      branch: persistedBranch,
      inputs: persistedInputs,
    },
    actorId,
    runId: runResult.runId,
    runNumber: runResult.runNumber,
    branch: finalBranch,
    inputs: persistInputs,
    syncBranchToPreset: persistedBranch !== preset.branch ? persistedBranch : undefined,
    syncInputsToPreset: persistedInputs !== preset.inputs ? persistInputs : undefined,
  });

  return {
    finalBranch,
    finalInputs,
    canModifyOverride,
    runId: runResult.runId,
    runNumber: runResult.runNumber,
    lockInfo: persistResult.lock_info,
  };
}
