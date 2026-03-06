import { eq, count } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { GiteaUser } from "~~/server/utils/gitea";

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
