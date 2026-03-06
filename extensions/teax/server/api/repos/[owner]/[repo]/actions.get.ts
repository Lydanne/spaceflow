import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);
  const query = getQuery(event);
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;

  const gitea = await createServiceGiteaClient();

  try {
    const result = await gitea.getRepoWorkflowRuns(owner, repo, page, limit);
    return {
      total: result.total_count,
      data: (result.workflow_runs || []).map((run) => ({
        id: run.id,
        runNumber: run.run_number,
        displayTitle: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        headBranch: run.head_branch,
        headSha: run.head_sha,
        path: run.path,
        htmlUrl: run.html_url,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        actor: run.actor ? { login: run.actor.login, avatar_url: run.actor.avatar_url } : null,
      })),
    };
  } catch {
    // Gitea Actions 可能未启用
    return { total: 0, data: [] };
  }
});
