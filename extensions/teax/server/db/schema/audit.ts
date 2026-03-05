import { pgTable, uuid, varchar, text, inet, jsonb, bigserial, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: uuid("resource_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  detail: jsonb("detail").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_audit_logs_user").on(table.userId),
  index("idx_audit_logs_org").on(table.organizationId),
  index("idx_audit_logs_created").on(table.createdAt),
]);
