import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import type { WorkflowRunDetail } from "~~/server/shared/dto";

export default defineEventHandler(async (event): Promise<WorkflowRunDetail> => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const runId = Number(getRouterParam(event, "runId"));
  if (!runId || isNaN(runId)) {
    throw createError({ statusCode: 400, message: "Invalid run ID" });
  }

  const gitea = await useGiteaSdk(event).role("user");
  const run = await gitea.getWorkflowRun(owner, repo, runId);

  return {
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
    workflow_id: run.workflow_id,
    actor: run.actor ? { login: run.actor.login, avatar_url: run.actor.avatar_url } : null,
  };
});
