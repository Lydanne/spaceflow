import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { users, userFeishu } from "~~/server/db/schema/user";
import { z } from "zod";
import { paginatedResponseSchema } from "./common.dto";

// ─── users ───────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const updateUserSchema = createUpdateSchema(users);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export const adminUserListItemSchema = selectUserSchema.pick({
  id: true,
  gitea_id: true,
  gitea_username: true,
  email: true,
  avatar_url: true,
  is_admin: true,
}).extend({
  created_at: z.string(),
  updated_at: z.string(),
});
export type AdminUserListItemDto = z.infer<typeof adminUserListItemSchema>;

export const adminUsersResponseSchema = paginatedResponseSchema(adminUserListItemSchema);
export type AdminUsersResponseDto = z.infer<typeof adminUsersResponseSchema>;

export const selectableUserSchema = selectUserSchema.pick({
  id: true,
  gitea_username: true,
  email: true,
  avatar_url: true,
});
export type SelectableUserDto = z.infer<typeof selectableUserSchema>;

export const feishuSelectDataSchema = z.object({
  feishu_name: z.string(),
  feishu_avatar: z.string(),
  users: z.array(selectableUserSchema),
});
export type FeishuSelectDataDto = z.infer<typeof feishuSelectDataSchema>;

export const feishuSelectResultSchema = z.object({
  success: z.boolean(),
  redirect: z.string(),
});
export type FeishuSelectResultDto = z.infer<typeof feishuSelectResultSchema>;

// ─── userFeishu ──────────────────────────────────────────
export const insertUserFeishuSchema = createInsertSchema(userFeishu);
export const selectUserFeishuSchema = createSelectSchema(userFeishu);
export const updateUserFeishuSchema = createUpdateSchema(userFeishu);

export type InsertUserFeishu = z.infer<typeof insertUserFeishuSchema>;
export type SelectUserFeishu = z.infer<typeof selectUserFeishuSchema>;
export type UpdateUserFeishu = z.infer<typeof updateUserFeishuSchema>;

export const feishuBindingSchema = selectUserFeishuSchema.pick({
  id: true,
  feishu_open_id: true,
  feishu_name: true,
  feishu_avatar: true,
}).extend({
  created_at: z.string(),
});
export type FeishuBindingDto = z.infer<typeof feishuBindingSchema>;

export const userFeishuBindingResponseSchema = z.object({
  data: feishuBindingSchema.nullable(),
});
export type UserFeishuBindingResponseDto = z.infer<typeof userFeishuBindingResponseSchema>;

export const teamMemberInfoSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar_url: z.string().nullable(),
  role: z.string().nullable(),
});
export type TeamMemberInfoDto = z.infer<typeof teamMemberInfoSchema>;

export const permissionGroupInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  permissions: z.array(z.string()),
});
export type PermissionGroupInfoDto = z.infer<typeof permissionGroupInfoSchema>;

export const teamInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization: z.object({
    id: z.string(),
    name: z.string(),
  }),
  role: z.string().nullable(),
  permissions: z.array(permissionGroupInfoSchema),
  members: z.array(teamMemberInfoSchema),
});
export type TeamInfoDto = z.infer<typeof teamInfoSchema>;

export const userTeamsResponseSchema = z.object({
  data: z.array(teamInfoSchema),
});
export type UserTeamsResponseDto = z.infer<typeof userTeamsResponseSchema>;

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
