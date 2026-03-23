import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { z } from "zod";

const configBodySchema = z.object({
  name: z.string().optional(),
  branch: z.string().optional(),
  inputs: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

/**
 * 更新子预设配置（仅锁定者可操作）
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

  const body = await readValidatedBody(event, configBodySchema.parse);
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

  // 检查是否是锁定者
  if (preset.locked_by !== session.user.id) {
    throw createError({ statusCode: 403, message: "Only the locker can modify this preset" });
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (body.name !== undefined) {
    oldValues.name = preset.name;
    newValues.name = body.name;
    updateData.name = body.name;
  }

  if (body.branch !== undefined) {
    oldValues.branch = preset.branch;
    newValues.branch = body.branch;
    updateData.branch = body.branch;
  }

  if (body.inputs !== undefined) {
    oldValues.inputs = preset.inputs;
    newValues.inputs = body.inputs;
    updateData.inputs = body.inputs;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: "No changes" };
  }

  // 更新子预设
  await db.transaction(async (tx) => {
    await tx
      .update(schema.workflowPresets)
      .set(updateData)
      .where(eq(schema.workflowPresets.id, preset.id));

    // 记录历史
    await tx.insert(schema.workflowPresetHistory).values({
      preset_id: preset.id,
      action: "config_change",
      actor_id: session.user.id,
      details: { old: oldValues, new: newValues },
    });
  });

  return { success: true };
});
