import { exchangeGiteaCode, createGiteaService } from "~~/server/utils/gitea";
import { upsertUser, updateUserGiteaToken } from "~~/server/services/auth.service";
import { syncUserOrgsAndTeams } from "~~/server/services/sync.service";
import { generateSessionId, registerSession } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string | undefined;

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Missing authorization code",
    });
  }

  // 解析 state 中的 redirect
  const redirect = parseState(state);

  try {
    const tokenResponse = await exchangeGiteaCode(code);
    const gitea = createGiteaService(tokenResponse.access_token);
    const giteaUser = await gitea.getCurrentUser();

    const user = await upsertUser(giteaUser);
    if (!user) {
      throw createError({
        statusCode: 500,
        message: "Failed to create or update user",
      });
    }

    // 存储 Gitea token 到 DB（加密）
    await updateUserGiteaToken(user.id, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
    });

    const sessionId = generateSessionId();
    await registerSession(user.id, sessionId, {
      user_id: user.id,
      username: user.gitea_username,
      login_at: Date.now(),
      login_provider: "gitea",
      ip: getRequestIP(event) || undefined,
      ua: getRequestHeader(event, "user-agent") || undefined,
    });

    await setUserSession(event, {
      user: {
        id: user.id,
        gitea_id: user.gitea_id,
        username: user.gitea_username,
        email: user.email,
        avatar_url: user.avatar_url,
        is_admin: user.is_admin,
      },
      sessionId,
      giteaAccessToken: tokenResponse.access_token,
      giteaRefreshToken: tokenResponse.refresh_token,
    });

    // 后台异步同步组织和团队
    syncUserOrgsAndTeams(user.gitea_username).catch((err) => {
      console.error("Failed to sync orgs and teams:", err);
    });

    // 跳转到原页面或首页
    return sendRedirect(event, redirect || "/");
  } catch (err: unknown) {
    console.error("Gitea OAuth callback error:", err);
    throw createError({
      statusCode: 500,
      message: "Authentication failed",
    });
  }
});

/**
 * 解析 state 参数，提取 redirect
 */
function parseState(state?: string): string | null {
  if (!state) return null;

  try {
    // 尝试解码 base64url
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const payload = JSON.parse(decoded);
    return payload.redirect || null;
  } catch {
    // 旧格式：纯随机字符串
    return null;
  }
}
