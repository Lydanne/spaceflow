import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { repositories } from "~~/server/db/schema/repository";
import { z } from "zod";

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

// ─── 创建项目 request body ───────────────────────────────
export const createProjectBodySchema = z.object({
  repo_full_name: z.string().min(1).includes("/"),
});
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

// ─── 触发 Workflow request body ─────────────────────────
export const triggerWorkflowBodySchema = z.object({
  workflow_id: z.string().min(1),
  ref: z.string().min(1),
  inputs: z.record(z.string(), z.string()).optional(),
});
export type TriggerWorkflowBody = z.infer<typeof triggerWorkflowBodySchema>;

// ─── 通知规则 ─────────────────────────────────────────────
export const NOTIFY_EVENTS = [
  "workflow_success",
  "workflow_failure",
  "push",
  "agent_completed",
  "agent_failed",
] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export const notifyRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  chatId: z.string().min(1).max(255),
  events: z.array(z.enum(NOTIFY_EVENTS)).min(1),
  branches: z.array(z.string().max(255)).max(20).default([]),
  workflows: z.array(z.string().max(255)).max(20).default([]),
});
export type NotifyRule = z.infer<typeof notifyRuleSchema>;

// ─── 更新仓库设置 request body（JSONB 内部保持 camelCase）──
export const updateRepoSettingsBodySchema = z.object({
  notifyOnSuccess: z.boolean().optional(),
  notifyOnFailure: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  notifyRules: z.array(notifyRuleSchema).max(20).optional(),
  // 向后兼容（旧字段，逐步废弃）
  feishuChatId: z.string().max(255).optional(),
  notifyBranches: z.array(z.string().max(255)).max(20).optional(),
});
export type UpdateRepoSettingsBody = z.infer<typeof updateRepoSettingsBodySchema>;
