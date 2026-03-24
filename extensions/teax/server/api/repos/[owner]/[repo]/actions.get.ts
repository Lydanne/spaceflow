import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import type { WorkflowRunsResponse, WorkflowRun } from "~~/server/shared/dto";

export default defineEventHandler(async (event): Promise<WorkflowRunsResponse> => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);
  const query = getQuery(event);
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;

  const gitea = await useGiteaSdk(event).role("user");

  try {
    const result = await gitea.getRepoWorkflowRuns(owner, repo, page, limit);
    const workflow_runs: WorkflowRun[] = (result.workflow_runs || []).map((run) => ({
      id: run.id,
      run_number: run.run_number,
      display_title: run.display_title,
      status: run.status,
      conclusion: run.conclusion,
      event: run.event,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      path: run.path,
      html_url: run.html_url,
      started_at: run.started_at,
      completed_at: run.completed_at,
      actor: run.actor ? { login: run.actor.login, avatar_url: run.actor.avatar_url } : null,
    }));
    return { total_count: result.total_count, workflow_runs };
  } catch {
    // Gitea Actions 可能未启用
    return { total_count: 0, workflow_runs: [] };
  }
});
