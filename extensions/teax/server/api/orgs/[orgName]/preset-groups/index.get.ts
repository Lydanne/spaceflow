import { and, desc, eq, or } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveOrgId } from "~~/server/utils/resolve-org";

/**
 * 获取组织内公开的预设组列表
 * - 管理员可看到所有预设组（包括未公开的）
 * - 普通成员只能看到公开的预设组
 */
export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const session = event.context.user;
  const db = useDB();

  // 检查是否是管理员
  const [orgMember] = await db
    .select({ role: schema.teamMembers.role })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .where(eq(schema.teams.organization_id, orgId))
    .limit(1);

  const isAdmin = session?.is_admin === true || orgMember?.role === "owner";

  // 构建查询条件
  const conditions = [eq(schema.workflowPresetGroups.organization_id, orgId)];

  // 非管理员只能看公开的
  if (!isAdmin) {
    conditions.push(eq(schema.workflowPresetGroups.is_public, true));
  }

  const groups = await db
    .select({
      id: schema.workflowPresetGroups.id,
      name: schema.workflowPresetGroups.name,
      description: schema.workflowPresetGroups.description,
      workflow_path: schema.workflowPresetGroups.workflow_path,
      default_branch: schema.workflowPresetGroups.default_branch,
      share_token: schema.workflowPresetGroups.share_token,
      is_public: schema.workflowPresetGroups.is_public,
      created_at: schema.workflowPresetGroups.created_at,
      created_by: schema.workflowPresetGroups.created_by,
      repository: {
        id: schema.repositories.id,
        full_name: schema.repositories.full_name,
      },
      creator: {
        id: schema.users.id,
        gitea_username: schema.users.gitea_username,
        avatar_url: schema.users.avatar_url,
      },
    })
    .from(schema.workflowPresetGroups)
    .innerJoin(
      schema.repositories,
      eq(schema.workflowPresetGroups.repository_id, schema.repositories.id),
    )
    .innerJoin(
      schema.users,
      eq(schema.workflowPresetGroups.created_by, schema.users.id),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.workflowPresetGroups.created_at));

  return { data: groups };
});
