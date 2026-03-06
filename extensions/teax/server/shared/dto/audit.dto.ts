import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { auditLogs } from "~~/server/db/schema/audit";
import type { z } from "zod";

// ─── auditLogs ───────────────────────────────────────────
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type SelectAuditLog = z.infer<typeof selectAuditLogSchema>;
