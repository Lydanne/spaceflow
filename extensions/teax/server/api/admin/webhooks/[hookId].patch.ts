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

  const body = await readBody<{
    active?: boolean;
    url?: string;
    secret?: string;
  }>(event);

  try {
    const gitea = await createServiceGiteaClient();

    // 先获取当前配置
    const currentHook = await gitea.getSystemHook(hookId);

    // 构建更新数据
    const updateData: {
      active?: boolean;
      events?: string[];
      config?: {
        url?: string;
        content_type?: string;
        secret?: string;
      };
    } = {
      events: currentHook.events,
      config: { ...currentHook.config },
    };

    if (body.active !== undefined) {
      updateData.active = body.active;
    }

    if (body.url) {
      updateData.config!.url = body.url;
    }

    if (body.secret) {
      updateData.config!.secret = body.secret;
    }

    const hook = await gitea.updateSystemHook(hookId, updateData);

    return {
      success: true,
      hook,
      message: "系统 Webhook 更新成功",
    };
  } catch (err: unknown) {
    console.error("Failed to update system hook:", err);
    throw createError({
      statusCode: 500,
      message: "更新系统 Webhook 失败",
    });
  }
});
