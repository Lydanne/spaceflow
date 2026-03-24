import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { consumeFeishuSelectToken } from "~~/server/utils/feishu-select-token";
import { getUserGiteaTokens } from "~~/server/services/auth.service";
import { generateSessionId, registerSession } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { token, user_id } = body as { token: string; user_id: string };

  if (!token || !user_id) {
    throw createError({
      statusCode: 400,
      message: "Missing token or user_id",
    });
  }

  // 消费 token（一次性使用）
  const data = await consumeFeishuSelectToken(token);
  if (!data) {
    throw createError({
      statusCode: 400,
      message: "Invalid or expired token",
    });
  }

  // 验证选择的用户确实在 token 对应的列表中
  if (!data.userIds.includes(user_id)) {
    throw createError({
      statusCode: 403,
      message: "User not in selection list",
    });
  }

  // 获取用户信息
  const db = useDB();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user_id))
    .limit(1);

  if (!user) {
    throw createError({
      statusCode: 404,
      message: "User not found",
    });
  }

  // 从 DB 获取用户的 Gitea token
  const giteaTokens = await getUserGiteaTokens(user.id);

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
    giteaAccessToken: giteaTokens?.accessToken || "",
    giteaRefreshToken: giteaTokens?.refreshToken || "",
  });

  return { success: true, redirect: data.redirect || "/" };
});
