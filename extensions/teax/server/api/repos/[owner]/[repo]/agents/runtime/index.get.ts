import { getRepoRuntimeSummary } from "~~/server/services/agent-runtime.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "agent:read", repoId);

  return getRepoRuntimeSummary({
    repositoryId: repoId,
  });
});
