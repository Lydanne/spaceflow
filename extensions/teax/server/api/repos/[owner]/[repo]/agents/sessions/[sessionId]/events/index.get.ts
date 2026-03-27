import { listAgentSessionEventsQuerySchema } from "~~/server/shared/dto";
import { listAgentSessionEvents } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:read", repoId);
  const sessionId = getRouterParam(event, "sessionId");
  if (!sessionId) {
    throw createError({ statusCode: 400, message: "Missing session ID" });
  }
  const query = listAgentSessionEventsQuerySchema.parse(getQuery(event));

  return listAgentSessionEvents({
    repositoryId: repoId,
    sessionId,
    actor: {
      userId: session.user.id,
      isAdmin: !!session.user.is_admin,
    },
    page: query.page,
    limit: query.limit,
    afterSeq: query.after_seq,
  });
});
