import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";
import { createServiceGiteaClient } from "../../../../../utils/gitea";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }

  await requirePermission(event, orgId, "project:view", projectId);
  const db = useDB();

  const [project] = await db
    .select({
      fullName: schema.projects.fullName,
      defaultBranch: schema.projects.defaultBranch,
    })
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

  const parts = project.fullName.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";
  if (!owner || !repo) {
    throw createError({ statusCode: 500, message: "Invalid project fullName" });
  }

  const gitea = await createServiceGiteaClient();
  const branch = project.defaultBranch || "main";

  // 优先 TEAX.md，其次 README.md
  const teaxContent = await gitea.getFileContent(owner, repo, "TEAX.md", branch);
  if (teaxContent) {
    return { content: teaxContent, source: "TEAX.md" };
  }

  const readmeContent = await gitea.getFileContent(owner, repo, "README.md", branch);
  if (readmeContent) {
    return { content: readmeContent, source: "README.md" };
  }

  return { content: null, source: null };
});
