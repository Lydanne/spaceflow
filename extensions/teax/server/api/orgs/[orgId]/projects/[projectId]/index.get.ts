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
    })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, projectId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return project;
});
