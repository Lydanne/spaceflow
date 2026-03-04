import { exchangeGiteaCode, createGiteaService } from "../../../utils/gitea";
import { upsertUser } from "../../../services/auth.service";
import { syncUserOrgsAndTeams } from "../../../services/sync.service";

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

    await setUserSession(event, {
      user: {
        id: user.id,
        giteaId: user.giteaId,
        username: user.giteaUsername,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      },
      giteaAccessToken: tokenResponse.access_token,
    });

    // 后台异步同步组织和团队
    syncUserOrgsAndTeams(tokenResponse.access_token, user.id).catch((err) => {
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
