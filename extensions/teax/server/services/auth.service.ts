import { eq } from "drizzle-orm";
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
        isAdmin: giteaUser.is_admin,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.giteaId, giteaUser.id));

    return existing[0];
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      giteaId: giteaUser.id,
      giteaUsername: giteaUser.login,
      email: giteaUser.email,
      avatarUrl: giteaUser.avatar_url,
      isAdmin: giteaUser.is_admin,
    })
    .returning();

  return user;
}
