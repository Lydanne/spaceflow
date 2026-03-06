import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { users, userFeishu } from "~~/server/db/schema/user";
import type { z } from "zod";

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
