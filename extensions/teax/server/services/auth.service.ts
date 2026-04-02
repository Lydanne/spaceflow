import { eq, count } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { GiteaUser } from "~~/server/utils/gitea";
import { encrypt, decrypt } from "~~/server/utils/crypto";

export interface GiteaTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export async function upsertUser(giteaUser: GiteaUser) {
  const db = useDB();

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.gitea_id, giteaUser.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.users)
      .set({
        gitea_username: giteaUser.login,
        email: giteaUser.email,
        avatar_url: giteaUser.avatar_url,
        updated_at: new Date(),
      })
      .where(eq(schema.users.gitea_id, giteaUser.id));

    return existing[0];
  }

  // 首次注册用户自动成为管理员
  const result = await db.select({ value: count() }).from(schema.users);
  const isFirstUser = !result[0] || result[0].value === 0;

  const [user] = await db
    .insert(schema.users)
    .values({
      gitea_id: giteaUser.id,
      gitea_username: giteaUser.login,
      email: giteaUser.email,
      avatar_url: giteaUser.avatar_url,
      is_admin: isFirstUser || giteaUser.is_admin,
    })
    .returning();

  return user;
}

/**
 * 更新用户的 Gitea token（加密存储）
 */
export async function updateUserGiteaToken(userId: string, tokens: GiteaTokens) {
  const db = useDB();
  const config = useRuntimeConfig();

  if (!config.security.tokenEncryptSecret) {
    throw new Error("TOKEN_ENCRYPT_SECRET is not configured");
  }

  const encryptedAccessToken = encrypt(tokens.accessToken, config.security.tokenEncryptSecret);
  const encryptedRefreshToken = encrypt(tokens.refreshToken, config.security.tokenEncryptSecret);

  const expiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000)
    : null;

  await db
    .update(schema.users)
    .set({
      gitea_access_token: encryptedAccessToken,
      gitea_refresh_token: encryptedRefreshToken,
      gitea_token_expires_at: expiresAt,
      updated_at: new Date(),
    })
    .where(eq(schema.users.id, userId));
}

/**
 * 获取用户的 Gitea token（解密）
 */
export async function getUserGiteaTokens(userId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const db = useDB();
  const config = useRuntimeConfig();

  if (!config.security.tokenEncryptSecret) {
    return null;
  }

  const [user] = await db
    .select({
      gitea_access_token: schema.users.gitea_access_token,
      gitea_refresh_token: schema.users.gitea_refresh_token,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user || !user.gitea_access_token || !user.gitea_refresh_token) {
    return null;
  }

  try {
    const accessToken = decrypt(user.gitea_access_token, config.security.tokenEncryptSecret);
    const refreshToken = decrypt(user.gitea_refresh_token, config.security.tokenEncryptSecret);
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}
