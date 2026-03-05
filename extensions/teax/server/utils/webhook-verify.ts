import { createHmac, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";

/**
 * 验证 Gitea Webhook 的 HMAC-SHA256 签名。
 * Gitea 使用 X-Gitea-Signature header 携带签名。
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf-8");
  const signatureBuf = Buffer.from(signature, "utf-8");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return cryptoTimingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * 从 H3Event 中读取并验证 Webhook 签名。
 * 验证失败时抛出 401。
 */
export async function requireWebhookSignature(event: H3Event, secret: string): Promise<string> {
  const signature = getRequestHeader(event, "x-gitea-signature");
  if (!signature) {
    throw createError({
      statusCode: 401,
      message: "Missing webhook signature",
    });
  }

  const body = await readRawBody(event, "utf-8");
  if (!body) {
    throw createError({
      statusCode: 400,
      message: "Empty request body",
    });
  }

  if (!verifyWebhookSignature(body, secret, signature)) {
    throw createError({
      statusCode: 401,
      message: "Invalid webhook signature",
    });
  }

  return body;
}

/**
 * 生成随机 Webhook secret。
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}
