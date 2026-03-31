import { pgTable, uuid, integer, varchar, text, boolean, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { baseColumns } from "./base";
import type { UserSettings } from "../../../shared/user-settings";
import { DEFAULT_USER_SETTINGS } from "../../../shared/user-settings";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  gitea_id: integer("gitea_id").unique().notNull(),
  gitea_username: varchar("gitea_username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  avatar_url: text("avatar_url"),
  is_admin: boolean("is_admin").default(false),
  // 用户设置（通知偏好等），统一放在 JSONB 中管理
  settings: jsonb("settings").$type<UserSettings>().default(DEFAULT_USER_SETTINGS),
  // Gitea token（加密存储）
  gitea_access_token: text("gitea_access_token"),
  gitea_refresh_token: text("gitea_refresh_token"),
  gitea_token_expires_at: timestamp("gitea_token_expires_at", { withTimezone: true }),
  ...baseColumns(),
});

export type User = typeof users.$inferSelect;

export const userFeishu = pgTable("user_feishu", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  feishu_open_id: varchar("feishu_open_id", { length: 255 }).notNull(),
  feishu_union_id: varchar("feishu_union_id", { length: 255 }),
  feishu_name: varchar("feishu_name", { length: 255 }).notNull(),
  feishu_avatar: text("feishu_avatar"),
  access_token: text("access_token"),
  refresh_token: text("refresh_token"),
  token_expires_at: timestamp("token_expires_at", { withTimezone: true }),
  ...baseColumns(),
}, (table) => [
  uniqueIndex("user_feishu_user_open_idx").on(table.user_id, table.feishu_open_id),
]);
