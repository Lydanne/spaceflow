import { paginationQuerySchema } from "~~/server/shared/dto/common.dto";
import { listAgentSessions } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:read", repoId);
  const query = paginationQuerySchema.parse(getQuery(event));

  return listAgentSessions({
    repositoryId: repoId,
    actor: {
      userId: session.user.id,
      isAdmin: !!session.user.is_admin,
    },
    page: query.page,
    limit: query.limit,
  });
});
