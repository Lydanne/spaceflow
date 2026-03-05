import { eq, count } from "drizzle-orm";
import { useDB, schema } from "../db";
import type { GiteaUser } from "../utils/gitea";

export async function upsertUser(giteaUser: GiteaUser) {
  const db = useDB();

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.giteaId, giteaUser.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.users)
      .set({
        giteaUsername: giteaUser.login,
        email: giteaUser.email,
        avatarUrl: giteaUser.avatar_url,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.giteaId, giteaUser.id));

    return existing[0];
  }

  // 首次注册用户自动成为管理员
  const result = await db.select({ value: count() }).from(schema.users);
  const isFirstUser = !result[0] || result[0].value === 0;

  const [user] = await db
    .insert(schema.users)
    .values({
      giteaId: giteaUser.id,
      giteaUsername: giteaUser.login,
      email: giteaUser.email,
      avatarUrl: giteaUser.avatar_url,
      isAdmin: isFirstUser || giteaUser.is_admin,
    })
    .returning();

  return user;
}
