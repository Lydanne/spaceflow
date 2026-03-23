import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireScenePermission } from "~~/server/utils/scene-permission";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";

export default defineEventHandler(async (event) => {
  const { preset, repo } = await resolvePresetByToken(event);

  // 检查场景权限
  const session = await requireScenePermission(event, "preset-workflow", repo.organization_id!, repo.id);

  // 只有子预设才能锁定
  if (!preset.group_id) {
    throw createError({ statusCode: 400, message: "只有子预设才能锁定" });
  }

  // 检查是否已被锁定
  if (preset.locked_by) {
    throw createError({ statusCode: 400, message: "预设已被锁定" });
  }

  const db = useDB();

  // 获取 group 的自动解锁时间配置
  const [group] = await db
    .select({ auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.id, preset.group_id))
    .limit(1);

  const now = new Date();
  let autoUnlockAt: Date | null = null;
  if (group?.auto_unlock_minutes) {
    autoUnlockAt = new Date(now.getTime() + group.auto_unlock_minutes * 60 * 1000);
  }

  // 锁定预设
  await db
    .update(schema.workflowPresets)
    .set({
      locked_by: session.user.id,
      locked_at: now,
      auto_unlock_at: autoUnlockAt,
    })
    .where(eq(schema.workflowPresets.id, preset.id));

  return { success: true };
});
