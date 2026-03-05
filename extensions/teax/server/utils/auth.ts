import type { H3Event } from "h3";

interface AuthUser {
  id: string;
  giteaId: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean | null;
}

interface AuthSession {
  user: AuthUser;
  sessionId: string;
  giteaAccessToken: string;
}

/**
 * 要求用户已登录，返回 session 信息。
 * 未登录时抛出 401。
 */
export async function requireAuth(event: H3Event): Promise<AuthSession> {
  const session = await getUserSession(event);
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: "Authentication required",
    });
  }
  return session as unknown as AuthSession;
}

/**
 * 要求用户为系统管理员。
 * 非管理员抛出 403。
 */
export async function requireAdmin(event: H3Event): Promise<AuthSession> {
  const session = await requireAuth(event);
  if (!session.user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Admin access required",
    });
  }
  return session;
}
