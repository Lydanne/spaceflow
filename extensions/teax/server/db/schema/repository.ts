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

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    gitea_repo_id: integer("gitea_repo_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    full_name: varchar("full_name", { length: 255 }).notNull(),
    description: text("description"),
    default_branch: varchar("default_branch", { length: 255 }).default("main"),
    clone_url: text("clone_url").notNull(),
    webhook_id: integer("webhook_id"),
    webhook_secret: varchar("webhook_secret", { length: 255 }),
    settings: jsonb("settings").default({}),
    created_by: uuid("created_by").references(() => users.id),
    ...baseColumns(),
  },
  (table) => [
    unique("repositories_org_repo").on(table.organization_id, table.gitea_repo_id),
    index("idx_repositories_org").on(table.organization_id),
  ],
);
