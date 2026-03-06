import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const runId = Number(getRouterParam(event, "runId"));
  if (!runId || isNaN(runId)) {
    throw createError({ statusCode: 400, message: "Invalid run ID" });
  }

  const gitea = await createServiceGiteaClient();
  const run = await gitea.getWorkflowRun(owner, repo, runId);

  return {
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
    workflowId: run.workflow_id,
    actor: run.actor ? { login: run.actor.login, avatar_url: run.actor.avatar_url } : null,
  };
});
