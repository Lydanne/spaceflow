import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { z } from "zod";

const updatePresetBodySchema = z.object({
  name: z.string().optional(),
  branch: z.string().optional(),
  inputs: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
  locked_inputs: z.array(z.string()).optional(),
  allow_branch_override: z.boolean().optional(),
  allow_sync_override: z.boolean().optional(),
});

/**
 * 更新子预设配置（管理员/创建者可操作）
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const token = getRouterParam(event, "token");
  const indexStr = getRouterParam(event, "index");

  if (!token || !indexStr) {
    throw createError({ statusCode: 400, message: "Missing parameters" });
  }

  const presetIndex = parseInt(indexStr, 10);
  if (isNaN(presetIndex)) {
    throw createError({ statusCode: 400, message: "Invalid preset index" });
  }

  const body = await readValidatedBody(event, updatePresetBodySchema.parse);
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

  // 检查权限：必须是管理员或创建者
  const isAdmin = session.user.is_admin === true;
  const isOwner = group.created_by === session.user.id;

  if (!isAdmin && !isOwner) {
    throw createError({ statusCode: 403, message: "Only admin or group owner can edit presets" });
  }

  // 获取子预设
  const [preset] = await db
    .select()
    .from(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.group_id, group.id),
        eq(schema.workflowPresets.preset_index, presetIndex),
      ),
    );

  if (!preset) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) {
    updateData.name = body.name;
  }

  if (body.branch !== undefined) {
    updateData.branch = body.branch;
  }

  if (body.inputs !== undefined) {
    updateData.inputs = body.inputs;
  }

  if (body.locked_inputs !== undefined) {
    updateData.locked_inputs = body.locked_inputs;
  }

  if (body.allow_branch_override !== undefined) {
    updateData.allow_branch_override = body.allow_branch_override;
  }

  if (body.allow_sync_override !== undefined) {
    updateData.allow_sync_override = body.allow_sync_override;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: "No changes" };
  }

  // 更新子预设
  await db
    .update(schema.workflowPresets)
    .set(updateData)
    .where(eq(schema.workflowPresets.id, preset.id));

  return { success: true };
});
