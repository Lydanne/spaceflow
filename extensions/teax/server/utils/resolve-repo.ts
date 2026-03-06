import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { H3Event } from "h3";

/**
 * 从路由参数 owner + repo 解析出 repoId 和 orgId。
 * 路由目录为 /api/repos/[owner]/[repo]/...
 * 找不到时抛 404。
 */
export async function resolveRepoId(event: H3Event): Promise<{
  repoId: string;
  orgId: string;
  owner: string;
  repo: string;
  fullName: string;
}> {
  const owner = getRouterParam(event, "owner");
  const repo = getRouterParam(event, "repo");
  if (!owner || !repo) {
    throw createError({ statusCode: 400, message: "Missing owner or repo" });
  }

  const fullName = `${owner}/${repo}`;
  const db = useDB();
  const [row] = await db
    .select({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.full_name, fullName))
    .limit(1);

  if (!row) {
    throw createError({ statusCode: 404, message: "Repository not found" });
  }

  return { repoId: row.id, orgId: row.organization_id, owner, repo, fullName };
}
