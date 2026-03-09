import { exchangeFeishuCode, getFeishuUserInfo } from "~~/server/utils/feishu-sdk";
import { findUserByFeishuOpenId, bindFeishuToUser } from "~~/server/services/feishu.service";
import { generateSessionId, registerSession } from "~~/server/utils/session";

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
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // 检查当前用户是否已登录
    const session = await getUserSession(event);

    if (session.user) {
      // 用户已登录,直接绑定飞书账号到当前用户
      await bindFeishuToUser(
        session.user.id,
        feishuUser,
        tokenData.access_token,
        tokenExpiresAt,
        tokenData.refresh_token,
      );

      // 绑定成功,跳转回设置页面
      return sendRedirect(event, "/user/settings?success=feishu_bound");
    }

    // 用户未登录,查找是否已有绑定记录
    const user = await findUserByFeishuOpenId(feishuUser.open_id);

    if (!user) {
      // 未绑定 Gitea 账号,跳转到登录页提示需先绑定
      return sendRedirect(event, "/auth/login?error=feishu_not_bound");
    }

    // 已有绑定记录,更新绑定信息并登录
    await bindFeishuToUser(
      user.id,
      feishuUser,
      tokenData.access_token,
      tokenExpiresAt,
      tokenData.refresh_token,
    );

    // 创建 session
    const sessionId = generateSessionId();
    await registerSession(user.id, sessionId, {
      user_id: user.id,
      username: user.gitea_username,
      login_at: Date.now(),
      login_provider: "feishu",
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
