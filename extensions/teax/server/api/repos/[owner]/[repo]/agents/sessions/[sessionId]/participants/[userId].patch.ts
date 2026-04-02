import { updateAgentSessionParticipantBodySchema } from "~~/server/shared/dto";
import { updateAgentSessionParticipant } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:manage", repoId);
  const sessionId = getRouterParam(event, "sessionId");
  const userId = getRouterParam(event, "userId");
  if (!sessionId || !userId) {
    throw createError({ statusCode: 400, message: "Missing session ID or user ID" });
  }

  const body = await readValidatedBody(event, updateAgentSessionParticipantBodySchema.parse);

  return updateAgentSessionParticipant({
    repositoryId: repoId,
    sessionId,
    targetUserId: userId,
    actor: {
      userId: session.user.id,
      isAdmin: !!session.user.is_admin,
    },
    role: body.role,
    canChat: body.can_chat,
  });
});
