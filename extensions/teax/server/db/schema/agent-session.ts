import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { users } from "./user";
import { baseColumns } from "./base";

/**
 * Agent 会话主表。
 * 一条记录代表一个仓库内的协作会话（支持多人参与 + 多轮对话）。
 */
export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repository_id: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    // 归属的 Runtime（每仓库一个 runtime）
    runtime_id: uuid("runtime_id"),
    scope: varchar("scope", { length: 32 }).notNull().default("repo"),
    parent_session_id: uuid("parent_session_id"),
    // 会话标题（展示用），可为空
    title: varchar("title", { length: 255 }),
    // 创建会话时的首条任务描述
    prompt: text("prompt"),
    // 会话基线分支与工作分支
    base_branch: varchar("base_branch", { length: 255 }).notNull().default("main"),
    working_branch: varchar("working_branch", { length: 255 }),
    // 运行时会话目录（worktree 路径）
    session_path: text("session_path"),
    // 可见性：public / private
    visibility: varchar("visibility", { length: 16 }).notNull().default("public"),
    // 会话创建者（owner）
    creator_id: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    // 生命周期状态：created/running/completed/failed...
    status: varchar("status", { length: 32 }).notNull().default("created"),
    // OpenCode 侧会话 ID（与外部执行引擎关联）
    opencode_session_id: varchar("opencode_session_id", { length: 255 }),
    // 自动提交 / 自动 PR 开关
    auto_commit: boolean("auto_commit").notNull().default(false),
    auto_pr: boolean("auto_pr").notNull().default(false),
    pr_url: text("pr_url"),
    started_at: timestamp("started_at", { withTimezone: true }),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    ...baseColumns(),
  },
  (table) => [
    index("idx_agent_sessions_repository_id").on(table.repository_id),
    index("idx_agent_sessions_runtime_id").on(table.runtime_id),
    index("idx_agent_sessions_creator_id").on(table.creator_id),
    index("idx_agent_sessions_status").on(table.status),
    index("idx_agent_sessions_visibility").on(table.visibility),
  ],
);

/**
 * 会话参与者表。
 * 用于记录谁可以访问会话、是否可发言，以及在会话中的角色。
 */
export const agentSessionParticipants = pgTable(
  "agent_session_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // owner / collaborator / viewer
    role: varchar("role", { length: 32 }).notNull().default("collaborator"),
    // 是否允许在会话中发送消息（发起追问）
    can_chat: boolean("can_chat").notNull().default(true),
    // 邀请人（通常是会话 owner 或管理员）
    invited_by: uuid("invited_by").references(() => users.id),
    joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow(),
    ...baseColumns(),
  },
  (table) => [
    unique("agent_session_participants_session_user").on(table.session_id, table.user_id),
    index("idx_agent_session_participants_session_id").on(table.session_id),
    index("idx_agent_session_participants_user_id").on(table.user_id),
  ],
);

/**
 * 会话消息表。
 * 记录会话内完整对话时间线（用户发言、Agent 回复、系统消息）。
 */
export const agentSessionMessages = pgTable(
  "agent_session_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    // 会话内单调递增序号，用于稳定回放
    seq: integer("seq").notNull(),
    // 发言主体类型与主体 ID
    actor_type: varchar("actor_type", { length: 32 }).notNull(),
    actor_id: varchar("actor_id", { length: 64 }).notNull(),
    // 消息类型：user_prompt / agent_reply / system_note / tool_summary
    message_type: varchar("message_type", { length: 64 }).notNull(),
    content: text("content").notNull(),
    // 扩展上下文（例如 token 消耗、引用消息、工具摘要）
    metadata: jsonb("metadata").default({}),
    // 置顶状态（用于关键消息高亮）
    pinned: boolean("pinned").notNull().default(false),
    pinned_by: uuid("pinned_by").references(() => users.id),
    pinned_at: timestamp("pinned_at", { withTimezone: true }),
    ...baseColumns(),
  },
  (table) => [
    unique("agent_session_messages_session_seq").on(table.session_id, table.seq),
    index("idx_agent_session_messages_session_id").on(table.session_id),
    index("idx_agent_session_messages_actor").on(table.actor_type, table.actor_id),
  ],
);

/**
 * 会话事件流表。
 * 用于记录会话级操作时间线（可用于活动日志与前端实时拉流）。
 */
export const agentSessionEvents = pgTable(
  "agent_session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    // 会话内单调递增事件序号
    seq: integer("seq").notNull(),
    // 事件类型：session_created/message_created/visibility_changed/...
    type: varchar("type", { length: 64 }).notNull(),
    payload: jsonb("payload").default({}),
    actor_type: varchar("actor_type", { length: 32 }).notNull(),
    actor_id: varchar("actor_id", { length: 64 }).notNull(),
    ...baseColumns(),
  },
  (table) => [
    unique("agent_session_events_session_seq").on(table.session_id, table.seq),
    index("idx_agent_session_events_session_id").on(table.session_id),
    index("idx_agent_session_events_type").on(table.type),
  ],
);
