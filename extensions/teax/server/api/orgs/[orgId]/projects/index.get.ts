import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireAuth } from "../../../../utils/auth";
import { getVisibleProjectIds } from "../../../../utils/permission";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }
  const session = await requireAuth(event);
  const db = useDB();

  // 获取可见项目 ID（null=全部可见）
  const visibleIds = await getVisibleProjectIds(session.user.id, orgId, !!session.user.isAdmin);

  // 用户没有任何 project:view 权限 → 空列表
  if (visibleIds !== null && visibleIds.length === 0) {
    return { data: [], total: 0, page: 1, limit: 20, hasMore: false };
  }

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const whereConditions = visibleIds === null
    ? eq(schema.projects.organizationId, orgId)
    : and(eq(schema.projects.organizationId, orgId), inArray(schema.projects.id, visibleIds));

  const projectList = await db
    .select({
      id: schema.projects.id,
      organizationId: schema.projects.organizationId,
      giteaRepoId: schema.projects.giteaRepoId,
      name: schema.projects.name,
      fullName: schema.projects.fullName,
      description: schema.projects.description,
      defaultBranch: schema.projects.defaultBranch,
      cloneUrl: schema.projects.cloneUrl,
      webhookId: schema.projects.webhookId,
      settings: schema.projects.settings,
      createdBy: schema.projects.createdBy,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(whereConditions)
    .orderBy(desc(schema.projects.updatedAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.projects)
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
