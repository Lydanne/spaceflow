import type { H3Event } from "h3";
import { createGiteaService, refreshGiteaToken } from "./gitea";
import type { GiteaService } from "./gitea";

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
  if (!session.user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Admin access required",
    });
  }
  return session;
}

/**
 * 创建带自动 token 刷新能力的 GiteaService。
 * 先用当前 access_token 创建 service，如果调用 Gitea API 时返回 401，
 * 自动使用 refresh_token 换取新 token 并更新 session。
 */
export async function createGiteaServiceWithRefresh(
  event: H3Event,
  session: AuthSession,
): Promise<GiteaService> {
  const gitea = createGiteaService(session.giteaAccessToken);

  try {
    await gitea.getCurrentUser();
    return gitea;
  } catch (err: unknown) {
    const status =
      (err as { statusCode?: number })?.statusCode || (err as { status?: number })?.status;
    if (status !== 401 || !session.giteaRefreshToken) {
      throw err;
    }
  }

  try {
    const tokenResponse = await refreshGiteaToken(session.giteaRefreshToken);
    await setUserSession(event, {
      ...session,
      giteaAccessToken: tokenResponse.access_token,
      giteaRefreshToken: tokenResponse.refresh_token,
    });
    return createGiteaService(tokenResponse.access_token);
  } catch {
    throw createError({
      statusCode: 401,
      message: "Gitea token 已过期且无法自动刷新，请重新登录",
    });
  }
}
