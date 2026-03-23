import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

/**
 * 删除子预设（仅管理员或预设组创建者可操作）
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const token = getRouterParam(event, "token");
  const indexStr = getRouterParam(event, "index");

  if (!token || indexStr === undefined) {
    throw createError({ statusCode: 400, message: "Missing token or index" });
  }

  const presetIndex = parseInt(indexStr, 10);
  if (isNaN(presetIndex)) {
    throw createError({ statusCode: 400, message: "Invalid preset index" });
  }

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
    throw createError({
      statusCode: 403,
      message: "Only admin or group owner can delete presets",
    });
  }

  // 获取子预设
  const [preset] = await db
    .select({ id: schema.workflowPresets.id })
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

  // 删除子预设
  await db
    .delete(schema.workflowPresets)
    .where(eq(schema.workflowPresets.id, preset.id));

  return {
    success: true,
    message: "Preset deleted",
  };
});
