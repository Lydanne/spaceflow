import { createHmac } from "node:crypto";

export interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  name: string;
  avatar_url: string;
  email?: string;
}

export interface FeishuTokenResponse {
  code: number;
  msg: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
}

export interface FeishuUserInfoResponse {
  code: number;
  msg: string;
  data: {
    open_id: string;
    union_id: string;
    name: string;
    avatar_url: string;
    email?: string;
  };
}

export interface FeishuApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

export interface FeishuCardElement {
  tag: string;
  text?: { tag: string; content: string };
  content?: string;
  elements?: FeishuCardElement[];
  actions?: FeishuCardElement[];
  url?: string;
  type?: string;
  value?: Record<string, string>;
  [key: string]: unknown;
}

export interface FeishuInteractiveCard {
  header: {
    title: { tag: string; content: string };
    template?: string;
  };
  elements: FeishuCardElement[];
}

// ─── tenant_access_token 缓存 ────────────────────────────
let _tenantTokenCache: { token: string; expiresAt: number } | null = null;

const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

/**
 * 获取 tenant_access_token（带内存缓存，提前 5 分钟刷新）。
 * 用于发送消息等应用级 API 调用。
 */
export async function getFeishuTenantAccessToken(): Promise<string> {
  const now = Date.now();
  if (_tenantTokenCache && _tenantTokenCache.expiresAt > now) {
    return _tenantTokenCache.token;
  }

  const config = useRuntimeConfig();
  const response = await $fetch<{
    code: number;
    msg: string;
    tenant_access_token: string;
    expire: number;
  }>(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    body: {
      app_id: config.feishuAppId,
      app_secret: config.feishuAppSecret,
    },
  });

  if (response.code !== 0) {
    throw new Error(`Feishu tenant_access_token error: ${response.msg}`);
  }

  // 缓存，提前 5 分钟过期
  _tenantTokenCache = {
    token: response.tenant_access_token,
    expiresAt: now + (response.expire - 300) * 1000,
  };

  return response.tenant_access_token;
}

export async function getFeishuAppAccessToken(): Promise<string> {
  const config = useRuntimeConfig();
  const response = await $fetch<{
    code: number;
    msg: string;
    app_access_token: string;
    expire: number;
  }>(`${FEISHU_BASE_URL}/auth/v3/app_access_token/internal`, {
    method: "POST",
    body: {
      app_id: config.feishuAppId,
      app_secret: config.feishuAppSecret,
    },
  });

  if (response.code !== 0) {
    throw new Error(`Feishu app_access_token error: ${response.msg}`);
  }

  return response.app_access_token;
}

// ─── 消息发送 API ─────────────────────────────────────────

/**
 * 发送飞书文本消息给指定用户。
 * @param receiveId - 接收者 open_id
 * @param text - 消息文本
 */
export async function sendFeishuMessage(
  receiveId: string,
  text: string,
): Promise<void> {
  const token = await getFeishuTenantAccessToken();
  const response = await $fetch<FeishuApiResponse>(
    `${FEISHU_BASE_URL}/im/v1/messages?receive_id_type=open_id`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        receive_id: receiveId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      },
    },
  );

  if (response.code !== 0) {
    console.error(`Feishu send message error: ${response.msg}`);
  }
}

/**
 * 发送飞书交互式卡片消息给指定用户。
 * @param receiveId - 接收者 open_id
 * @param card - 交互式卡片
 */
export async function sendFeishuCardMessage(
  receiveId: string,
  card: FeishuInteractiveCard,
): Promise<void> {
  const token = await getFeishuTenantAccessToken();
  const response = await $fetch<FeishuApiResponse>(
    `${FEISHU_BASE_URL}/im/v1/messages?receive_id_type=open_id`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        receive_id: receiveId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      },
    },
  );

  if (response.code !== 0) {
    console.error(`Feishu send card message error: ${response.msg}`);
  }
}

/**
 * 批量发送飞书消息给多个用户（忽略单个失败）。
 */
export async function sendFeishuBatchMessage(
  receiveIds: string[],
  card: FeishuInteractiveCard,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    receiveIds.map(async (id) => {
      try {
        await sendFeishuCardMessage(id, card);
        sent++;
      } catch {
        failed++;
      }
    }),
  );

  return { sent, failed };
}

