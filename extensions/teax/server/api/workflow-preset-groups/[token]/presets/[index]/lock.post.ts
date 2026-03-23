import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { z } from "zod";

const lockBodySchema = z.object({
  auto_unlock_minutes: z.number().optional(),
});

/**
 * 锁定子预设
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

  const body = await readValidatedBody(event, lockBodySchema.parse);
  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({
      id: schema.workflowPresetGroups.id,
      auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes,
    })
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

  // 检查是否已被锁定
  if (preset.locked_by) {
    if (preset.locked_by === session.user.id) {
      throw createError({ statusCode: 400, message: "You already locked this preset" });
    }
    throw createError({ statusCode: 409, message: "Preset is already locked by another user" });
  }

  // 计算自动解锁时间
  const autoUnlockMinutes = body.auto_unlock_minutes ?? group.auto_unlock_minutes;
  const autoUnlockAt = autoUnlockMinutes
    ? new Date(Date.now() + autoUnlockMinutes * 60 * 1000)
    : null;

  const now = new Date();

  // 锁定子预设
  await db.transaction(async (tx) => {
    await tx
      .update(schema.workflowPresets)
      .set({
        locked_by: session.user.id,
        locked_at: now,
        auto_unlock_at: autoUnlockAt,
      })
      .where(eq(schema.workflowPresets.id, preset.id));

    // 记录历史
    await tx.insert(schema.workflowPresetHistory).values({
      preset_id: preset.id,
      action: "lock",
      actor_id: session.user.id,
      details: { auto_unlock_at: autoUnlockAt?.toISOString() },
    });
  });

  return {
    success: true,
    locked_at: now,
    auto_unlock_at: autoUnlockAt,
  };
});
