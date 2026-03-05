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
      name: schema.projects.name,
      description: schema.projects.description,
      defaultBranch: schema.projects.defaultBranch,
      cloneUrl: schema.projects.cloneUrl,
      createdAt: schema.projects.createdAt,
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
    return { content: teaxContent, source: "TEAX.md", repoInfo: null };
  }

  const readmeContent = await gitea.getFileContent(owner, repo, "README.md", branch);
  if (readmeContent) {
    return { content: readmeContent, source: "README.md", repoInfo: null };
  }

  // 无 README，返回仓库信息
  let repoInfo: {
    fullName: string;
    description: string | null;
    defaultBranch: string | null;
    cloneUrl: string | null;
    createdAt: string | null;
    htmlUrl: string;
    stars: number;
    forks: number;
    language: string | null;
  } | null = null;

  try {
    const giteaRepo = await gitea.getRepo(owner, repo);
    repoInfo = {
      fullName: project.fullName,
      description: project.description,
      defaultBranch: project.defaultBranch,
      cloneUrl: project.cloneUrl,
      createdAt: project.createdAt ? new Date(project.createdAt).toISOString() : null,
      htmlUrl: giteaRepo.html_url || "",
      stars: giteaRepo.stars_count || 0,
      forks: giteaRepo.forks_count || 0,
      language: giteaRepo.language || null,
    };
  } catch {
    repoInfo = {
      fullName: project.fullName,
      description: project.description,
      defaultBranch: project.defaultBranch,
      cloneUrl: project.cloneUrl,
      createdAt: project.createdAt ? new Date(project.createdAt).toISOString() : null,
      htmlUrl: "",
      stars: 0,
      forks: 0,
      language: null,
    };
  }

  return { content: null, source: null, repoInfo };
});
