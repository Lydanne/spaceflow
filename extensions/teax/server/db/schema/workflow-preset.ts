import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  index,
  bigint,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { users } from "./user";
import { baseColumns } from "./base";
import { workflowPresetGroups } from "./workflow-preset-group";

/**
 * 工作流预设表
 * - 单预设模式：group_id = NULL
 * - 子预设模式：group_id != NULL，属于某个预设组
 */
export const workflowPresets = pgTable(
  "workflow_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repository_id: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    workflow_path: varchar("workflow_path", { length: 512 }).notNull(),
    branch: varchar("branch", { length: 255 }).notNull(),
    inputs: jsonb("inputs").default({}).$type<Record<string, string | boolean | number>>(),
    share_token: varchar("share_token", { length: 32 }).notNull().unique(),
    current_run_id: bigint("current_run_id", { mode: "number" }),
    last_triggered_by: uuid("last_triggered_by").references(() => users.id),
    allow_input_override: boolean("allow_input_override").default(false), // 已废弃，保留兼容
    locked_inputs: jsonb("locked_inputs").default([]).$type<string[]>(), // 被锁定不可修改的参数名列表
    allow_branch_override: boolean("allow_branch_override").default(false),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id),

    // 子预设相关字段（group_id 为 NULL 时为单预设模式）
    group_id: uuid("group_id").references(() => workflowPresetGroups.id, { onDelete: "cascade" }),
    preset_index: integer("preset_index"), // 子预设在组内的序号

    // 锁定状态（仅子预设使用）
    locked_by: uuid("locked_by").references(() => users.id),
    locked_at: timestamp("locked_at", { withTimezone: true }),
    auto_unlock_at: timestamp("auto_unlock_at", { withTimezone: true }),

    ...baseColumns(),
  },
  (table) => [
    index("idx_workflow_presets_repo").on(table.repository_id),
    index("idx_workflow_presets_token").on(table.share_token),
    index("idx_workflow_presets_group").on(table.group_id),
    index("idx_workflow_presets_locked_by").on(table.locked_by),
  ],
);
