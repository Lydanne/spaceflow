import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "repo:settings", repoId);
  const db = useDB();

  const [project] = await db
    .select({ webhook_id: schema.repositories.webhook_id })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // 如果没有 webhook_id，说明从未创建过
  if (!project.webhook_id) {
    return {
      exists: false,
      active: false,
      message: "Webhook 未创建",
    };
  }

  // 检查 Gitea 中的 Webhook 状态
  try {
    const gitea = await createServiceGiteaClient();
    const webhook = await gitea.getWebhook(owner, repo, project.webhook_id);

    return {
      exists: true,
      active: webhook.active,
      events: webhook.events,
      url: webhook.url,
      webhookId: webhook.id,
    };
  } catch (err: unknown) {
    // Webhook 在 Gitea 中不存在（可能被手动删除）
    console.error("Failed to get webhook from Gitea:", err);
    return {
      exists: false,
      active: false,
      message: "Webhook 在 Gitea 中不存在（可能已被删除）",
      webhookId: project.webhook_id,
    };
  }
});
