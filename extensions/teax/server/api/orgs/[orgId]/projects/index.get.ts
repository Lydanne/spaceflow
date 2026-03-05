import { eq, desc, sql } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireOrgAccess } from "../../../../utils/org-access";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }
  await requireOrgAccess(event, orgId);
  const db = useDB();

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

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
    .where(eq(schema.projects.organizationId, orgId))
    .orderBy(desc(schema.projects.updatedAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.projects)
    .where(eq(schema.projects.organizationId, orgId));

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    data: projectList,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
});
