import { z } from "zod";
import { workflowInputDefSchema } from "./actions.dto";

const inputsSchema = z.object({}).catchall(z.union([z.string(), z.boolean(), z.number()]));

export const createWorkflowPresetBodySchema = z.object({
  name: z.string().min(1).max(255),
  workflow_path: z.string().min(1).max(512),
  branch: z.string().min(1).max(255),
  inputs: inputsSchema.optional().default({}),
  allow_input_override: z.boolean().optional().default(false), // 已废弃，保留兼容
  locked_inputs: z.array(z.string()).optional().default([]), // 被锁定不可修改的参数名列表
  allow_branch_override: z.boolean().optional().default(false),
  allow_sync_override: z.boolean().optional().default(false),
  is_public: z.boolean().optional().default(false), // 是否公开到组织
});

export const updateWorkflowPresetBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  inputs: inputsSchema.optional(),
  allow_input_override: z.boolean().optional(), // 已废弃，保留兼容
  locked_inputs: z.array(z.string()).optional(), // 被锁定不可修改的参数名列表
  allow_branch_override: z.boolean().optional(),
  allow_sync_override: z.boolean().optional(),
  is_public: z.boolean().optional(), // 是否公开到组织
});

export const createPresetGroupBodySchema = z.object({
  repository_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workflow_path: z.string().min(1).max(512),
  default_branch: z.string().min(1).max(255),
  default_inputs: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
  auto_unlock_minutes: z.number().int().positive().optional(),
  queue_enabled: z.boolean().optional().default(false), // 排队运行
  is_public: z.boolean().optional().default(false), // 是否公开到组织
});

export const workflowPresetRepositorySchema = z.object({
  id: z.string(),
  full_name: z.string(),
  name: z.string(),
});
export type WorkflowPresetRepositoryDto = z.infer<typeof workflowPresetRepositorySchema>;

export const workflowPresetGroupSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  auto_unlock_minutes: z.number().nullable(),
  queue_enabled: z.boolean(),
  share_token: z.string(),
});
export type WorkflowPresetGroupSummaryDto = z.infer<typeof workflowPresetGroupSummarySchema>;

export const workflowPresetPagePresetSchema = z.object({
  id: z.string(),
  share_token: z.string(),
  name: z.string(),
  workflow_path: z.string(),
  workflow_name: z.string(),
  branch: z.string(),
  inputs: z.record(z.string(), z.string()),
  allow_input_override: z.boolean(),
  locked_inputs: z.array(z.string()),
  allow_branch_override: z.boolean(),
  allow_sync_override: z.boolean(),
  locked_by: z.string().nullable().optional(),
  locked_at: z.string().nullable().optional(),
  auto_unlock_at: z.string().nullable().optional(),
});
export type WorkflowPresetPagePresetDto = z.infer<typeof workflowPresetPagePresetSchema>;

export const workflowPresetPageDataSchema = z.object({
  preset: workflowPresetPagePresetSchema,
  group: workflowPresetGroupSummarySchema.nullable().optional(),
  inputDefs: z.record(z.string(), workflowInputDefSchema),
  branches: z.array(z.string()),
  repository: workflowPresetRepositorySchema,
});
export type WorkflowPresetPageDataDto = z.infer<typeof workflowPresetPageDataSchema>;

export const workflowPresetHistoryItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  actor_name: z.string().nullable(),
  actor_avatar: z.string().nullable(),
  created_at: z.string(),
});
export type WorkflowPresetHistoryItemDto = z.infer<typeof workflowPresetHistoryItemSchema>;

export const workflowPresetHistoryResponseSchema = z.object({
  history: z.array(workflowPresetHistoryItemSchema),
});
export type WorkflowPresetHistoryResponseDto = z.infer<typeof workflowPresetHistoryResponseSchema>;

export const workflowPresetStatusRunJobSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export type WorkflowPresetStatusRunJobDto = z.infer<typeof workflowPresetStatusRunJobSchema>;

