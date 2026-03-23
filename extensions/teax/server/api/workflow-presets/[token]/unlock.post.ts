import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireScenePermission } from "~~/server/utils/scene-permission";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";

export default defineEventHandler(async (event) => {
  const { preset, repo } = await resolvePresetByToken(event);

  // 检查场景权限
  const session = await requireScenePermission(event, "preset-workflow", repo.organization_id!, repo.id);

  // 只有子预设才能解锁
  if (!preset.group_id) {
    throw createError({ statusCode: 400, message: "只有子预设才能解锁" });
  }

  // 检查是否已被锁定
  if (!preset.locked_by) {
    throw createError({ statusCode: 400, message: "预设未被锁定" });
  }

  // 只有锁定者才能解锁（或管理员）
  if (preset.locked_by !== session.user.id) {
    throw createError({ statusCode: 403, message: "只有锁定者才能解锁" });
  }

  const db = useDB();

  // 解锁预设
  await db
    .update(schema.workflowPresets)
    .set({
      locked_by: null,
      locked_at: null,
      auto_unlock_at: null,
    })
    .where(eq(schema.workflowPresets.id, preset.id));

  return { success: true };
});
