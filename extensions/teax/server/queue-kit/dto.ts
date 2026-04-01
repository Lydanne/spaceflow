import { z } from "zod";

// ─── 请求 DTO ──────────────────────────────────────────────

export const createQueueBodySchema = z.object({
  queue_key: z.string().min(1).max(512),
  name: z.string().min(1).max(255),
  auto_run: z.boolean().optional().default(true),
  concurrency: z.number().int().min(1).max(100).optional().default(1),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateQueueBody = z.infer<typeof createQueueBodySchema>;

export const updateQueueBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  auto_run: z.boolean().optional(),
  concurrency: z.number().int().min(1).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateQueueBody = z.infer<typeof updateQueueBodySchema>;

export const enqueueBodySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});
export type EnqueueBody = z.infer<typeof enqueueBodySchema>;

export const completeItemBodySchema = z.object({
  result: z.record(z.string(), z.unknown()).optional(),
});
export type CompleteItemBody = z.infer<typeof completeItemBodySchema>;

export const failItemBodySchema = z.object({
  error: z.string().min(1).max(2048),
});
export type FailItemBody = z.infer<typeof failItemBodySchema>;

// ─── 响应 DTO ──────────────────────────────────────────────

export const taskQueueItemSchema = z.object({
  id: z.string(),
  queue_id: z.string(),
  position: z.number(),
  status: z.enum(["waiting", "running", "completed", "failed", "cancelled"]),
  payload: z.record(z.string(), z.unknown()).nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export type TaskQueueItemDto = z.infer<typeof taskQueueItemSchema>;

export const taskQueueSchema = z.object({
  id: z.string(),
  queue_key: z.string(),
  name: z.string(),
  auto_run: z.boolean(),
  concurrency: z.number(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_by: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type TaskQueueDto = z.infer<typeof taskQueueSchema>;

export const taskQueueDetailSchema = taskQueueSchema.extend({
  items: z.array(taskQueueItemSchema),
  running_count: z.number(),
  waiting_count: z.number(),
});
export type TaskQueueDetailDto = z.infer<typeof taskQueueDetailSchema>;

export const enqueueResultSchema = z.object({
  item_id: z.string(),
  position: z.number(),
  triggered: z.boolean().optional(),
});
export type EnqueueResultDto = z.infer<typeof enqueueResultSchema>;
