import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }
  await requirePermission(event, orgId, "repo:view", projectId);
  const db = useDB();

  const [project] = await db
    .select({
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
    })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, projectId), eq(schema.repositories.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return project;
});
