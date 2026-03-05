import { eq, and, asc, gt } from "drizzle-orm";
import { useDB, schema } from "../../../../../../../db";
import { requireOrgAccess } from "../../../../../../../utils/org-access";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  const taskId = getRouterParam(event, "taskId");
  if (!orgId || !projectId || !taskId) {
    throw createError({ statusCode: 400, message: "Missing required parameters" });
  }
  await requireOrgAccess(event, orgId);
  const db = useDB();

  // 验证项目
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const query = getQuery(event);
  const cursor = query.cursor ? Number(query.cursor) : 0;
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));

  const conditions = [eq(schema.publishTaskLogs.taskId, taskId)];
  if (cursor > 0) {
    conditions.push(gt(schema.publishTaskLogs.id, cursor));
  }

  const logs = await db
    .select()
    .from(schema.publishTaskLogs)
    .where(and(...conditions))
    .orderBy(asc(schema.publishTaskLogs.id))
    .limit(limit);

  const nextCursor = logs.length > 0 ? logs[logs.length - 1]!.id : cursor;

  return {
    data: logs,
    cursor: nextCursor,
    hasMore: logs.length === limit,
  };
});
