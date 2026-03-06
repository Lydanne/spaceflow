import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event);
  const db = useDB();
  const userId = getRouterParam(event, "userId");

  if (!userId) {
    throw createError({ statusCode: 400, message: "Missing userId" });
  }

  // 不能修改自己的管理员状态
  if (userId === session.user.id) {
    throw createError({ statusCode: 400, message: "Cannot modify your own admin status" });
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  const [updated] = await db
    .update(schema.users)
    .set({
      is_admin: !user.is_admin,
      updated_at: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning({
      id: schema.users.id,
      gitea_id: schema.users.gitea_id,
      gitea_username: schema.users.gitea_username,
      email: schema.users.email,
      avatar_url: schema.users.avatar_url,
      is_admin: schema.users.is_admin,
      created_at: schema.users.created_at,
      updated_at: schema.users.updated_at,
    });

  return updated;
});
