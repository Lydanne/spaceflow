import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  const runId = Number(getRouterParam(event, "runId"));
  if (!runId || isNaN(runId)) {
    throw createError({ statusCode: 400, message: "Invalid run ID" });
  }

  const gitea = await createServiceGiteaClient();

  try {
    await gitea.rerunWorkflowRun(owner, repo, runId);
    return { success: true };
  } catch {
    throw createError({ statusCode: 500, message: "Failed to rerun workflow run" });
  }
});
