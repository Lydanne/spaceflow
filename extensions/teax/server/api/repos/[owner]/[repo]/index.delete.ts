import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { writeAuditLog } from "~~/server/utils/audit";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "repo:delete", repoId);
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // 尝试删除 Gitea Webhook
  if (project.webhook_id) {
    try {
      const gitea = await createServiceGiteaClient();
      await gitea.deleteWebhook(owner, repo, project.webhook_id);
    } catch (err: unknown) {
      console.warn("Failed to delete webhook on Gitea:", err);
    }
  }

  await db
    .delete(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)));

  await writeAuditLog(event, {
    user_id: session.user.id,
    organization_id: orgId,
    action: "project.delete",
    resource_type: "project",
    resource_id: repoId,
    detail: { full_name: project.full_name },
  });

  return { success: true };
});
