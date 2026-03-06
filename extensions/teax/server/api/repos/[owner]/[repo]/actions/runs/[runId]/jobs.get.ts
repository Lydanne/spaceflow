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
  const result = await gitea.getWorkflowRunJobs(owner, repo, runId);

  return {
    total: result.total_count,
    data: (result.jobs || []).map((job) => ({
      id: job.id,
      runId: job.run_id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      runnerName: job.runner_name || null,
      labels: job.labels || [],
      steps: (job.steps ?? []).map((step) => ({
        name: step.name,
        number: step.number,
        status: step.status,
        conclusion: step.conclusion,
        startedAt: step.started_at,
        completedAt: step.completed_at,
      })),
    })),
  };
});
