import { requireScenePermission } from "~~/server/utils/scene-permission";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";
import { lockPreset } from "~~/server/services/preset-lock.service";

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

  await lockPreset(preset.id, session.user.id, preset.group_id);

  return { success: true };
});
