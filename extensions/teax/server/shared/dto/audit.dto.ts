import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { auditLogs } from "~~/server/db/schema/audit";
import { z } from "zod";

// ─── auditLogs ───────────────────────────────────────────
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type SelectAuditLog = z.infer<typeof selectAuditLogSchema>;

export const auditLogListItemSchema = selectAuditLogSchema.pick({
  id: true,
  action: true,
  resource_type: true,
  resource_id: true,
  ip_address: true,
  detail: true,
}).extend({
  created_at: z.string(),
  username: z.string().nullable(),
  userAvatar: z.string().nullable(),
  orgName: z.string().nullable(),
});
export type AuditLogListItemDto = z.infer<typeof auditLogListItemSchema>;

export const auditLogsResponseSchema = z.object({
  data: z.array(auditLogListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export type AuditLogsResponseDto = z.infer<typeof auditLogsResponseSchema>;
