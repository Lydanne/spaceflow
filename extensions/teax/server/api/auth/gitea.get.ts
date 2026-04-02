export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);

  // 获取 redirect 参数
  const redirect = query.redirect as string | undefined;

  // 生成 state（包含 redirect 信息）
  const state = generateState(redirect);

  const redirectUri = `${config.public.appUrl}/api/auth/callback/gitea`;
  const authUrl = `${config.gitea.url}/login/oauth/authorize?client_id=${config.gitea.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;

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
