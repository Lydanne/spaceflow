import { addAgentSessionParticipantBodySchema } from "~~/server/shared/dto";
import { addAgentSessionParticipant } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:manage", repoId);
  const sessionId = getRouterParam(event, "sessionId");
  if (!sessionId) {
    throw createError({ statusCode: 400, message: "Missing session ID" });
  }

  const body = await readValidatedBody(event, addAgentSessionParticipantBodySchema.parse);

  return addAgentSessionParticipant({
    repositoryId: repoId,
    sessionId,
    actor: {
      userId: session.user.id,
      isAdmin: !!session.user.is_admin,
    },
    userId: body.user_id,
    role: body.role,
    canChat: body.can_chat,
  });
});
