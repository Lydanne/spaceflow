import type { H3Event } from "h3";

interface AuthUser {
  id: string;
  gitea_id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean | null;
}

interface AuthSession {
  user: AuthUser;
  sessionId: string;
  giteaAccessToken: string;
  giteaRefreshToken: string;
}

/**
 * 要求用户已登录，返回 session 信息。
 * 未登录时抛出 401。
 */
export async function requireAuth(event: H3Event): Promise<AuthSession> {
  const session = (await getUserSession(event)) as unknown as AuthSession | null;
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: "Authentication required",
    });
  }
  return session;
}

/**
 * 要求用户为系统管理员。
 * 非管理员抛出 403。
 */
export async function requireAdmin(event: H3Event): Promise<AuthSession> {
  const session = await requireAuth(event);
  if (!session.user.is_admin) {
    throw createError({
      statusCode: 403,
      message: "Admin access required",
    });
  }
  return session;
}
