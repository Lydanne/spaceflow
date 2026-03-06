import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requirePermission } from "../../../../utils/permission";
import { createServiceGiteaClient } from "../../../../utils/gitea";
import { generateWebhookSecret } from "../../../../utils/webhook-verify";
import { writeAuditLog } from "../../../../utils/audit";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }
  const session = await requirePermission(event, orgId, "repo:create");
  const db = useDB();

  const body = await readBody(event);
  const { repoFullName } = body as { repoFullName: string };

  if (!repoFullName || !repoFullName.includes("/")) {
    throw createError({
      statusCode: 400,
      message: "Invalid repository name, expected format: owner/repo",
    });
  }

  const parts = repoFullName.split("/");
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
    .where(eq(schema.repositories.giteaRepoId, giteaRepo.id))
    .limit(1);

  if (existing.length > 0) {
    throw createError({ statusCode: 409, message: "Repository already linked to a project" });
  }

  // 注册 Webhook
  const config = useRuntimeConfig();
  const webhookSecret = generateWebhookSecret();
  const webhookUrl = `${config.public.appUrl}/api/webhooks/gitea`;

  let webhookId: number | undefined;
  try {
    const webhook = await gitea.createWebhook(owner!, repo!, webhookUrl, webhookSecret, ["push"]);
    webhookId = webhook.id;
  } catch (err: unknown) {
    console.error("Failed to create webhook:", err);
    // Webhook 创建失败不阻塞项目创建
  }

  const [project] = await db
    .insert(schema.repositories)
    .values({
      organizationId: orgId,
      giteaRepoId: giteaRepo.id,
      name: giteaRepo.name,
      fullName: giteaRepo.full_name,
      description: giteaRepo.description,
      defaultBranch: giteaRepo.default_branch,
      cloneUrl: giteaRepo.clone_url,
      webhookId: webhookId ?? null,
      webhookSecret,
      createdBy: session.user.id,
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
      organizationId: schema.repositories.organizationId,
      giteaRepoId: schema.repositories.giteaRepoId,
      name: schema.repositories.name,
      fullName: schema.repositories.fullName,
      description: schema.repositories.description,
      defaultBranch: schema.repositories.defaultBranch,
      cloneUrl: schema.repositories.cloneUrl,
      webhookId: schema.repositories.webhookId,
      settings: schema.repositories.settings,
      createdBy: schema.repositories.createdBy,
      createdAt: schema.repositories.createdAt,
      updatedAt: schema.repositories.updatedAt,
    });

  await writeAuditLog(event, {
    userId: session.user.id,
    organizationId: orgId,
    action: "project.create",
    resourceType: "project",
    resourceId: project?.id,
    detail: { fullName: repoFullName },
  });

  return project;
});
