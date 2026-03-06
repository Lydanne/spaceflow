import { z } from "zod";

// ─── 通用分页请求参数 ────────────────────────────────────
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ─── 通用分页响应包装 ────────────────────────────────────
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  });
}

// ─── 添加团队成员 request body ────────────────────────────
export const addTeamMemberBodySchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["owner", "member"]).default("member"),
});
export type AddTeamMemberBody = z.infer<typeof addTeamMemberBodySchema>;

// ─── 更新成员角色 request body ────────────────────────────
export const updateMemberRoleBodySchema = z.object({
  role: z.enum(["owner", "member"]),
});
export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleBodySchema>;
