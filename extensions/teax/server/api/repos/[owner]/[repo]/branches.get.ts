import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "repo:view", repoId);
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createServiceGiteaClient();

  try {
    const branches = await gitea.getRepoBranches(owner, repo);
    return {
      data: branches,
      default_branch: project.default_branch,
    };
  } catch {
    throw createError({ statusCode: 502, message: "获取分支列表失败" });
  }
});
