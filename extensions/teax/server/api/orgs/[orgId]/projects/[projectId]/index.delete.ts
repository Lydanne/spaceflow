import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";
import { createGiteaServiceWithRefresh } from "../../../../../utils/auth";
import { writeAuditLog } from "../../../../../utils/audit";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");

  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }

  const session = await requirePermission(event, orgId, "project:delete");
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // 尝试删除 Gitea Webhook
  if (project.webhookId) {
    try {
      const gitea = await createGiteaServiceWithRefresh(event, session);
      const [owner, repo] = project.fullName.split("/");
      if (owner && repo) {
        await gitea.deleteWebhook(owner, repo, project.webhookId);
      }
    } catch (err: unknown) {
      console.warn("Failed to delete webhook on Gitea:", err);
    }
  }

  await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)));

  await writeAuditLog(event, {
    userId: session.user.id,
    organizationId: orgId,
    action: "project.delete",
    resourceType: "project",
    resourceId: projectId,
    detail: { fullName: project.fullName },
  });

  return { success: true };
});
