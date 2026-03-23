import { createApprovalFlow } from "~~/server/services/approval-flow/service";
import { createApprovalFlowBodySchema } from "~~/server/shared/dto/approval-flow.dto";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const body = await readValidatedBody(event, createApprovalFlowBodySchema.parse);

  const flow = await createApprovalFlow(event, {
    flowType: body.flow_type,
    organizationId: body.organization_id,
    requesterId: session.user.id,
    payload: body.payload,
    reason: body.reason,
  });

  return flow;
});
