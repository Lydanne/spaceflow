/**
 * 场景权限检查工具
 * 封装场景权限检查逻辑，简化 API 使用
 */

import type { H3Event } from "h3";
import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "./auth";
import { isValidPermissionFormat } from "~~/server/shared/permissions";
import { getSceneDefinition, getSceneName } from "~~/shared/scene-permissions";

interface PermissionGroupRow {
  permissions: unknown;
  repository_ids: unknown;
}

/**
 * 查询用户在指定组织中通过团队继承的所有权限组
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
 * 检查权限组行是否授予指定权限
 */
function rowGrantsPermission(row: PermissionGroupRow, permission: string, repositoryId?: string): boolean {
  const perms = row.permissions;
  if (!Array.isArray(perms)) return false;

  const hasMatchingPermission = perms.some((granted) => {
    if (typeof granted !== "string") return false;
    // 简单匹配，支持通配符
    if (granted === permission) return true;
    if (granted === "*") return true;
    // 前缀匹配：actions:* 匹配 actions:trigger
    if (granted.endsWith(":*")) {
      const prefix = granted.slice(0, -1);
      return permission.startsWith(prefix);
    }
    return false;
  });

  if (!hasMatchingPermission) return false;

  if (!repositoryId) return true;
  if (row.repository_ids === null || row.repository_ids === undefined) return true;
  if (Array.isArray(row.repository_ids)) {
    return row.repository_ids.includes(repositoryId);
  }

  return false;
}

/**
 * 获取用户在组织中的第一个团队 ID
 */
async function getUserTeamId(userId: string, orgId: string): Promise<string | undefined> {
  const db = useDB();
  const [teamMember] = await db
    .select({ team_id: schema.teamMembers.team_id })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .where(
      and(
        eq(schema.teamMembers.user_id, userId),
        eq(schema.teams.organization_id, orgId),
      ),
    )
    .limit(1);

  return teamMember?.team_id ?? undefined;
}

export interface ScenePermissionResult {
  hasPermission: boolean;
  missingPermissions: string[];
  teamId?: string;
}

/**
 * 检查用户是否拥有场景所需的所有权限（不抛出错误）
 */
export async function checkScenePermission(
  userId: string,
  orgId: string,
  sceneKey: string,
  repositoryId?: string,
): Promise<ScenePermissionResult> {
  const scene = getSceneDefinition(sceneKey);
  if (!scene) {
    return { hasPermission: false, missingPermissions: [] };
  }

  const rows = await queryUserPermissionGroups(userId, orgId);
  const missingPermissions: string[] = [];

  for (const permission of scene.permissions) {
    const hasPermission = rows.some((row) => rowGrantsPermission(row, permission, repositoryId));
    if (!hasPermission) {
      missingPermissions.push(permission);
    }
  }

  const teamId = await getUserTeamId(userId, orgId);

  return {
    hasPermission: missingPermissions.length === 0,
    missingPermissions,
    teamId,
  };
}

/**
 * 场景权限检查（一站式 API）
 *
 * 使用示例：
 * ```ts
 * await requireScenePermission(event, "preset-workflow", orgId);
 * ```
 *
 * 权限不足时抛出 403 错误，包含申请所需的完整信息
 */
export async function requireScenePermission(
  event: H3Event,
  sceneKey: string,
  orgId: string,
  repositoryId?: string,
) {
  const scene = getSceneDefinition(sceneKey);
  if (!scene) {
    throw createError({
      statusCode: 500,
      message: `Unknown scene: ${sceneKey}`,
    });
  }

  // 验证权限格式
  for (const permission of scene.permissions) {
    if (!isValidPermissionFormat(permission)) {
      throw createError({
        statusCode: 500,
        message: `Invalid permission format in scene "${sceneKey}": ${permission}`,
      });
    }
  }

  const session = await requireAuth(event);

  // 管理员拥有所有权限
  if (session.user.is_admin) {
    return session;
  }

  const result = await checkScenePermission(session.user.id, orgId, sceneKey, repositoryId);

  if (!result.hasPermission) {
    throw createError({
      statusCode: 403,
      message: `Missing permissions for scene "${getSceneName(sceneKey)}": ${result.missingPermissions.join(", ")}`,
      data: {
        code: "SCENE_PERMISSION_DENIED",
        scene_key: sceneKey,
        scene_name: scene.name,
        permissions: result.missingPermissions.join(","),
        organization_id: orgId,
        team_id: result.teamId,
        repository_id: repositoryId,
      },
    });
  }

  return session;
}
