import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");

  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }

  await requirePermission(event, orgId, "repo:settings", projectId);
  const db = useDB();

  const body = await readBody<{
    notifyOnSuccess?: boolean;
    notifyOnFailure?: boolean;
  }>(event);

  const [project] = await db
    .select({ settings: schema.repositories.settings })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, projectId), eq(schema.repositories.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const currentSettings = (project.settings || {}) as Record<string, unknown>;
  const newSettings = { ...currentSettings };

  if (body.notifyOnSuccess !== undefined) newSettings.notifyOnSuccess = body.notifyOnSuccess;
  if (body.notifyOnFailure !== undefined) newSettings.notifyOnFailure = body.notifyOnFailure;

  const [updated] = await db
    .update(schema.repositories)
    .set({ settings: newSettings, updatedAt: new Date() })
    .where(and(eq(schema.repositories.id, projectId), eq(schema.repositories.organizationId, orgId)))
    .returning({
      id: schema.repositories.id,
      settings: schema.repositories.settings,
      updatedAt: schema.repositories.updatedAt,
    });

  return { data: updated };
});
