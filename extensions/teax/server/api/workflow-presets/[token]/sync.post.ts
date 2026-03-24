import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";
import { z } from "zod";

const syncBodySchema = z.object({
  branch: z.string().optional(),
  inputs: z.record(z.string(), z.string()).optional(),
});

/**
 * 同步用户修改到数据库
 * 仅当 allow_sync_override 为 true 时生效
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const { preset } = await resolvePresetByToken(event);

  // 检查是否允许同步
  if (!preset.allow_sync_override) {
    throw createError({ statusCode: 403, message: "Sync override not allowed" });
  }

  const body = await readValidatedBody(event, syncBodySchema.parse);
  const db = useDB();

  // 构建更新数据
  const updateData: Record<string, unknown> = {};

  if (body.branch !== undefined) {
    updateData.branch = body.branch;
  }

  if (body.inputs !== undefined) {
    // 只更新未锁定的参数
    const lockedInputs = preset.locked_inputs || [];
    const currentInputs = (preset.inputs || {}) as Record<string, unknown>;
    const newInputs = { ...currentInputs };

    for (const [key, value] of Object.entries(body.inputs)) {
      if (!lockedInputs.includes(key)) {
        newInputs[key] = value;
      }
    }

    updateData.inputs = newInputs;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: "No changes" };
  }

  // 更新预设
  await db
    .update(schema.workflowPresets)
    .set(updateData)
    .where(eq(schema.workflowPresets.id, preset.id));

  return { success: true };
});
