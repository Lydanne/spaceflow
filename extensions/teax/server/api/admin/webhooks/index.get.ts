import { requireAdmin } from "~~/server/utils/auth";
import { createServiceGiteaClient } from "~~/server/utils/gitea";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  try {
    const gitea = await createServiceGiteaClient();
    const hooks = await gitea.listSystemHooks();

    return hooks;
  } catch (err: unknown) {
    console.error("Failed to list system hooks:", err);
    throw createError({
      statusCode: 500,
      message: "获取系统 Webhook 列表失败",
    });
  }
});
