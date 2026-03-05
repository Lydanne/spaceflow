import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { users } from "./user";
import { baseColumns } from "./base";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    giteaRepoId: integer("gitea_repo_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    description: text("description"),
    defaultBranch: varchar("default_branch", { length: 255 }).default("main"),
    cloneUrl: text("clone_url").notNull(),
    webhookId: integer("webhook_id"),
    webhookSecret: varchar("webhook_secret", { length: 255 }),
    settings: jsonb("settings").default({}),
    createdBy: uuid("created_by").references(() => users.id),
    ...baseColumns(),
  },
  (table) => [
    unique("projects_org_repo").on(table.organizationId, table.giteaRepoId),
    index("idx_projects_org").on(table.organizationId),
  ],
);
