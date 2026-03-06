import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { getVisibleRepositoryIds } from "~~/server/utils/permission";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const session = await requireAuth(event);
  const db = useDB();

  // 获取可见项目 ID（null=全部可见）
  const visibleIds = await getVisibleRepositoryIds(session.user.id, orgId, !!session.user.is_admin);

  // 用户没有任何 project:view 权限 → 空列表
  if (visibleIds !== null && visibleIds.length === 0) {
    return { data: [], total: 0, page: 1, limit: 20, hasMore: false };
  }

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const whereConditions = visibleIds === null
    ? eq(schema.repositories.organization_id, orgId)
    : and(eq(schema.repositories.organization_id, orgId), inArray(schema.repositories.id, visibleIds));

  const projectList = await db
    .select({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
      gitea_repo_id: schema.repositories.gitea_repo_id,
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
      description: schema.repositories.description,
      default_branch: schema.repositories.default_branch,
      clone_url: schema.repositories.clone_url,
      webhook_id: schema.repositories.webhook_id,
      settings: schema.repositories.settings,
      created_by: schema.repositories.created_by,
      created_at: schema.repositories.created_at,
      updated_at: schema.repositories.updated_at,
    })
    .from(schema.repositories)
    .where(whereConditions)
    .orderBy(desc(schema.repositories.updated_at))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.repositories)
    .where(whereConditions);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    data: projectList,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
});
