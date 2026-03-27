import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { agentSessions } from "./agent-session";
import { baseColumns } from "./base";

/**
 * 仓库级 Runtime 表。
 * 每个仓库最多一个 runtime（对应“每仓库 1 容器”抽象）。
 */
export const agentRuntimes = pgTable(
  "agent_runtimes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: varchar("scope", { length: 32 }).notNull().default("repo"),
    repository_id: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    // provider：local/mock/docker（MVP 先实现 local/mock）
    provider: varchar("provider", { length: 32 }).notNull().default("local"),
    // 外部 runtime 标识（例如容器名、容器 ID）
    runtime_key: varchar("runtime_key", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("starting"),
    last_heartbeat_at: timestamp("last_heartbeat_at", { withTimezone: true }),
    last_error: text("last_error"),
    metadata: jsonb("metadata").default({}),
    ...baseColumns(),
  },
  (table) => [
    unique("agent_runtimes_repository_unique").on(table.repository_id),
    index("idx_agent_runtimes_repository_id").on(table.repository_id),
    index("idx_agent_runtimes_status").on(table.status),
  ],
);

/**
 * 会话 worktree 生命周期表。
 * 记录 worktree 目录、分支与清理状态，作为 Git 隔离执行的事实来源。
 */
export const agentSessionWorktrees = pgTable(
  "agent_session_worktrees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session_id: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    repository_id: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    runtime_id: uuid("runtime_id").references(() => agentRuntimes.id, { onDelete: "set null" }),
    base_branch: varchar("base_branch", { length: 255 }).notNull(),
    working_branch: varchar("working_branch", { length: 255 }).notNull(),
    worktree_path: text("worktree_path").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("preparing"),
    prepared_at: timestamp("prepared_at", { withTimezone: true }),
    removed_at: timestamp("removed_at", { withTimezone: true }),
    last_error: text("last_error"),
    metadata: jsonb("metadata").default({}),
    ...baseColumns(),
  },
  (table) => [
    unique("agent_session_worktrees_session_unique").on(table.session_id),
    index("idx_agent_session_worktrees_repository_id").on(table.repository_id),
    index("idx_agent_session_worktrees_runtime_id").on(table.runtime_id),
    index("idx_agent_session_worktrees_status").on(table.status),
  ],
);
