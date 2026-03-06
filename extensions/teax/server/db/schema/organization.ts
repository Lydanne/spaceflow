import { pgTable, uuid, integer, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./user";
import { baseColumns } from "./base";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  gitea_org_id: integer("gitea_org_id").unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }),
  avatar_url: text("avatar_url"),
  synced_at: timestamp("synced_at", { withTimezone: true }),
  ...baseColumns(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  gitea_team_id: integer("gitea_team_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  synced_at: timestamp("synced_at", { withTimezone: true }),
  ...baseColumns(),
}, (table) => [
  unique("teams_org_gitea_team").on(table.organization_id, table.gitea_team_id),
]);

export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  team_id: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("member"),
  joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  ...baseColumns(),
}, (table) => [
  unique("team_members_team_user").on(table.team_id, table.user_id),
]);
