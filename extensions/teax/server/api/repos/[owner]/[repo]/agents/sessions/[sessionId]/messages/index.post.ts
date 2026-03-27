import { createAgentSessionMessageBodySchema } from "~~/server/shared/dto";
import { createAgentSessionMessage } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:chat", repoId);
  const sessionId = getRouterParam(event, "sessionId");
  if (!sessionId) {
    throw createError({ statusCode: 400, message: "Missing session ID" });
  }

  const body = await readValidatedBody(event, createAgentSessionMessageBodySchema.parse);

  return createAgentSessionMessage({
    repositoryId: repoId,
    sessionId,
    actor: {
      userId: session.user.id,
      isAdmin: !!session.user.is_admin,
    },
    content: body.content,
    metadata: body.metadata,
  });
});
