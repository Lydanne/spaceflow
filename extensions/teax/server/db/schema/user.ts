import { pgTable, uuid, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { baseColumns } from "./base";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  gitea_id: integer("gitea_id").unique().notNull(),
  gitea_username: varchar("gitea_username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  avatar_url: text("avatar_url"),
  is_admin: boolean("is_admin").default(false),
  ...baseColumns(),
});

export const userFeishu = pgTable("user_feishu", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  feishu_open_id: varchar("feishu_open_id", { length: 255 }).unique().notNull(),
  feishu_union_id: varchar("feishu_union_id", { length: 255 }),
  feishu_name: varchar("feishu_name", { length: 255 }).notNull(),
  feishu_avatar: text("feishu_avatar"),
  access_token: text("access_token"),
  token_expires_at: timestamp("token_expires_at", { withTimezone: true }),
  notify_publish: boolean("notify_publish").default(true),
  notify_approval: boolean("notify_approval").default(true),
  notify_agent: boolean("notify_agent").default(true),
  notify_system: boolean("notify_system").default(false),
  ...baseColumns(),
});
