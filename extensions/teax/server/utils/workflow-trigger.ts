import type { GiteaService } from "./gitea";
import { EnhancedCardBuilder } from "../card-kit/builder";
import type { CardJSON } from "../card-kit/types";

// ─── dispatch + poll ──────────────────────────

export interface DispatchAndPollOptions {
  owner: string;
  repo: string;
  workflowFileName: string;
  branch: string;
  inputs?: Record<string, string | number | boolean>;
}

export interface DispatchAndPollResult {
  runId: number | null;
  runNumber: number | null;
}

/**
 * 触发工作流并轮询等待新的 Run 出现。
 * @returns `{ runId, runNumber }` — 如果轮询到新 Run，runId 非 null；否则为 null（表示已提交但未检测到）。
 * @throws dispatch 失败时抛出原始错误。
 */
export async function dispatchAndPoll(
  gitea: GiteaService,
  opts: DispatchAndPollOptions,
): Promise<DispatchAndPollResult> {
  const { owner, repo, workflowFileName, branch, inputs } = opts;

  // 记录当前最新 run id（用于轮询比较）
  let latestRunId = 0;
  try {
    const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
    const latestRun = runs.workflow_runs?.find((run) => run.path?.includes(workflowFileName));
    if (latestRun) {
      latestRunId = latestRun.id;
    }
  } catch {
    // Ignore
  }

  // Dispatch
  await gitea.dispatchWorkflow(owner, repo, workflowFileName, branch, inputs);

  // Poll for new run
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
      const newRun = runs.workflow_runs?.find((run) => {
        return run.path?.includes(workflowFileName) && run.id > latestRunId;
      });
      if (newRun) {
        return { runId: newRun.id, runNumber: newRun.run_number };
      }
    } catch {
      // Continue polling
    }
  }

  return { runId: null, runNumber: null };
}

// ─── 错误卡片 ──────────────────────────

/**
 * 从 dispatch 错误中提取信息并构建失败卡片。
 */
export function buildDispatchErrorCard(err: unknown): CardJSON {
  const errObj = err as { data?: { message?: string }; message?: string };
  const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
  return new EnhancedCardBuilder({ title: "❌ 触发失败", theme: "red" }, "")
    .text(msg, true)
    .build();
}

// ─── 结果卡片 ──────────────────────────

export interface TriggerResultCardOptions {
  repoFullName: string;
  branch: string;
  workflowPath: string;
  runId: number | null;
  runNumber: number | null;
  /** 追加到结果卡片末尾的额外行 */
  extraLines?: string[];
}

/**
 * 构建触发结果卡片。
 */
export function buildTriggerResultCard(opts: TriggerResultCardOptions): CardJSON {
  const { repoFullName, branch, workflowPath, runId, runNumber, extraLines } = opts;
  const config = useRuntimeConfig();
  const baseUrl = config.public.appUrl as string;

  const resultCard = new EnhancedCardBuilder(
    {
      title: runId ? "✅ 工作流已触发" : "⚠️ 工作流已提交",
      theme: runId ? "green" : "orange",
    },
    "",
  );

  const lines = [
    `**仓库**: ${repoFullName}`,
    `**分支**: ${branch}`,
    `**工作流**: ${workflowPath}`,
  ];

  if (runId) {
    lines.push(`**运行编号**: #${runNumber}`);
    lines.push(`[查看运行详情](${baseUrl}/${repoFullName}/actions/runs/${runId})`);
  }

  if (extraLines?.length) {
    lines.push(...extraLines);
  }

  resultCard.text(lines.join("\n"), true);
  return resultCard.build();
}
