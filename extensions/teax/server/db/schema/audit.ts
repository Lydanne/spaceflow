import { pgTable, uuid, varchar, text, inet, jsonb, bigserial, index } from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";
import { baseColumns } from "./base";

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  user_id: uuid("user_id").references(() => users.id),
  organization_id: uuid("organization_id").references(() => organizations.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource_type: varchar("resource_type", { length: 50 }),
  resource_id: uuid("resource_id"),
  ip_address: inet("ip_address"),
  user_agent: text("user_agent"),
  detail: jsonb("detail").default({}),
  ...baseColumns(),
}, (table) => [
  index("idx_audit_logs_user").on(table.user_id),
  index("idx_audit_logs_org").on(table.organization_id),
  index("idx_audit_logs_created").on(table.created_at),
]);
