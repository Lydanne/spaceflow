import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireAdmin } from "../../../../utils/auth";

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
      isAdmin: !user.isAdmin,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning({
      id: schema.users.id,
      giteaId: schema.users.giteaId,
      giteaUsername: schema.users.giteaUsername,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      isAdmin: schema.users.isAdmin,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    });

  return updated;
});
