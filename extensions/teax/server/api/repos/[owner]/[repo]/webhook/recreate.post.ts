import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { generateWebhookSecret } from "~~/server/utils/webhook-verify";
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

  const config = useRuntimeConfig();
  const webhookSecret = generateWebhookSecret();
  const webhookUrl = `${config.public.appUrl}/api/webhooks/gitea`;

  try {
    const gitea = await createServiceGiteaClient();

    // 如果已有 webhook_id，先尝试删除旧的
    if (project.webhook_id) {
      try {
        await gitea.deleteWebhook(owner, repo, project.webhook_id);
      } catch (err: unknown) {
        console.warn("Failed to delete old webhook (may not exist):", err);
      }
    }

    // 创建新的 Webhook
    const webhook = await gitea.createWebhook(owner, repo, webhookUrl, webhookSecret);

    // 更新数据库
    await db
      .update(schema.repositories)
      .set({
        webhook_id: webhook.id,
        webhook_secret: webhookSecret,
        updated_at: new Date(),
      })
      .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)));

    return {
      success: true,
      webhookId: webhook.id,
      message: "Webhook 已重新创建",
    };
  } catch (err: unknown) {
    console.error("Failed to recreate webhook:", err);
    throw createError({
      statusCode: 500,
      message: "重新创建 Webhook 失败",
    });
  }
});
