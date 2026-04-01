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

  // 不能删除自己
  if (userId === session.user.id) {
    throw createError({ statusCode: 400, message: "Cannot delete yourself" });
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  // 删除关联数据（user_feishu 有 onDelete: cascade，team_members 需要手动清理）
  await db.delete(schema.teamMembers).where(eq(schema.teamMembers.user_id, userId));
  await db.delete(schema.userFeishu).where(eq(schema.userFeishu.user_id, userId));

  // 删除用户
  await db.delete(schema.users).where(eq(schema.users.id, userId));

  return { success: true, message: `用户 ${user.gitea_username} 已删除` };
});
