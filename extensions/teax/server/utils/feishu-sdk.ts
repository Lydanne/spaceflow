import * as lark from "@larksuiteoapi/node-sdk";
import { createHmac } from "crypto";

let client: lark.Client | null = null;

export function getFeishuClient(): lark.Client {
  if (client) {
    return client;
  }

  const config = useRuntimeConfig();

  if (!config.feishuAppId || !config.feishuAppSecret) {
    throw new Error("Feishu App ID or App Secret not configured");
  }

  client = new lark.Client({
    appId: config.feishuAppId,
    appSecret: config.feishuAppSecret,
    appType: lark.AppType.SelfBuild,
    disableTokenCache: false,
  });

  return client;
}

export interface FeishuInteractiveCard {
  header?: {
    title: { tag: string; content: string };
    template?: string;
  };
  elements?: Array<{
    tag: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export async function sendFeishuMessage(
  receiveId: string,
  content: string,
  receiveIdType: "open_id" | "user_id" | "union_id" | "email" | "chat_id" = "open_id",
): Promise<{ message_id?: string }> {
  const client = getFeishuClient();

  const res = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType,
    },
    data: {
      receive_id: receiveId,
      msg_type: "text",
      content: JSON.stringify({ text: content }),
    },
  });

  if (res.code !== 0) {
    console.error("Feishu send message error:", res.code, res.msg);
    return {};
  }

  return { message_id: res.data?.message_id };
}

export async function sendFeishuCardMessage(
  receiveId: string,
  card: FeishuInteractiveCard,
  receiveIdType: "open_id" | "user_id" | "union_id" | "email" | "chat_id" = "open_id",
): Promise<{ message_id?: string }> {
  const client = getFeishuClient();

  const res = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType,
    },
    data: {
      receive_id: receiveId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    },
  });

  if (res.code !== 0) {
    console.error("Feishu send card message error:", res.code, res.msg);
    return {};
  }

  return { message_id: res.data?.message_id };
}

export async function sendFeishuChatCardMessage(
  chatId: string,
  card: FeishuInteractiveCard,
): Promise<{ message_id?: string }> {
  return sendFeishuCardMessage(chatId, card, "chat_id");
}

export async function updateCardMessage(
  messageId: string,
  card: FeishuInteractiveCard,
): Promise<void> {
  const client = getFeishuClient();

  const res = await client.im.message.patch({
    path: {
      message_id: messageId,
    },
    data: {
      content: JSON.stringify(card),
    },
  });

  if (res.code !== 0) {
    console.error("Feishu update card message error:", res.code, res.msg);
  }
}

export async function sendFeishuBatchMessage(
  receiveIds: string[],
  card: FeishuInteractiveCard,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    receiveIds.map(async (id) => {
      const result = await sendFeishuCardMessage(id, card, "open_id");
      if (result.message_id) {
        sent++;
      } else {
        failed++;
      }
    }),
  );

  return { sent, failed };
}

export async function replyFeishuMessage(
  messageId: string,
  content: string,
): Promise<void> {
  const client = getFeishuClient();

  const res = await client.im.message.reply({
    path: {
      message_id: messageId,
    },
    data: {
      msg_type: "text",
      content: JSON.stringify({ text: content }),
    },
  });

  if (res.code !== 0) {
    console.error("Feishu reply message error:", res.code, res.msg);
  }
}

export async function replyFeishuCardMessage(
  messageId: string,
  card: FeishuInteractiveCard,
): Promise<void> {
  const client = getFeishuClient();

  const res = await client.im.message.reply({
    path: {
      message_id: messageId,
    },
    data: {
      msg_type: "interactive",
      content: JSON.stringify(card),
    },
  });

  if (res.code !== 0) {
    console.error("Feishu reply card message error:", res.code, res.msg);
  }
}

export async function createFeishuApprovalInstance(params: {
  approval_code: string;
  open_id: string;
  form: Array<{ id: string; type: string; value: string }>;
}): Promise<string> {
  const client = getFeishuClient();

  const res = await client.approval.instance.create({
    data: {
      approval_code: params.approval_code,
      user_id: params.open_id,
      open_id: params.open_id,
      form: JSON.stringify(params.form),
    },
  });

  if (res.code !== 0) {
    console.error("Feishu create approval instance error:", res.code, res.msg);
    throw new Error(`Failed to create approval instance: ${res.msg}`);
  }

  return res.data?.instance_code || "";
}

export async function getFeishuApprovalInstance(instanceCode: string): Promise<{
  status: string;
  form?: string;
}> {
  const client = getFeishuClient();

  const res = await client.approval.instance.get({
    path: {
      instance_id: instanceCode,
    },
  });

  if (res.code !== 0) {
    console.error("Feishu get approval instance error:", res.code, res.msg);
    throw new Error(`Failed to get approval instance: ${res.msg}`);
  }

  return {
    status: res.data?.status || "UNKNOWN",
    form: res.data?.form,
  };
}

export function verifyFeishuEventSignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  body: string,
  signature: string,
): boolean {
  const hash = createHmac("sha256", encryptKey)
    .update(`${timestamp}${nonce}${encryptKey}${body}`)
    .digest("hex");
  return hash === signature;
}

export async function exchangeFeishuCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const config = useRuntimeConfig();
  const redirectUri = `${config.public.appUrl}/api/auth/callback/feishu`;

  // 使用飞书 OAuth 2.0 获取 user_access_token
  // 文档: https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: config.feishuAppId,
      client_secret: config.feishuAppSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Feishu exchange code HTTP error:", response.status, errorText);
    throw new Error(`Failed to exchange code: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 0) {
    console.error("Feishu exchange code error:", result.code, result.error, result.error_description, result);
    throw new Error(`Failed to exchange code: ${result.error_description || result.error || result.code}`);
  }

  // OAuth v2 API 直接返回 access_token,不在 data 字段中
  return {
    access_token: result.access_token || "",
    refresh_token: result.refresh_token || "",
    expires_in: result.expires_in || 0,
  };
}

export async function getFeishuUserInfo(accessToken: string): Promise<{
  open_id: string;
  union_id: string;
  user_id: string;
  name: string;
  en_name: string;
  avatar_url: string;
  email: string;
  mobile: string;
}> {
  // 使用 HTTP API 获取用户信息
  // 文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Feishu get user info HTTP error:", response.status, errorText);
    throw new Error(`Failed to get user info: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.code !== 0) {
    console.error("Feishu get user info error:", result.code, result.msg, result);
    throw new Error(`Failed to get user info: ${result.msg || result.code}`);
  }

  return {
    open_id: result.data?.open_id || "",
    union_id: result.data?.union_id || "",
    user_id: result.data?.user_id || "",
    name: result.data?.name || "",
    en_name: result.data?.en_name || "",
    avatar_url: result.data?.avatar_url || "",
    email: result.data?.email || "",
    mobile: result.data?.mobile || "",
  };
}

export function buildFeishuAuthUrl(state: string): string {
  const config = useRuntimeConfig();
  const redirectUri = `${config.public.appUrl}/api/auth/callback/feishu`;
  const params = new URLSearchParams({
    app_id: config.feishuAppId,
    redirect_uri: redirectUri,
    state,
  });
  return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
}
