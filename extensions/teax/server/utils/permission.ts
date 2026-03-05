import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../db";
import type { H3Event } from "h3";
import { requireAuth } from "./auth";
import { VALID_PERMISSION_KEYS } from "../shared/permissions";

interface PermissionGroupRow {
  permissions: unknown;
  projectIds: unknown;
}

/**
 * 查询用户在指定组织中通过团队继承的所有权限组。
 */
async function queryUserPermissionGroups(userId: string, orgId: string): Promise<PermissionGroupRow[]> {
  const db = useDB();

  return db
    .select({
      permissions: schema.permissionGroups.permissions,
      projectIds: schema.permissionGroups.projectIds,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .innerJoin(schema.teamPermissions, eq(schema.teamPermissions.teamId, schema.teams.id))
    .innerJoin(
      schema.permissionGroups,
      eq(schema.teamPermissions.permissionGroupId, schema.permissionGroups.id),
    )
    .where(
      and(eq(schema.teamMembers.userId, userId), eq(schema.teams.organizationId, orgId)),
    );
}

/**
 * 检查权限组行是否授予指定权限（含 projectId scope 检查）。
 * - projectIds 为 null → 全部项目
 * - projectIds 为数组 → 仅当 projectId 在数组中
 */
function rowGrantsPermission(row: PermissionGroupRow, permission: string, projectId?: string): boolean {
  const perms = row.permissions;
  if (!Array.isArray(perms) || !perms.includes(permission)) return false;

  // 不需要项目级 scope 检查
  if (!projectId) return true;

  // projectIds 为 null 表示全部项目
  if (row.projectIds === null || row.projectIds === undefined) return true;

  // projectIds 为数组则检查包含关系
  if (Array.isArray(row.projectIds)) {
    return row.projectIds.includes(projectId);
  }

  return false;
}

/**
 * 细粒度权限校验中间件。
 * 检查用户在指定组织中是否拥有给定权限。
 *
 * 判定逻辑：
 * 1. 权限 key 不合法 → 500
 * 2. 系统管理员 → 直接放行
 * 3. 查询用户所在团队 → 团队已分配的权限组 → 权限组中包含目标权限 + scope 匹配 → 放行
 * 4. 否则 → 403
 *
 * @param projectId - 可选，传入时会额外检查权限组的 projectIds scope
 */
export async function requirePermission(event: H3Event, orgId: string, permission: string, projectId?: string) {
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

  const rows = await queryUserPermissionGroups(session.user.id, orgId);

  const hasPermission = rows.some((row) => rowGrantsPermission(row, permission, projectId));

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
  const rows = await queryUserPermissionGroups(userId, orgId);

  const allPerms = new Set<string>();
  for (const row of rows) {
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

/**
 * 获取用户在指定组织中可见的项目 ID 列表。
 * 返回 null 表示全部项目可见（管理员或权限组 projectIds=null）。
 * 返回 string[] 表示只能看到这些项目。
 */
export async function getVisibleProjectIds(userId: string, orgId: string, isAdmin: boolean): Promise<string[] | null> {
  if (isAdmin) return null;

  const rows = await queryUserPermissionGroups(userId, orgId);

  const visibleIds = new Set<string>();

  for (const row of rows) {
    const perms = row.permissions;
    if (!Array.isArray(perms) || !perms.includes("project:view")) continue;

    // projectIds=null → 全部可见
    if (row.projectIds === null || row.projectIds === undefined) return null;

    if (Array.isArray(row.projectIds)) {
      for (const id of row.projectIds) {
        if (typeof id === "string") visibleIds.add(id);
      }
    }
  }

  return [...visibleIds];
}
