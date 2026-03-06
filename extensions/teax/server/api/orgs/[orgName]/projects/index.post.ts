import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { generateWebhookSecret } from "~~/server/utils/webhook-verify";
import { writeAuditLog } from "~~/server/utils/audit";
import { createProjectBodySchema } from "~~/server/shared/dto";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const session = await requirePermission(event, orgId, "repo:create");
  const db = useDB();

  const { repo_full_name } = await readValidatedBody(event, createProjectBodySchema.parse);

  const parts = repo_full_name.split("/");
  const owner = parts[0]!;
  const repo = parts[1]!;
  const gitea = await createServiceGiteaClient();

  // 获取仓库信息
  let giteaRepo;
  try {
    giteaRepo = await gitea.getRepo(owner, repo);
  } catch {
    throw createError({ statusCode: 404, message: "Repository not found on Gitea" });
  }

  // 检查仓库是否已被关联
  const existing = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.gitea_repo_id, giteaRepo.id))
    .limit(1);

  if (existing.length > 0) {
    throw createError({ statusCode: 409, message: "Repository already linked to a project" });
  }

  // 注册 Webhook
  const config = useRuntimeConfig();
  const webhookSecret = generateWebhookSecret();
  const webhookUrl = `${config.public.appUrl}/api/webhooks/gitea`;

  let webhookIdValue: number | undefined;
  try {
    const webhook = await gitea.createWebhook(owner!, repo!, webhookUrl, webhookSecret, ["push"]);
    webhookIdValue = webhook.id;
  } catch (err: unknown) {
    console.error("Failed to create webhook:", err);
    // Webhook 创建失败不阻塞项目创建
  }

  const [project] = await db
    .insert(schema.repositories)
    .values({
      organization_id: orgId,
      gitea_repo_id: giteaRepo.id,
      name: giteaRepo.name,
      full_name: giteaRepo.full_name,
      description: giteaRepo.description,
      default_branch: giteaRepo.default_branch,
      clone_url: giteaRepo.clone_url,
      webhook_id: webhookIdValue ?? null,
      webhook_secret: webhookSecret,
      created_by: session.user.id,
      settings: {
        autoDeploy: false,
        deployBranches: [giteaRepo.default_branch],
        notifyOnSuccess: true,
        notifyOnFailure: true,
        approvalRequired: false,
      },
    })
    .returning({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
      gitea_repo_id: schema.repositories.gitea_repo_id,
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
      description: schema.repositories.description,
      default_branch: schema.repositories.default_branch,
      clone_url: schema.repositories.clone_url,
      webhook_id: schema.repositories.webhook_id,
      settings: schema.repositories.settings,
      created_by: schema.repositories.created_by,
      created_at: schema.repositories.created_at,
      updated_at: schema.repositories.updated_at,
    });

  await writeAuditLog(event, {
    user_id: session.user.id,
    organization_id: orgId,
    action: "project.create",
    resource_type: "project",
    resource_id: project?.id,
    detail: { full_name: repo_full_name },
  });

  return project;
});