/**
 * 回复飞书消息（用于机器人回复）。
 */
export async function replyFeishuMessage(
  messageId: string,
  text: string,
): Promise<void> {
  const token = await getFeishuTenantAccessToken();
  const response = await $fetch<FeishuApiResponse>(
    `${FEISHU_BASE_URL}/im/v1/messages/${messageId}/reply`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        msg_type: "text",
        content: JSON.stringify({ text }),
      },
    },
  );

  if (response.code !== 0) {
    console.error(`Feishu reply message error: ${response.msg}`);
  }
}

/**
 * 回复飞书卡片消息（用于机器人回复）。
 */
export async function replyFeishuCardMessage(
  messageId: string,
  card: FeishuInteractiveCard,
): Promise<void> {
  const token = await getFeishuTenantAccessToken();
  const response = await $fetch<FeishuApiResponse>(
    `${FEISHU_BASE_URL}/im/v1/messages/${messageId}/reply`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        msg_type: "interactive",
        content: JSON.stringify(card),
      },
    },
  );

  if (response.code !== 0) {
    console.error(`Feishu reply card message error: ${response.msg}`);
  }
}

// ─── 飞书审批 API ─────────────────────────────────────────

/**
 * 创建飞书审批实例。
 */
export async function createFeishuApprovalInstance(params: {
  approval_code: string;
  open_id: string;
  form: Array<{ id: string; type: string; value: string }>;
}): Promise<string> {
  const token = await getFeishuTenantAccessToken();
  const response = await $fetch<FeishuApiResponse<{ instance_code: string }>>(
    `${FEISHU_BASE_URL}/approval/v4/instances`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        approval_code: params.approval_code,
        open_id: params.open_id,
        form: JSON.stringify(params.form),
      },
    },
  );

  if (response.code !== 0 || !response.data) {
    throw new Error(`Feishu create approval error: ${response.msg}`);
  }

  return response.data.instance_code;
}

/**
 * 查询飞书审批实例状态。
 */
export async function getFeishuApprovalInstance(instanceCode: string): Promise<{
  status: string;
  approve_name: string;
}> {
  const token = await getFeishuTenantAccessToken();
  const response = await $fetch<FeishuApiResponse<{
    status: string;
    approve_name: string;
  }>>(
    `${FEISHU_BASE_URL}/approval/v4/instances/${instanceCode}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (response.code !== 0 || !response.data) {
    throw new Error(`Feishu get approval error: ${response.msg}`);
  }

  return response.data;
}

// ─── 飞书事件验证 ─────────────────────────────────────────

/**
 * 验证飞书事件回调签名（v2 加密方式）。
 * 签名算法：sha256(timestamp + nonce + encrypt_key + body)
 */
export function verifyFeishuEventSignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  body: string,
  signature: string,
): boolean {
  const content = timestamp + nonce + encryptKey + body;
  const computed = createHmac("sha256", "")
    .update(content)
    .digest("hex");
  return computed === signature;
}

export async function exchangeFeishuCode(code: string): Promise<FeishuTokenResponse["data"]> {
  const appAccessToken = await getFeishuAppAccessToken();

  const response = await $fetch<FeishuTokenResponse>(
    `${FEISHU_BASE_URL}/authen/v1/oidc/access_token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appAccessToken}`,
      },
      body: {
        grant_type: "authorization_code",
        code,
      },
    },
  );

  if (response.code !== 0) {
    throw new Error(`Feishu token exchange error: ${response.msg}`);
  }

  return response.data;
}

export async function getFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
  const response = await $fetch<FeishuUserInfoResponse>(
    `${FEISHU_BASE_URL}/authen/v1/user_info`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.code !== 0) {
    throw new Error(`Feishu user info error: ${response.msg}`);
  }

  return response.data;
}

export function buildFeishuAuthUrl(state: string): string {
  const config = useRuntimeConfig();
  const redirectUri = `${config.public.appUrl}/api/auth/callback/feishu`;

  return `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${config.feishuAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}
