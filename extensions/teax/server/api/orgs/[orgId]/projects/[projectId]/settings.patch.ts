import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");

  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }

  await requirePermission(event, orgId, "project:settings");
  const db = useDB();

  const body = await readBody<{
    autoDeploy?: boolean;
    deployBranches?: string[];
    notifyOnSuccess?: boolean;
    notifyOnFailure?: boolean;
    approvalRequired?: boolean;
  }>(event);

  const [project] = await db
    .select({ settings: schema.projects.settings })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const currentSettings = (project.settings || {}) as Record<string, unknown>;
  const newSettings = { ...currentSettings };

  if (body.autoDeploy !== undefined) newSettings.autoDeploy = body.autoDeploy;
  if (body.deployBranches !== undefined) newSettings.deployBranches = body.deployBranches;
  if (body.notifyOnSuccess !== undefined) newSettings.notifyOnSuccess = body.notifyOnSuccess;
  if (body.notifyOnFailure !== undefined) newSettings.notifyOnFailure = body.notifyOnFailure;
  if (body.approvalRequired !== undefined) newSettings.approvalRequired = body.approvalRequired;

  const [updated] = await db
    .update(schema.projects)
    .set({ settings: newSettings, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.organizationId, orgId),
      ),
    )
    .returning({
      id: schema.projects.id,
      settings: schema.projects.settings,
      updatedAt: schema.projects.updatedAt,
    });

  return { data: updated };
});
