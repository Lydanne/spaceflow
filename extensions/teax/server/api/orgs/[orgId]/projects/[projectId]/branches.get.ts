import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requireOrgAccess } from "../../../../../utils/org-access";
import { createGiteaServiceWithRefresh } from "../../../../../utils/auth";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }
  const session = await requireOrgAccess(event, orgId);
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createGiteaServiceWithRefresh(event, session);
  const parts = project.fullName.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw createError({ statusCode: 500, message: "Invalid project fullName format" });
  }

  try {
    const branches = await gitea.getRepoBranches(parts[0], parts[1]);
    return {
      data: branches,
      defaultBranch: project.defaultBranch,
    };
  } catch (err: unknown) {
    const status =
      (err as { statusCode?: number })?.statusCode || (err as { status?: number })?.status;
    if (status === 401) {
      throw createError({ statusCode: 401, message: "Gitea token 已过期，请重新登录" });
    }
    throw createError({ statusCode: 502, message: "获取分支列表失败" });
  }
});
