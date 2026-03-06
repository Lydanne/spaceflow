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
    .select({
      full_name: schema.repositories.full_name,
      name: schema.repositories.name,
      description: schema.repositories.description,
      default_branch: schema.repositories.default_branch,
      clone_url: schema.repositories.clone_url,
      created_at: schema.repositories.created_at,
    })
    .from(schema.repositories)
    .where(
      and(
        eq(schema.repositories.id, projectId),
        eq(schema.repositories.organization_id, orgId),
      ),
    )
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const parts = project.full_name.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";
  if (!owner || !repo) {
    throw createError({ statusCode: 500, message: "Invalid project fullName" });
  }

  const gitea = await createServiceGiteaClient();
  const branch = project.default_branch || "main";

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
    full_name: string;
    description: string | null;
    default_branch: string | null;
    clone_url: string | null;
    created_at: string | null;
    htmlUrl: string;
    stars: number;
    forks: number;
    language: string | null;
  } | null = null;

  try {
    const giteaRepo = await gitea.getRepo(owner, repo);
    repoInfo = {
      full_name: project.full_name,
      description: project.description,
      default_branch: project.default_branch,
      clone_url: project.clone_url,
      created_at: project.created_at ? new Date(project.created_at).toISOString() : null,
      htmlUrl: giteaRepo.html_url || "",
      stars: giteaRepo.stars_count || 0,
      forks: giteaRepo.forks_count || 0,
      language: giteaRepo.language || null,
    };
  } catch {
    repoInfo = {
      full_name: project.full_name,
      description: project.description,
      default_branch: project.default_branch,
      clone_url: project.clone_url,
      created_at: project.created_at ? new Date(project.created_at).toISOString() : null,
      htmlUrl: "",
      stars: 0,
      forks: 0,
      language: null,
    };
  }

  return { content: null, source: null, repoInfo };
});
