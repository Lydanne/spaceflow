import { eq, and } from "drizzle-orm";
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

  const [task] = await db
    .select({
      id: schema.publishTasks.id,
      projectId: schema.publishTasks.projectId,
      branch: schema.publishTasks.branch,
      commitSha: schema.publishTasks.commitSha,
      commitMessage: schema.publishTasks.commitMessage,
      triggeredBy: schema.publishTasks.triggeredBy,
      triggerType: schema.publishTasks.triggerType,
      status: schema.publishTasks.status,
      approvedBy: schema.publishTasks.approvedBy,
      approvedAt: schema.publishTasks.approvedAt,
      startedAt: schema.publishTasks.startedAt,
      finishedAt: schema.publishTasks.finishedAt,
      duration: schema.publishTasks.duration,
      logUrl: schema.publishTasks.logUrl,
      createdAt: schema.publishTasks.createdAt,
      triggeredByUsername: schema.users.giteaUsername,
    })
    .from(schema.publishTasks)
    .leftJoin(schema.users, eq(schema.publishTasks.triggeredBy, schema.users.id))
    .where(and(eq(schema.publishTasks.id, taskId), eq(schema.publishTasks.projectId, projectId)))
    .limit(1);

  if (!task) {
    throw createError({ statusCode: 404, message: "Publish task not found" });
  }

  return task;
});
