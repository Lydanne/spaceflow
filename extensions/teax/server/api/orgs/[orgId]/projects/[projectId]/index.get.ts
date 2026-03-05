import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requireOrgAccess } from "../../../../../utils/org-access";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }
  await requireOrgAccess(event, orgId);
  const db = useDB();

  const [project] = await db
    .select({
      id: schema.projects.id,
      organizationId: schema.projects.organizationId,
      giteaRepoId: schema.projects.giteaRepoId,
      name: schema.projects.name,
      fullName: schema.projects.fullName,
      description: schema.projects.description,
      defaultBranch: schema.projects.defaultBranch,
      cloneUrl: schema.projects.cloneUrl,
      webhookId: schema.projects.webhookId,
      settings: schema.projects.settings,
      createdBy: schema.projects.createdBy,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return project;
});
