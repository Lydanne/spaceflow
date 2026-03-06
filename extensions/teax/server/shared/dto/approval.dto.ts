import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { approvalRequests } from "~~/server/db/schema/approval";
import { z } from "zod";

// ─── approval_requests ──────────────────────────────────
export const insertApprovalSchema = createInsertSchema(approvalRequests);
export const selectApprovalSchema = createSelectSchema(approvalRequests);

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type SelectApproval = z.infer<typeof selectApprovalSchema>;

// ─── 创建审批 request body ──────────────────────────────
export const createApprovalBodySchema = z.object({
  repository_id: z.string().uuid().optional(),
  type: z.enum(["deploy", "rollback", "custom"]).optional().default("deploy"),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateApprovalBody = z.infer<typeof createApprovalBodySchema>;
