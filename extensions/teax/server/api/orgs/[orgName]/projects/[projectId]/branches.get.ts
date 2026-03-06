import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const projectId = getRouterParam(event, "projectId");
  if (!projectId) {
    throw createError({ statusCode: 400, message: "Missing projectId" });
  }
  await requirePermission(event, orgId, "repo:view", projectId);
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, projectId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createServiceGiteaClient();
  const parts = project.full_name.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw createError({ statusCode: 500, message: "Invalid project fullName format" });
  }

  try {
    const branches = await gitea.getRepoBranches(parts[0], parts[1]);
    return {
      data: branches,
      default_branch: project.default_branch,
    };
  } catch {
    throw createError({ statusCode: 502, message: "获取分支列表失败" });
  }
});
