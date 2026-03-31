import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { approvalFlows } from "~~/server/db/schema/approval-flow";

export const selectApprovalFlowSchema = createSelectSchema(approvalFlows);
export type SelectApprovalFlow = z.infer<typeof selectApprovalFlowSchema>;

export const createApprovalFlowBodySchema = z.object({
  flow_type: z.string().min(1),
  organization_id: z.string().uuid().optional(),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
});

export const scenePermissionPayloadSchema = z.object({
  sceneName: z.string().min(1),
  permissions: z.array(z.string()).min(1),
  repositoryIds: z.array(z.string().uuid()).optional(),
  teamId: z.string().uuid(),
});

export const approvalActionBodySchema = z.object({
  comment: z.string().optional(),
});

export const approvalFlowSummarySchema = z.object({
  id: z.string(),
  status: z.string(),
  payload: z.object({
    sceneName: z.string().optional(),
  }).passthrough().optional(),
});
export type ApprovalFlowSummaryDto = z.infer<typeof approvalFlowSummarySchema>;

export type CreateApprovalFlowBody = z.infer<typeof createApprovalFlowBodySchema>;
export type ScenePermissionPayload = z.infer<typeof scenePermissionPayloadSchema>;
export type ApprovalActionBody = z.infer<typeof approvalActionBodySchema>;
