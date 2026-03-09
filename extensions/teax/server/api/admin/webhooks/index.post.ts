import { requireAdmin } from "~~/server/utils/auth";
import { createServiceGiteaClient } from "~~/server/utils/gitea";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody<{ url: string; secret: string }>(event);

  if (!body.url || !body.secret) {
    throw createError({
      statusCode: 400,
      message: "URL 和 Secret 为必填项",
    });
  }

  try {
    const gitea = await createServiceGiteaClient();
    const hook = await gitea.createSystemHook(body.url, body.secret);

    return {
      success: true,
      hook,
      message: "系统 Webhook 创建成功",
    };
  } catch (err: unknown) {
    console.error("Failed to create system hook:", err);
    // 打印详细的错误信息
    if (err && typeof err === "object" && "data" in err) {
      console.error("Gitea error response:", JSON.stringify((err as Record<string, unknown>).data, null, 2));
    }
    throw createError({
      statusCode: 500,
      message: "创建系统 Webhook 失败",
    });
  }
});
