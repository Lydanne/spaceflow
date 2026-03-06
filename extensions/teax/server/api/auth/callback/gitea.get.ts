import { exchangeGiteaCode, createGiteaService } from "../../../utils/gitea";
import { upsertUser } from "../../../services/auth.service";
import { syncUserOrgsAndTeams } from "../../../services/sync.service";
import { generateSessionId, registerSession } from "../../../utils/session";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Missing authorization code",
    });
  }

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

    return sendRedirect(event, "/");
  } catch (err: unknown) {
    console.error("Gitea OAuth callback error:", err);
    throw createError({
      statusCode: 500,
      message: "Authentication failed",
    });
  }
});
