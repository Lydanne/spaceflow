import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import type { JobsResponse, Job } from "~~/server/shared/dto";

export default defineEventHandler(async (event): Promise<JobsResponse> => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const runId = Number(getRouterParam(event, "runId"));
  if (!runId || isNaN(runId)) {
    throw createError({ statusCode: 400, message: "Invalid run ID" });
  }

  const gitea = await useGiteaSdk(event).role("user");
  const result = await gitea.getWorkflowRunJobs(owner, repo, runId);

  const jobs: Job[] = (result.jobs || []).map((job) => ({
    id: job.id,
    run_id: job.run_id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    started_at: job.started_at,
    completed_at: job.completed_at,
    runner_name: job.runner_name || null,
    labels: job.labels || [],
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      number: step.number,
      status: step.status,
      conclusion: step.conclusion,
      started_at: step.started_at,
      completed_at: step.completed_at,
    })),
  }));

  return { total_count: result.total_count, jobs };
});
