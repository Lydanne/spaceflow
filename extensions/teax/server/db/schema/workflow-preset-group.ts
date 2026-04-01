import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  index,
  integer,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { organizations } from "./organization";
import { users } from "./user";
import { baseColumns } from "./base";

/**
 * 预设组表
 * 一个预设组包含多个子预设，支持锁定/解锁机制
 */
export const workflowPresetGroups = pgTable(
  "workflow_preset_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repository_id: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    workflow_path: varchar("workflow_path", { length: 512 }).notNull(),

    // 默认配置（新子预设继承）
    default_branch: varchar("default_branch", { length: 255 }).notNull(),
    default_inputs: jsonb("default_inputs").default({}).$type<Record<string, string | boolean | number>>(),

    // 自动解锁配置（分钟），NULL 表示不自动解锁
    auto_unlock_minutes: integer("auto_unlock_minutes").default(60),

    // 分享
    share_token: varchar("share_token", { length: 32 }).notNull().unique(),

    // 排队运行：开启后，触发子预设时如果 workflow 有 CI 在运行，自动排队等待
    queue_enabled: boolean("queue_enabled").default(false),

    // 组织公开相关字段
    organization_id: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    is_public: boolean("is_public").default(false), // 是否公开到组织

    // 创建者
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id),

    ...baseColumns(),
  },
  (table) => [
    index("idx_preset_groups_repo").on(table.repository_id),
    index("idx_preset_groups_token").on(table.share_token),
    index("idx_preset_groups_created_by").on(table.created_by),
    index("idx_preset_groups_org").on(table.organization_id),
    index("idx_preset_groups_public").on(table.organization_id, table.is_public),
  ],
);
