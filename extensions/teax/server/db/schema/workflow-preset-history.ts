import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  index,
  timestamp,
} from "drizzle-orm/pg-core";
import { workflowPresets } from "./workflow-preset";
import { users } from "./user";

/**
 * 预设操作历史记录表
 * 记录子预设的锁定、解锁、触发、配置变更等操作
 */
export const workflowPresetHistory = pgTable(
  "workflow_preset_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    preset_id: uuid("preset_id")
      .notNull()
      .references(() => workflowPresets.id, { onDelete: "cascade" }),

    // 操作类型: 'lock', 'unlock', 'trigger', 'config_change', 'unlock_request'
    action: varchar("action", { length: 32 }).notNull(),

    // 操作者
    actor_id: uuid("actor_id")
      .notNull()
      .references(() => users.id),

    // 操作详情（JSON）
    // lock: { auto_unlock_at }
    // unlock: { reason: 'manual' | 'timeout' | 'approved' }
    // trigger: { run_id, branch, inputs }
    // config_change: { old_branch, new_branch, old_inputs, new_inputs }
    // unlock_request: { approval_id, status: 'pending' | 'approved' | 'rejected' }
    details: jsonb("details").default({}).$type<Record<string, unknown>>(),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_preset_history_preset").on(table.preset_id),
    index("idx_preset_history_actor").on(table.actor_id),
    index("idx_preset_history_created").on(table.created_at),
  ],
);

// 操作类型枚举
export type PresetHistoryAction =
  "lock" |
  "unlock" |
  "trigger" |
  "config_change" |
  "unlock_request";
