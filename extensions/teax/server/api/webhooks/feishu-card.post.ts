import { verifyFeishuEventSignature } from "~~/server/utils/feishu-sdk";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();

  const signature = getHeader(event, "x-lark-signature");
  const timestamp = getHeader(event, "x-lark-request-timestamp");
  const nonce = getHeader(event, "x-lark-request-nonce");

  if (
    signature
    && timestamp
    && nonce
    && config.feishuEncryptKey
    && !verifyFeishuEventSignature(
      timestamp,
      nonce,
      config.feishuEncryptKey,
      JSON.stringify(body),
      signature,
    )
  ) {
    throw createError({ statusCode: 401, message: "Invalid signature" });
  }

  if (body.type === "url_verification") {
    return { challenge: body.challenge };
  }

  // 所有卡片交互现已通过飞书长连接 + CardKit 路由处理。
  // 此 webhook 仅保留 url_verification 响应。
  if (body.type === "card.action.trigger") {
    console.warn("[feishu-card webhook] Received card action via HTTP callback, all card interactions should go through long connection now.");
    return { success: true };
  }

  return { success: true };
});
