import { isSessionValid } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  // 只对 API 路由做 session 验证，排除 auth 相关路径
  const path = getRequestURL(event).pathname;
  if (path.startsWith("/api/auth/") || !path.startsWith("/api/")) {
    return;
  }

  const session = await getUserSession(event);
  if (!session?.user?.id || !session?.sessionId) {
    return;
  }

  const valid = await isSessionValid(session.user.id, session.sessionId);
  if (!valid) {
    await clearUserSession(event);
    throw createError({
      statusCode: 401,
      message: "Session expired or revoked",
    });
  }
});
