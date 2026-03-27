import { stopRepoRuntimeBodySchema } from "~~/server/shared/dto";
import { getRepoRuntimeSummary, stopRepoRuntime } from "~~/server/services/agent-runtime.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:stop", repoId);
  const body = await readValidatedBody(event, stopRepoRuntimeBodySchema.parse);

  const stopped = await stopRepoRuntime({
    repositoryId: repoId,
    actorId: session.user.id,
    force: body.force,
  });

  const summary = await getRepoRuntimeSummary({
    repositoryId: repoId,
  });

  return {
    ...stopped,
    summary,
  };
});
