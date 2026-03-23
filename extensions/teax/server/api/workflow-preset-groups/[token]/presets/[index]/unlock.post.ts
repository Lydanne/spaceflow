import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

/**
 * 解锁子预设（仅锁定者可操作）
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

  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({ id: schema.workflowPresetGroups.id })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
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

  // 检查是否已锁定
  if (!preset.locked_by) {
    throw createError({ statusCode: 400, message: "Preset is not locked" });
  }

  // 检查是否是锁定者
  if (preset.locked_by !== session.user.id) {
    throw createError({ statusCode: 403, message: "Only the locker can unlock this preset" });
  }

  // 解锁子预设
  await db.transaction(async (tx) => {
    await tx
      .update(schema.workflowPresets)
      .set({
        locked_by: null,
        locked_at: null,
        auto_unlock_at: null,
      })
      .where(eq(schema.workflowPresets.id, preset.id));

    // 记录历史
    await tx.insert(schema.workflowPresetHistory).values({
      preset_id: preset.id,
      action: "unlock",
      actor_id: session.user.id,
      details: { reason: "manual" },
    });
  });

  return { success: true };
});
