import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { users, userFeishu } from "~~/server/db/schema/user";
import { z } from "zod";

// ─── users ───────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const updateUserSchema = createUpdateSchema(users);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

// ─── userFeishu ──────────────────────────────────────────
export const insertUserFeishuSchema = createInsertSchema(userFeishu);
export const selectUserFeishuSchema = createSelectSchema(userFeishu);
export const updateUserFeishuSchema = createUpdateSchema(userFeishu);

export type InsertUserFeishu = z.infer<typeof insertUserFeishuSchema>;
export type SelectUserFeishu = z.infer<typeof selectUserFeishuSchema>;
export type UpdateUserFeishu = z.infer<typeof updateUserFeishuSchema>;

// ─── 通知偏好更新 request body ───────────────────────────
const repoEventPreferenceSchema = z.object({
  workflow_success: z.boolean().optional(),
  workflow_failure: z.boolean().optional(),
  push: z.boolean().optional(),
  pr_opened: z.boolean().optional(),
  issue_opened: z.boolean().optional(),
  agent_completed: z.boolean().optional(),
  agent_failed: z.boolean().optional(),
});

const personalEventPreferenceSchema = z.object({
  approval: z.boolean().optional(),
  system: z.boolean().optional(),
});

export const notifyPreferencesSchema = z.object({
  repoEvents: repoEventPreferenceSchema.optional(),
  personalEvents: personalEventPreferenceSchema.optional(),
});

export const userSettingsSchema = z.object({
  notifyPreferences: notifyPreferencesSchema.optional(),
});

export const updateNotifyPreferencesBodySchema = z.object({
  notifyPreferences: notifyPreferencesSchema.optional(),
});
export type UpdateNotifyPreferencesBody = z.infer<typeof updateNotifyPreferencesBodySchema>;