export const workflowPresetStatusRunSchema = z.object({
  id: z.number(),
  run_number: z.number(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  html_url: z.string().nullable(),
  jobs: z.array(workflowPresetStatusRunJobSchema),
});
export type WorkflowPresetStatusRunDto = z.infer<typeof workflowPresetStatusRunSchema>;

export const workflowPresetStatusTriggeredBySchema = z.object({
  name: z.string(),
  avatar_url: z.string().nullable(),
});
export type WorkflowPresetStatusTriggeredByDto = z.infer<typeof workflowPresetStatusTriggeredBySchema>;

export const workflowPresetQueueStatusSchema = z.object({
  status: z.enum(["waiting", "running"]),
  position: z.number().nullable(),
});
export type WorkflowPresetQueueStatusDto = z.infer<typeof workflowPresetQueueStatusSchema>;

export const workflowPresetStatusSchema = z.object({
  run: workflowPresetStatusRunSchema.nullable(),
  hasRunning: z.boolean(),
  triggeredBy: workflowPresetStatusTriggeredBySchema.nullable().optional(),
  queueStatus: workflowPresetQueueStatusSchema.nullable().optional(),
});
export type WorkflowPresetStatusDto = z.infer<typeof workflowPresetStatusSchema>;

export const workflowPresetUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
});
export type WorkflowPresetUserDto = z.infer<typeof workflowPresetUserSchema>;

export const workflowPresetGroupSubPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  preset_index: z.number(),
  branch: z.string(),
  inputs: inputsSchema.nullable(),
  share_token: z.string(),
  current_run_id: z.number().nullable(),
  locked_by: z.string().nullable(),
  locked_at: z.string().nullable(),
  auto_unlock_at: z.string().nullable(),
  locked_by_user: workflowPresetUserSchema.nullable(),
  status: z.enum(["idle", "locked", "running"]),
});
export type WorkflowPresetGroupSubPresetDto = z.infer<typeof workflowPresetGroupSubPresetSchema>;

export const presetQueueItemSchema = z.object({
  id: z.string(),
  preset_id: z.string(),
  preset_name: z.string(),
  preset_index: z.number(),
  queued_by: z.string(),
  queued_by_user: workflowPresetUserSchema.nullable(),
  branch: z.string(),
  inputs: inputsSchema.nullable(),
  position: z.number(),
  status: z.enum(["waiting", "running", "completed", "failed", "cancelled"]),
  created_at: z.string(),
});
export type PresetQueueItemDto = z.infer<typeof presetQueueItemSchema>;

export const workflowPresetGroupDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  workflow_path: z.string(),
  default_branch: z.string(),
  default_inputs: inputsSchema.nullable(),
  auto_unlock_minutes: z.number().nullable(),
  queue_enabled: z.boolean(),
  queue_id: z.string().nullable().optional(),
  share_token: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  repository: workflowPresetRepositorySchema,
  creator: workflowPresetUserSchema,
  presets: z.array(workflowPresetGroupSubPresetSchema),
  queue: z.array(presetQueueItemSchema).optional(),
  workflow_inputs: z.record(z.string(), workflowInputDefSchema),
});
export type WorkflowPresetGroupDetailDto = z.infer<typeof workflowPresetGroupDetailSchema>;

export const repoPresetCreatorSchema = z.object({
  name: z.string().nullable(),
  username: z.string(),
  avatar_url: z.string().nullable(),
});
export type RepoPresetCreatorDto = z.infer<typeof repoPresetCreatorSchema>;

export const repoPresetItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  workflow_path: z.string(),
  branch: z.string(),
  share_token: z.string(),
  is_public: z.boolean(),
  created_by: z.string().optional(),
  creator: repoPresetCreatorSchema.nullable().optional(),
  created_at: z.string(),
});
export type RepoPresetItemDto = z.infer<typeof repoPresetItemSchema>;

export const repoPresetGroupItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  workflow_path: z.string(),
  default_branch: z.string(),
  share_token: z.string(),
  is_public: z.boolean(),
  created_by: z.string().optional(),
  creator: repoPresetCreatorSchema.nullable().optional(),
  created_at: z.string(),
});
export type RepoPresetGroupItemDto = z.infer<typeof repoPresetGroupItemSchema>;

export const repoPresetsResponseSchema = z.object({
  org_presets: z.array(repoPresetItemSchema),
  my_presets: z.array(repoPresetItemSchema),
  preset_groups: z.array(repoPresetGroupItemSchema),
});
export type RepoPresetsResponseDto = z.infer<typeof repoPresetsResponseSchema>;

