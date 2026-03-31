import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { repositories } from "~~/server/db/schema/repository";
import { z } from "zod";
import { REPO_NOTIFY_EVENTS } from "~~/shared/notify-events";
import type { NotifyRule as SharedNotifyRule } from "~~/shared/notify-rules";
import { paginatedResponseSchema } from "./common.dto";

// ─── repositories ────────────────────────────────────────
export const insertRepositorySchema = createInsertSchema(repositories);
export const selectRepositorySchema = createSelectSchema(repositories);
export const updateRepositorySchema = createUpdateSchema(repositories);

export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type SelectRepository = z.infer<typeof selectRepositorySchema>;
export type UpdateRepository = z.infer<typeof updateRepositorySchema>;

// ─── API response（排除敏感字段） ────────────────────────
export const repositoryResponseSchema = selectRepositorySchema.omit({
  webhook_secret: true,
});
export type RepositoryResponse = z.infer<typeof repositoryResponseSchema>;

export const projectBaseSchema = repositoryResponseSchema.pick({
  id: true,
  organization_id: true,
  gitea_repo_id: true,
  name: true,
  full_name: true,
  description: true,
  default_branch: true,
  clone_url: true,
  settings: true,
  created_by: true,
  created_at: true,
  updated_at: true,
});
export type ProjectBaseDto = z.infer<typeof projectBaseSchema>;

export const projectWatchStateSchema = z.object({
  watching: z.boolean(),
  watch_synced_at: z.string().nullable(),
});
export type ProjectWatchStateDto = z.infer<typeof projectWatchStateSchema>;

export const projectDetailSchema = projectBaseSchema.extend({
  watching: projectWatchStateSchema.shape.watching,
  watch_synced_at: projectWatchStateSchema.shape.watch_synced_at,
});
export type ProjectDetailDto = z.infer<typeof projectDetailSchema>;

export const projectListItemSchema = projectDetailSchema;
export type ProjectListItemDto = z.infer<typeof projectListItemSchema>;

export const orgProjectsResponseSchema = paginatedResponseSchema(projectListItemSchema);
export type OrgProjectsResponseDto = z.infer<typeof orgProjectsResponseSchema>;

// ─── 创建项目 request body ───────────────────────────────
export const createProjectBodySchema = z.object({
  repo_full_name: z.string().min(1).includes("/"),
});
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

// ─── 触发 Workflow request body ─────────────────────────
export const triggerWorkflowBodySchema = z.object({
  workflow_id: z.string().min(1),
  ref: z.string().min(1),
  inputs: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});
export type TriggerWorkflowBody = z.infer<typeof triggerWorkflowBodySchema>;

// ─── 通知规则 ─────────────────────────────────────────────
export const NOTIFY_EVENTS = [
  ...REPO_NOTIFY_EVENTS,
] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export const notifyRuleSchema: z.ZodType<SharedNotifyRule> = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  chatId: z.string().min(1).max(255),
  events: z.array(z.enum(NOTIFY_EVENTS)).min(1),
  branches: z.array(z.string().max(255)).max(20).default([]),
  workflows: z.array(z.string().max(255)).max(20).default([]),
});
export type NotifyRule = SharedNotifyRule;

// ─── 更新仓库设置 request body（JSONB 内部保持 camelCase）──
export const updateRepoSettingsBodySchema = z.object({
  notifyOnSuccess: z.boolean().optional(),
  notifyOnFailure: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  notifyRules: z.array(notifyRuleSchema).max(20).optional(),
});
export type UpdateRepoSettingsBody = z.infer<typeof updateRepoSettingsBodySchema>;
