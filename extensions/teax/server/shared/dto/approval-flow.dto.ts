import { z } from "zod";

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

export type CreateApprovalFlowBody = z.infer<typeof createApprovalFlowBodySchema>;
export type ScenePermissionPayload = z.infer<typeof scenePermissionPayloadSchema>;
export type ApprovalActionBody = z.infer<typeof approvalActionBodySchema>;
