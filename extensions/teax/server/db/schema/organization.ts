import { pgTable, uuid, integer, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./user";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  giteaOrgId: integer("gitea_org_id").unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  giteaTeamId: integer("gitea_team_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("teams_org_gitea_team").on(table.organizationId, table.giteaTeamId),
]);

export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("team_members_team_user").on(table.teamId, table.userId),
]);
