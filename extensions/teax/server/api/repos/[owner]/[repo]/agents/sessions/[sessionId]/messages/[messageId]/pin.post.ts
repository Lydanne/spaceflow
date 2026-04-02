import { pinAgentSessionMessage } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:write", repoId);
  const sessionId = getRouterParam(event, "sessionId");
  const messageId = getRouterParam(event, "messageId");
  if (!sessionId || !messageId) {
    throw createError({ statusCode: 400, message: "Missing session ID or message ID" });
  }

  return pinAgentSessionMessage({
    repositoryId: repoId,
    sessionId,
    messageId,
    actor: {
      userId: session.user.id,
      isAdmin: !!session.user.is_admin,
    },
  });
});