export const userWorkflowPresetItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  workflow_path: z.string(),
  branch: z.string(),
  share_token: z.string(),
  is_public: z.boolean().nullable().optional(),
  allow_input_override: z.boolean().nullable().optional(),
  allow_branch_override: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  repository: z.object({
    id: z.string(),
    full_name: z.string(),
  }),
});
export type UserWorkflowPresetItemDto = z.infer<typeof userWorkflowPresetItemSchema>;

export const workflowPresetCardCreatorSchema = z.object({
  id: z.string(),
  gitea_username: z.string(),
  avatar_url: z.string().nullable(),
});
export type WorkflowPresetCardCreatorDto = z.infer<typeof workflowPresetCardCreatorSchema>;

export const workflowPresetCardItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  workflow_path: z.string(),
  branch: z.string(),
  share_token: z.string(),
  is_public: z.boolean().nullable().optional(),
  allow_input_override: z.boolean().nullable().optional(),
  allow_branch_override: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  repository: z.object({
    id: z.string(),
    full_name: z.string(),
  }),
  creator: workflowPresetCardCreatorSchema.optional(),
});
export type WorkflowPresetCardItemDto = z.infer<typeof workflowPresetCardItemSchema>;

export const userWorkflowPresetSubItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  branch: z.string(),
  share_token: z.string(),
  preset_index: z.number().nullable(),
  locked_by: z.string().nullable(),
  locked_at: z.string().nullable(),
  current_run_id: z.number().nullable(),
});
export type UserWorkflowPresetSubItemDto = z.infer<typeof userWorkflowPresetSubItemSchema>;

export const userWorkflowPresetGroupItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  workflow_path: z.string(),
  default_branch: z.string(),
  share_token: z.string(),
  is_public: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  repository: z.object({
    id: z.string(),
    full_name: z.string(),
  }),
  presets: z.array(userWorkflowPresetSubItemSchema).optional(),
});
export type UserWorkflowPresetGroupItemDto = z.infer<typeof userWorkflowPresetGroupItemSchema>;

export const workflowPresetGroupCardItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  workflow_path: z.string(),
  default_branch: z.string(),
  share_token: z.string(),
  is_public: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  repository: z.object({
    id: z.string(),
    full_name: z.string(),
  }),
  presets: z.array(userWorkflowPresetSubItemSchema).optional(),
  creator: workflowPresetCardCreatorSchema.optional(),
});
export type WorkflowPresetGroupCardItemDto = z.infer<typeof workflowPresetGroupCardItemSchema>;

export const userWorkflowPresetsResponseSchema = z.object({
  data: z.array(userWorkflowPresetItemSchema),
});
export type UserWorkflowPresetsResponseDto = z.infer<typeof userWorkflowPresetsResponseSchema>;

export const userWorkflowPresetGroupsResponseSchema = z.object({
  data: z.array(userWorkflowPresetGroupItemSchema),
});
export type UserWorkflowPresetGroupsResponseDto = z.infer<typeof userWorkflowPresetGroupsResponseSchema>;

export const orgWorkflowPresetsResponseSchema = z.object({
  data: z.array(workflowPresetCardItemSchema),
});
export type OrgWorkflowPresetsResponseDto = z.infer<typeof orgWorkflowPresetsResponseSchema>;

export const orgWorkflowPresetGroupsResponseSchema = z.object({
  data: z.array(workflowPresetGroupCardItemSchema),
});
export type OrgWorkflowPresetGroupsResponseDto = z.infer<typeof orgWorkflowPresetGroupsResponseSchema>;

export const repositoryWorkflowPageDataSchema = z.object({
  workflow: z.object({
    name: z.string(),
    path: z.string(),
  }),
  inputDefs: z.record(z.string(), workflowInputDefSchema),
  branches: z.array(z.string()),
  repository: workflowPresetRepositorySchema,
});
export type RepositoryWorkflowPageDataDto = z.infer<typeof repositoryWorkflowPageDataSchema>;

export const createPresetGroupResultSchema = z.object({
  success: z.boolean(),
  group: z.object({
    id: z.string(),
    name: z.string(),
    share_token: z.string(),
    is_public: z.boolean().optional(),
  }),
});
export type CreatePresetGroupResultDto = z.infer<typeof createPresetGroupResultSchema>;
