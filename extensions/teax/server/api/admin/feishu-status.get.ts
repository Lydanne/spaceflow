import { requireAdmin } from "~~/server/utils/auth";
import { getFeishuClient } from "~~/server/utils/feishu-sdk";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const config = useRuntimeConfig();
  const configured = !!(config.feishuAppId && config.feishuAppSecret);

  if (!configured) {
    return {
      data: {
        configured: false,
        connected: false,
        error: "FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置",
        features: {
          encrypt: false,
          approval: false,
        },
      },
    };
  }

  let connected = false;
  let error: string | null = null;

  try {
    const client = getFeishuClient();
    await client.auth.tenantAccessToken.internal({
      data: {
        app_id: config.feishuAppId,
        app_secret: config.feishuAppSecret,
      },
    });
    connected = true;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "获取 tenant_access_token 失败";
  }

  return {
    data: {
      configured: true,
      connected,
      error,
      features: {
        encrypt: !!config.feishuEncryptKey,
        approval: !!config.feishuApprovalCode,
      },
    },
  };
});
