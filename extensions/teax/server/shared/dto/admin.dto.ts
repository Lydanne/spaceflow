import { z } from "zod";

export const feishuStatusSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  error: z.string().nullable(),
  features: z.object({
    encrypt: z.boolean(),
    approval: z.boolean(),
  }),
});
export type FeishuStatusDto = z.infer<typeof feishuStatusSchema>;

export const adminFeishuStatusResponseSchema = z.object({
  data: feishuStatusSchema,
});
export type AdminFeishuStatusResponseDto = z.infer<typeof adminFeishuStatusResponseSchema>;

export const systemWebhookSchema = z.object({
  id: z.number(),
  type: z.string(),
  url: z.string(),
  active: z.boolean(),
  events: z.array(z.string()),
  config: z.object({
    url: z.string(),
    content_type: z.string(),
    secret: z.string(),
  }),
});
export type SystemWebhookDto = z.infer<typeof systemWebhookSchema>;
