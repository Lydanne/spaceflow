import { eq } from "drizzle-orm";
import { z } from "zod";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

const updatePresetGroupBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  auto_unlock_minutes: z.number().int().positive().nullable().optional(),
  queue_enabled: z.boolean().optional(),
  is_public: z.boolean().optional(),
});

/**
 * 更新预设组设置
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({ statusCode: 400, message: "Missing token" });
  }

  const body = await readValidatedBody(event, updatePresetGroupBodySchema.parse);
  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({
      id: schema.workflowPresetGroups.id,
      created_by: schema.workflowPresetGroups.created_by,
    })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  // 只有创建者或管理员可以修改
  if (group.created_by !== session.user.id && !session.user.is_admin) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.auto_unlock_minutes !== undefined) updateData.auto_unlock_minutes = body.auto_unlock_minutes;
  if (body.queue_enabled !== undefined) updateData.queue_enabled = body.queue_enabled;
  if (body.is_public !== undefined) updateData.is_public = body.is_public;

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: "No changes" };
  }

  updateData.updated_at = new Date();

  await db
    .update(schema.workflowPresetGroups)
    .set(updateData)
    .where(eq(schema.workflowPresetGroups.id, group.id));

  return { success: true };
});
