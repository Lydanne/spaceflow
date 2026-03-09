/**
 * 手动更新飞书机器人菜单
 * 用于测试和管理
 */

import { requireAdmin } from "~~/server/utils/auth";
import { updateUserBotMenu, updateOrgBotMenu } from "~~/server/services/bot-menu.service";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { type, target } = body as { type?: string; target?: string };

  if (!type || !target) {
    throw createError({
      statusCode: 400,
      message: "Missing type or target",
    });
  }

  try {
    if (type === "user") {
      // 更新用户菜单 (target = open_id)
      await updateUserBotMenu(target);
      return {
        success: true,
        message: `User menu updated for ${target}`,
      };
    } else if (type === "org") {
      // 更新组织菜单 (target = org_name)
      await updateOrgBotMenu(target);
      return {
        success: true,
        message: `Org menu updated for ${target}`,
      };
    } else {
      throw createError({
        statusCode: 400,
        message: "Invalid type, must be 'user' or 'org'",
      });
    }
  } catch (error) {
    console.error("[admin] Failed to update bot menu:", error);
    throw createError({
      statusCode: 500,
      message: (error as Error).message || "Failed to update bot menu",
    });
  }
});
