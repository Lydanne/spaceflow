import { pgTable, uuid, varchar, text, jsonb, unique } from "drizzle-orm/pg-core";
import { organizations, teams } from "./organization";
import { baseColumns } from "./base";

export const permissionGroups = pgTable("permission_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull().default("custom"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").default([]),
  repositoryIds: jsonb("repository_ids"),
  ...baseColumns(),
});

export const teamPermissions = pgTable("team_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  permissionGroupId: uuid("permission_group_id").references(() => permissionGroups.id, { onDelete: "cascade" }),
  ...baseColumns(),
}, (table) => [
  unique("team_permissions_team_group").on(table.teamId, table.permissionGroupId),
]);
