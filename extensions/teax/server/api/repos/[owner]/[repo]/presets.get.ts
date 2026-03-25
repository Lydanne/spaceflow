import { useDB, schema } from "~~/server/db";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import { and, eq, isNull, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requireAuth(event);
  const db = useDB();

  // 获取组织公开预设（is_public=true 且属于当前仓库）
  // 不限制 organization_id，因为旧数据可能没有设置
  const orgPresets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      workflow_path: schema.workflowPresets.workflow_path,
      branch: schema.workflowPresets.branch,
      share_token: schema.workflowPresets.share_token,
      is_public: schema.workflowPresets.is_public,
      created_by: schema.workflowPresets.created_by,
      created_at: schema.workflowPresets.created_at,
      // creator info
      creator_name: schema.users.gitea_username,
      creator_username: schema.users.gitea_username,
      creator_avatar: schema.users.avatar_url,
    })
    .from(schema.workflowPresets)
    .leftJoin(schema.users, eq(schema.workflowPresets.created_by, schema.users.id))
    .where(
      and(
        eq(schema.workflowPresets.repository_id, repoId),
        eq(schema.workflowPresets.is_public, true),
        isNull(schema.workflowPresets.group_id), // 只查独立预设
      ),
    )
    .orderBy(desc(schema.workflowPresets.created_at));

  // 获取我的预设（created_by=当前用户 且属于当前仓库）
  // 包括公开和私有的，不限制 organization_id（因为旧数据可能没有设置）
  const myPresets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      workflow_path: schema.workflowPresets.workflow_path,
      branch: schema.workflowPresets.branch,
      share_token: schema.workflowPresets.share_token,
      is_public: schema.workflowPresets.is_public,
      organization_id: schema.workflowPresets.organization_id,
      created_at: schema.workflowPresets.created_at,
    })
    .from(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.repository_id, repoId),
        eq(schema.workflowPresets.created_by, session.user.id),
        isNull(schema.workflowPresets.group_id), // 只查独立预设
      ),
    )
    .orderBy(desc(schema.workflowPresets.created_at));

  // 获取预设组（属于当前仓库）
  const presetGroups = await db
    .select({
      id: schema.workflowPresetGroups.id,
      name: schema.workflowPresetGroups.name,
      description: schema.workflowPresetGroups.description,
      workflow_path: schema.workflowPresetGroups.workflow_path,
      default_branch: schema.workflowPresetGroups.default_branch,
      share_token: schema.workflowPresetGroups.share_token,
      is_public: schema.workflowPresetGroups.is_public,
      created_by: schema.workflowPresetGroups.created_by,
      created_at: schema.workflowPresetGroups.created_at,
      // creator info
      creator_name: schema.users.gitea_username,
      creator_username: schema.users.gitea_username,
      creator_avatar: schema.users.avatar_url,
    })
    .from(schema.workflowPresetGroups)
    .leftJoin(schema.users, eq(schema.workflowPresetGroups.created_by, schema.users.id))
    .where(eq(schema.workflowPresetGroups.repository_id, repoId))
    .orderBy(desc(schema.workflowPresetGroups.created_at));

  return {
    org_presets: orgPresets.map((p) => ({
      id: p.id,
      name: p.name,
      workflow_path: p.workflow_path,
      branch: p.branch,
      share_token: p.share_token,
      is_public: p.is_public,
      created_by: p.created_by,
      creator: p.creator_username
        ? {
            name: p.creator_name,
            username: p.creator_username,
            avatar_url: p.creator_avatar,
          }
        : null,
      created_at: p.created_at,
    })),
    my_presets: myPresets.map((p) => ({
      id: p.id,
      name: p.name,
      workflow_path: p.workflow_path,
      branch: p.branch,
      share_token: p.share_token,
      is_public: p.is_public ?? false,
      organization_id: p.organization_id,
      created_at: p.created_at,
    })),
    preset_groups: presetGroups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      workflow_path: g.workflow_path,
      default_branch: g.default_branch,
      share_token: g.share_token,
      is_public: g.is_public,
      created_by: g.created_by,
      creator: g.creator_username
        ? {
            name: g.creator_name,
            username: g.creator_username,
            avatar_url: g.creator_avatar,
          }
        : null,
      created_at: g.created_at,
    })),
  };
});
