import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../db";
import type { H3Event } from "h3";
import { requireAuth } from "./auth";

/**
 * 验证用户是系统管理员或指定组织内任意团队的 Owner。
 * 用于组织设置等操作的访问控制。
 * 无权限时抛出 403。返回 session。
 */
export async function requireOrgOwnerOrAdmin(event: H3Event, orgId: string) {
  const session = await requireAuth(event);

  // 管理员可以操作所有组织
  if (session.user.is_admin) {
    return session;
  }

  const db = useDB();
  const ownership = await db
    .select({ role: schema.teamMembers.role })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.team_id))
    .where(
      and(
        eq(schema.teams.organization_id, orgId),
        eq(schema.teamMembers.user_id, session.user.id),
        eq(schema.teamMembers.role, "owner"),
      ),
    )
    .limit(1);

  if (ownership.length === 0) {
    throw createError({
      statusCode: 403,
      message: "Only admin or organization owner can perform this action",
    });
  }

  return session;
}
