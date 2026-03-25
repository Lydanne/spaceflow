import { and, desc, eq, isNull, or } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveOrgId } from "~~/server/utils/resolve-org";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";

/**
 * 获取组织内公开的预设列表
 * - 管理员可看到所有预设（包括未公开的）
 * - 普通成员只能看到公开的预设
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
  const conditions = [eq(schema.workflowPresets.organization_id, orgId), isNull(schema.workflowPresets.group_id)];

  // 非管理员只能看公开的
  if (!isAdmin) {
    conditions.push(eq(schema.workflowPresets.is_public, true));
  }

  const presets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      workflow_path: schema.workflowPresets.workflow_path,
      branch: schema.workflowPresets.branch,
      share_token: schema.workflowPresets.share_token,
      is_public: schema.workflowPresets.is_public,
      created_at: schema.workflowPresets.created_at,
      created_by: schema.workflowPresets.created_by,
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
    .from(schema.workflowPresets)
    .innerJoin(
      schema.repositories,
      eq(schema.workflowPresets.repository_id, schema.repositories.id),
    )
    .innerJoin(
      schema.users,
      eq(schema.workflowPresets.created_by, schema.users.id),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.workflowPresets.created_at));

  return { data: presets };
});
