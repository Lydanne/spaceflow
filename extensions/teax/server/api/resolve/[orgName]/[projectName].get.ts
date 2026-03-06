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
      organizationId: schema.repositories.organizationId,
      name: schema.repositories.name,
      fullName: schema.repositories.fullName,
      description: schema.repositories.description,
      defaultBranch: schema.repositories.defaultBranch,
      cloneUrl: schema.repositories.cloneUrl,
      webhookId: schema.repositories.webhookId,
      settings: schema.repositories.settings,
      createdAt: schema.repositories.createdAt,
      updatedAt: schema.repositories.updatedAt,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.fullName, fullName))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return project;
});
