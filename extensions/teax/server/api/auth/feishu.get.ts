import { buildFeishuAuthUrl } from "~~/server/utils/feishu-sdk";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  // 获取 redirect 参数
  const redirect = query.redirect as string | undefined;

  // 生成 state（包含 redirect 信息）
  const state = generateState(redirect);
  const authUrl = buildFeishuAuthUrl(state);
  return sendRedirect(event, authUrl);
});

function generateState(redirect?: string): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const randomHex = Array.from(random, (b: number) => b.toString(16).padStart(2, "0")).join("");

  // 如果有 redirect，编码到 state 中
  if (redirect) {
    const payload = JSON.stringify({ random: randomHex, redirect });
    return Buffer.from(payload).toString("base64url");
  }

  return randomHex;
}
