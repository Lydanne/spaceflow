import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../db";
import { requireAuth } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const orgName = getRouterParam(event, "orgName");
  const projectName = getRouterParam(event, "projectName");

  if (!orgName || !projectName) {
    throw createError({ statusCode: 400, message: "Missing orgName or projectName" });
  }

  const fullName = `${orgName}/${projectName}`;
  const db = useDB();

  const [project] = await db
    .select({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
      description: schema.repositories.description,
      default_branch: schema.repositories.default_branch,
      clone_url: schema.repositories.clone_url,
      webhook_id: schema.repositories.webhook_id,
      settings: schema.repositories.settings,
      created_at: schema.repositories.created_at,
      updated_at: schema.repositories.updated_at,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.full_name, fullName))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return project;
});
