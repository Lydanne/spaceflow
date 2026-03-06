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
      id: schema.projects.id,
      organizationId: schema.projects.organizationId,
      name: schema.projects.name,
      fullName: schema.projects.fullName,
      description: schema.projects.description,
      defaultBranch: schema.projects.defaultBranch,
      cloneUrl: schema.projects.cloneUrl,
      webhookId: schema.projects.webhookId,
      settings: schema.projects.settings,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .where(eq(schema.projects.fullName, fullName))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return project;
});
