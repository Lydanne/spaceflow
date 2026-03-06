import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { H3Event } from "h3";
import { requireAuth } from "./auth";
import { VALID_PERMISSION_KEYS } from "~~/server/shared/permissions";

interface PermissionGroupRow {
  permissions: unknown;
  repository_ids: unknown;
}

/**
 * 查询用户在指定组织中通过团队继承的所有权限组。
 */
async function queryUserPermissionGroups(userId: string, orgId: string): Promise<PermissionGroupRow[]> {
  const db = useDB();

  return db
    .select({
      permissions: schema.permissionGroups.permissions,
      repository_ids: schema.permissionGroups.repository_ids,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .innerJoin(schema.teamPermissions, eq(schema.teamPermissions.team_id, schema.teams.id))
    .innerJoin(
      schema.permissionGroups,
      eq(schema.teamPermissions.permission_group_id, schema.permissionGroups.id),
    )
    .where(
      and(eq(schema.teamMembers.user_id, userId), eq(schema.teams.organization_id, orgId)),
    );
}

/**
 * 检查权限组行是否授予指定权限（含 repositoryId scope 检查）。
 * - repositoryIds 为 null → 全部仓库
 * - repositoryIds 为数组 → 仅当 repositoryId 在数组中
 */
function rowGrantsPermission(row: PermissionGroupRow, permission: string, repositoryId?: string): boolean {
  const perms = row.permissions;
  if (!Array.isArray(perms) || !perms.includes(permission)) return false;

  // 不需要仓库级 scope 检查
  if (!repositoryId) return true;

  // repository_ids 为 null 表示全部仓库
  if (row.repository_ids === null || row.repository_ids === undefined) return true;

  // repository_ids 为数组则检查包含关系
  if (Array.isArray(row.repository_ids)) {
    return row.repository_ids.includes(repositoryId);
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
 * @param repositoryId - 可选，传入时会额外检查权限组的 repositoryIds scope
 */
export async function requirePermission(event: H3Event, orgId: string, permission: string, repositoryId?: string) {
  if (!VALID_PERMISSION_KEYS.has(permission)) {
    throw createError({
      statusCode: 500,
      message: `Invalid permission key: ${permission}`,
    });
  }

  const session = await requireAuth(event);

  // 管理员拥有所有权限
  if (session.user.is_admin) {
    return session;
  }

  const rows = await queryUserPermissionGroups(session.user.id, orgId);

  const hasPermission = rows.some((row) => rowGrantsPermission(row, permission, repositoryId));

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
 * 获取用户在指定组织中可见的仓库 ID 列表。
 * 返回 null 表示全部仓库可见（管理员或权限组 repositoryIds=null）。
 * 返回 string[] 表示只能看到这些仓库。
 */
export async function getVisibleRepositoryIds(userId: string, orgId: string, isAdmin: boolean): Promise<string[] | null> {
  if (isAdmin) return null;

  const rows = await queryUserPermissionGroups(userId, orgId);

  const visibleIds = new Set<string>();

  for (const row of rows) {
    const perms = row.permissions;
    if (!Array.isArray(perms) || !perms.includes("repo:view")) continue;

    // repository_ids=null → 全部可见
    if (row.repository_ids === null || row.repository_ids === undefined) return null;

    if (Array.isArray(row.repository_ids)) {
      for (const id of row.repository_ids) {
        if (typeof id === "string") visibleIds.add(id);
      }
    }
  }

  return [...visibleIds];
}
