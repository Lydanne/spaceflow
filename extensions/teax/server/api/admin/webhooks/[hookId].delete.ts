import { requireAdmin } from "~~/server/utils/auth";
import { createServiceGiteaClient } from "~~/server/utils/gitea";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const hookId = parseInt(event.context.params?.hookId || "");

  if (!hookId) {
    throw createError({
      statusCode: 400,
      message: "Invalid hook ID",
    });
  }

  try {
    const gitea = await createServiceGiteaClient();
    await gitea.deleteSystemHook(hookId);

    return {
      success: true,
      message: "系统 Webhook 删除成功",
    };
  } catch (err: unknown) {
    console.error("Failed to delete system hook:", err);
    throw createError({
      statusCode: 500,
      message: "删除系统 Webhook 失败",
    });
  }
});
