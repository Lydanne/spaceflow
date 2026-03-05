import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../db";
import type { H3Event } from "h3";
import { requireAuth } from "./auth";
import { VALID_PERMISSION_KEYS } from "../shared/permissions";

/**
 * 细粒度权限校验中间件。
 * 检查用户在指定组织中是否拥有给定权限。
 *
 * 判定逻辑：
 * 1. 权限 key 不合法 → 500
 * 2. 系统管理员 → 直接放行
 * 3. 查询用户所在团队 → 团队已分配的权限组 → 权限组中包含目标权限 → 放行
 * 4. 否则 → 403
 */
export async function requirePermission(event: H3Event, orgId: string, permission: string) {
  if (!VALID_PERMISSION_KEYS.has(permission)) {
    throw createError({
      statusCode: 500,
      message: `Invalid permission key: ${permission}`,
    });
  }

  const session = await requireAuth(event);

  // 管理员拥有所有权限
  if (session.user.isAdmin) {
    return session;
  }

  const db = useDB();

  // 查询用户在该组织中通过团队继承的所有权限
  const results = await db
    .select({
      permissions: schema.permissionGroups.permissions,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .innerJoin(schema.teamPermissions, eq(schema.teamPermissions.teamId, schema.teams.id))
    .innerJoin(
      schema.permissionGroups,
      eq(schema.teamPermissions.permissionGroupId, schema.permissionGroups.id),
    )
    .where(
      and(eq(schema.teamMembers.userId, session.user.id), eq(schema.teams.organizationId, orgId)),
    );

  // 检查是否有任意权限组包含目标权限
  const hasPermission = results.some((row) => {
    const perms = row.permissions;
    if (Array.isArray(perms)) {
      return perms.includes(permission);
    }
    return false;
  });

  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      message: `Missing permission: ${permission}`,
    });
  }

  return session;
}

/**
 * 获取用户在指定组织中拥有的所有权限列表。
 * 用于前端展示当前用户可操作的功能。
 */
export async function getUserPermissions(userId: string, orgId: string): Promise<string[]> {
  const db = useDB();

  const results = await db
    .select({
      permissions: schema.permissionGroups.permissions,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .innerJoin(schema.teamPermissions, eq(schema.teamPermissions.teamId, schema.teams.id))
    .innerJoin(
      schema.permissionGroups,
      eq(schema.teamPermissions.permissionGroupId, schema.permissionGroups.id),
    )
    .where(and(eq(schema.teamMembers.userId, userId), eq(schema.teams.organizationId, orgId)));

  const allPerms = new Set<string>();
  for (const row of results) {
    const perms = row.permissions;
    if (Array.isArray(perms)) {
      for (const p of perms) {
        if (typeof p === "string") {
          allPerms.add(p);
        }
      }
    }
  }

  return [...allPerms];
}
