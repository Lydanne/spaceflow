import { z } from "zod";

// 会话可见性：公开或私有
export const agentSessionVisibilitySchema = z.enum(["public", "private"]);
// 会话参与者角色
export const agentSessionParticipantRoleSchema = z.enum(["owner", "collaborator", "viewer"]);
// 消息发言方类型（与会话时间线一致）
export const agentSessionActorTypeSchema = z.enum(["user", "agent", "system", "bot"]);
// 消息类型（前端按类型展示不同样式）
export const agentSessionMessageTypeSchema = z.enum([
  "user_prompt",
  "agent_reply",
  "system_note",
  "tool_summary",
]);

/**
 * 创建会话请求体。
 * prompt 为必填首条任务描述，其余字段控制可见性与执行策略。
 */
export const createAgentSessionBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  prompt: z.string().min(1).max(20000),
  visibility: agentSessionVisibilitySchema.optional().default("public"),
  base_branch: z.string().min(1).max(255).optional().default("main"),
  working_branch: z.string().min(1).max(255).optional(),
  auto_commit: z.boolean().optional().default(false),
  auto_pr: z.boolean().optional().default(false),
});

export type CreateAgentSessionBody = z.infer<typeof createAgentSessionBodySchema>;

/**
 * 邀请会话参与者请求体。
 * owner 角色仅系统内部设置，接口不允许直接传入。
 */
export const addAgentSessionParticipantBodySchema = z.object({
  user_id: z.string().uuid(),
  role: agentSessionParticipantRoleSchema.exclude(["owner"]).optional().default("collaborator"),
  can_chat: z.boolean().optional().default(true),
});

export type AddAgentSessionParticipantBody = z.infer<typeof addAgentSessionParticipantBodySchema>;

/**
 * 更新参与者权限请求体。
 * 至少要包含 role 或 can_chat 的其中一个。
 */
export const updateAgentSessionParticipantBodySchema = z.object({
  role: agentSessionParticipantRoleSchema.exclude(["owner"]).optional(),
  can_chat: z.boolean().optional(),
}).refine((value) => value.role !== undefined || value.can_chat !== undefined, {
  message: "At least one field must be provided",
});

export type UpdateAgentSessionParticipantBody = z.infer<typeof updateAgentSessionParticipantBodySchema>;

/**
 * 在会话中发送消息请求体。
 * metadata 用于透传上下文，不参与固定字段校验。
 */
export const createAgentSessionMessageBodySchema = z.object({
  content: z.string().min(1).max(20000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateAgentSessionMessageBody = z.infer<typeof createAgentSessionMessageBodySchema>;

/**
 * 修改会话可见性请求体。
 */
export const updateAgentSessionVisibilityBodySchema = z.object({
  visibility: agentSessionVisibilitySchema,
});

export type UpdateAgentSessionVisibilityBody = z.infer<typeof updateAgentSessionVisibilityBodySchema>;

/**
 * prompt 接口请求体（兼容 prompt 字段命名）。
 */
export const createAgentSessionPromptBodySchema = z.object({
  prompt: z.string().min(1).max(20000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateAgentSessionPromptBody = z.infer<typeof createAgentSessionPromptBodySchema>;

/**
 * 会话事件查询参数。
 */
export const listAgentSessionEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  after_seq: z.coerce.number().int().min(1).optional(),
});

export type ListAgentSessionEventsQuery = z.infer<typeof listAgentSessionEventsQuerySchema>;
