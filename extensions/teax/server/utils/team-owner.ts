import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { H3Event } from "h3";
import { requireAuth } from "./auth";

/**
 * 验证用户是系统管理员或指定团队的 Owner。
 * 用于团队权限分配等操作的访问控制。
 * 无权限时抛出 403。返回 session。
 */
export async function requireTeamOwnerOrAdmin(event: H3Event, teamId: string) {
  const session = await requireAuth(event);

  // 管理员可以操作所有团队
  if (session.user.is_admin) {
    return session;
  }

  const db = useDB();
  const membership = await db
    .select({ role: schema.teamMembers.role })
    .from(schema.teamMembers)
    .where(
      and(eq(schema.teamMembers.team_id, teamId), eq(schema.teamMembers.user_id, session.user.id)),
    )
    .limit(1);

  const member = membership[0];
  if (!member || member.role !== "owner") {
    throw createError({
      statusCode: 403,
      message: "Only admin or team owner can perform this action",
    });
  }

  return session;
}
