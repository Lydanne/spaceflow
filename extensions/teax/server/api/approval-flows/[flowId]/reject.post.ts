import { rejectFlow } from "~~/server/services/approval-flow/service";
import { approvalActionBodySchema } from "~~/server/shared/dto/approval-flow.dto";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const flowId = getRouterParam(event, "flowId");
  const body = await readValidatedBody(event, approvalActionBodySchema.parse);

  if (!flowId) {
    throw createError({ statusCode: 400, message: "Missing flowId" });
  }

  const flow = await rejectFlow(event, flowId, session.user.id, body.comment);

  return flow;
});
