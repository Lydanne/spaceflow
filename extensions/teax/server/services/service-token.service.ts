import { eq } from "drizzle-orm";
import { useDB, schema } from "../db";
import { createGiteaService } from "../utils/gitea";
import { encrypt, decrypt } from "../utils/crypto";

const SERVICE_TOKEN_NAME = "teax-service";
const SERVICE_TOKEN_SCOPES = [
  "read:repository",
  "write:repository",
  "read:organization",
  "read:user",
];

/**
 * 管理员登录时调用：确保全局 service token 存在。
 * 1. 检查本地 DB 是否已有该管理员的 service token 且有效
 *    - 有效 → 更新验证时间，结束
 *    - 无效或不存在 → 创建新 PAT
 * 2. 将 PAT 加密存储到 service_tokens 表（按 giteaUsername 唯一）
 */
export async function ensureServiceToken(accessToken: string, userId: string, username: string) {
  const config = useRuntimeConfig();
  const db = useDB();
  const gitea = createGiteaService(accessToken);

  // 检查本地 DB 是否已有有效的 service token
  const [existing] = await db
    .select()
    .from(schema.serviceTokens)
    .where(eq(schema.serviceTokens.giteaUsername, username))
    .limit(1);

  if (existing) {
    // 验证 token 是否还能用
    try {
      const decryptedToken = decrypt(existing.encryptedToken, config.serviceTokenSecret);
      const testGitea = createGiteaService(decryptedToken);
      await testGitea.getCurrentUser();
      // token 有效，更新验证时间
      await db
        .update(schema.serviceTokens)
        .set({ verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.serviceTokens.id, existing.id));
      return;
    } catch {
      // token 无效，删除本地记录，下面会重新创建
      await db.delete(schema.serviceTokens).where(eq(schema.serviceTokens.id, existing.id));
    }
  }

  // 检查 Gitea 侧是否已有同名 PAT，有则先删除
  try {
    const tokens = await gitea.listAccessTokens(username);
    const existingToken = tokens.find((t) => t.name === SERVICE_TOKEN_NAME);
    if (existingToken) {
      await gitea.deleteAccessToken(username, existingToken.id);
    }
  } catch (err) {
    console.error("Failed to list/delete existing tokens:", err);
  }

  // 创建新的 PAT
  try {
    const newToken = await gitea.createAccessToken(
      username,
      SERVICE_TOKEN_NAME,
      SERVICE_TOKEN_SCOPES,
    );

    const encryptedToken = encrypt(newToken.sha1, config.serviceTokenSecret);

    await db
      .insert(schema.serviceTokens)
      .values({
        encryptedToken,
        giteaUsername: username,
        tokenHint: `****${newToken.token_last_eight}`,
        createdBy: userId,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.serviceTokens.giteaUsername],
        set: {
          encryptedToken,
          tokenHint: `****${newToken.token_last_eight}`,
          createdBy: userId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    console.log(`Service token created for admin: ${username}`);
  } catch (err) {
    console.error(`Failed to create service token for admin ${username}:`, err);
  }
}

/**
 * 获取全局 service token（解密后的明文）。
 * 找不到或解密失败返回 null。
 */
export async function getServiceToken(): Promise<string | null> {
  const config = useRuntimeConfig();
  const db = useDB();

  const [record] = await db.select().from(schema.serviceTokens).limit(1);

  if (!record) return null;

  try {
    return decrypt(record.encryptedToken, config.serviceTokenSecret);
  } catch {
    console.error("Failed to decrypt service token");
    return null;
  }
}
