import { eq, and, desc, sql } from "drizzle-orm";
import { useDB, schema } from "../../../../../../db";
import { requireOrgAccess } from "../../../../../../utils/org-access";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }
  await requireOrgAccess(event, orgId);
  const db = useDB();

  // 验证项目存在且属于该组织
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const status = query.status as string | undefined;

  const conditions = [eq(schema.publishTasks.projectId, projectId)];
  if (status) {
    conditions.push(eq(schema.publishTasks.status, status));
  }

  const tasks = await db
    .select({
      id: schema.publishTasks.id,
      projectId: schema.publishTasks.projectId,
      branch: schema.publishTasks.branch,
      commitSha: schema.publishTasks.commitSha,
      commitMessage: schema.publishTasks.commitMessage,
      triggeredBy: schema.publishTasks.triggeredBy,
      triggerType: schema.publishTasks.triggerType,
      status: schema.publishTasks.status,
      startedAt: schema.publishTasks.startedAt,
      finishedAt: schema.publishTasks.finishedAt,
      duration: schema.publishTasks.duration,
      createdAt: schema.publishTasks.createdAt,
      triggeredByUsername: schema.users.giteaUsername,
    })
    .from(schema.publishTasks)
    .leftJoin(schema.users, eq(schema.publishTasks.triggeredBy, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.publishTasks.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.publishTasks)
    .where(and(...conditions));

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    data: tasks,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
});
