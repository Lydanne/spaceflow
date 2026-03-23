import { cancelFlow } from "~~/server/services/approval-flow/service";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const flowId = getRouterParam(event, "flowId");

  if (!flowId) {
    throw createError({ statusCode: 400, message: "Missing flowId" });
  }

  const flow = await cancelFlow(event, flowId, session.user.id);

  return flow;
});
