import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../db";
import type { H3Event } from "h3";
import { requireAuth } from "./auth";

/**
 * 验证用户对指定组织有访问权限（是组织内某个团队的成员）。
 * 无权限时抛出 403。返回 session。
 */
export async function requireOrgAccess(event: H3Event, orgId: string) {
  const session = await requireAuth(event);
  const db = useDB();

  // 管理员可以访问所有组织
  if (session.user.isAdmin) {
    return session;
  }

  const membership = await db
    .select({ id: schema.teamMembers.id })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId))
    .where(and(
      eq(schema.teams.organizationId, orgId),
      eq(schema.teamMembers.userId, session.user.id),
    ))
    .limit(1);

  if (membership.length === 0) {
    throw createError({
      statusCode: 403,
      message: "You do not have access to this organization",
    });
  }

  return session;
}
