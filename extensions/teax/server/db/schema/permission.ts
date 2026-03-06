import { pgTable, uuid, varchar, text, jsonb, unique } from "drizzle-orm/pg-core";
import { organizations, teams } from "./organization";
import { baseColumns } from "./base";

export const permissionGroups = pgTable("permission_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull().default("custom"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").default([]),
  repository_ids: jsonb("repository_ids"),
  ...baseColumns(),
});

export const teamPermissions = pgTable("team_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  team_id: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  permission_group_id: uuid("permission_group_id").references(() => permissionGroups.id, { onDelete: "cascade" }),
  ...baseColumns(),
}, (table) => [
  unique("team_permissions_team_group").on(table.team_id, table.permission_group_id),
]);
