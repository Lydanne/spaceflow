import { ensureRepoRuntime, getRepoRuntimeSummary } from "~~/server/services/agent-runtime.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:start", repoId);

  await ensureRepoRuntime({
    repositoryId: repoId,
    actorId: session.user.id,
  });

  return getRepoRuntimeSummary({
    repositoryId: repoId,
  });
});
