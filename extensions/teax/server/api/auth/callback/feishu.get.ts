import { exchangeFeishuCode, getFeishuUserInfo } from "../../../utils/feishu";
import { findUserByFeishuOpenId, bindFeishuToUser } from "../../../services/feishu.service";
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
    const tokenData = await exchangeFeishuCode(code);
    const feishuUser = await getFeishuUserInfo(tokenData.access_token);

    // 查找已绑定的 Teax 用户
    const user = await findUserByFeishuOpenId(feishuUser.open_id);

    if (!user) {
      // 未绑定 Gitea 账号，跳转到登录页提示需先绑定
      return sendRedirect(event, "/auth/login?error=feishu_not_bound");
    }

    // 更新绑定信息
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await bindFeishuToUser(user.id, feishuUser, tokenData.access_token, tokenExpiresAt);

    // 创建 session
    const sessionId = generateSessionId();
    await registerSession(user.id, sessionId, {
      userId: user.id,
      username: user.giteaUsername,
      loginAt: Date.now(),
      loginProvider: "feishu",
      ip: getRequestIP(event) || undefined,
      ua: getRequestHeader(event, "user-agent") || undefined,
    });

    await setUserSession(event, {
      user: {
        id: user.id,
        giteaId: user.giteaId,
        username: user.giteaUsername,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      },
      sessionId,
      giteaAccessToken: "",
    });

    return sendRedirect(event, "/");
  } catch (err: unknown) {
    console.error("Feishu OAuth callback error:", err);
    throw createError({
      statusCode: 500,
      message: "Feishu authentication failed",
    });
  }
});
