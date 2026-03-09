import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "repo:settings", repoId);
  const db = useDB();

  const body = await readBody<{ active: boolean }>(event);

  const [project] = await db
    .select({ webhook_id: schema.repositories.webhook_id })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  if (!project.webhook_id) {
    throw createError({ statusCode: 400, message: "Webhook does not exist" });
  }

  try {
    const gitea = await createServiceGiteaClient();

    // 先获取当前 Webhook 配置，保留 events 和 config
    const currentWebhook = await gitea.getWebhook(owner, repo, project.webhook_id);

    const webhook = await gitea.updateWebhook(owner, repo, project.webhook_id, {
      active: body.active,
      events: currentWebhook.events, // 保留原有事件订阅
      config: currentWebhook.config, // 保留原有配置
    });

    return {
      success: true,
      active: webhook.active,
      message: body.active ? "Webhook 已启用" : "Webhook 已禁用",
    };
  } catch (err: unknown) {
    console.error("Failed to toggle webhook:", err);
    throw createError({
      statusCode: 500,
      message: "更新 Webhook 状态失败",
    });
  }
});
