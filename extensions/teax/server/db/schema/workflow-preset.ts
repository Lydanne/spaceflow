import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  index,
  bigint,
  boolean,
} from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { users } from "./user";
import { baseColumns } from "./base";

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
    allow_input_override: boolean("allow_input_override").default(false),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...baseColumns(),
  },
  (table) => [
    index("idx_workflow_presets_repo").on(table.repository_id),
    index("idx_workflow_presets_token").on(table.share_token),
  ],
);
