import { eq, and, inArray } from "drizzle-orm";
import { useDB, schema } from "../../db";
import { requireAuth, createGiteaServiceWithRefresh } from "../../utils/auth";
import type { GiteaCommit } from "../../utils/gitea";
import { getVisibleRepositoryIds } from "../../utils/permission";

interface CommitItem {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
  html_url: string;
  project_name: string;
  project_full_name: string;
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const gitea = await createGiteaServiceWithRefresh(event, session);
  const db = useDB();

  // 获取用户所有组织
  const orgs = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations);

  // 收集所有可见项目
  const allProjects: { full_name: string; name: string }[] = [];

  for (const org of orgs) {
    const visibleIds = await getVisibleRepositoryIds(
      session.user.id,
      org.id,
      !!session.user.is_admin,
    );

    if (visibleIds !== null && visibleIds.length === 0) continue;

    const where = visibleIds === null
      ? eq(schema.repositories.organization_id, org.id)
      : and(
          eq(schema.repositories.organization_id, org.id),
          inArray(schema.repositories.id, visibleIds),
        );

    const projects = await db
      .select({
        full_name: schema.repositories.full_name,
        name: schema.repositories.name,
      })
      .from(schema.repositories)
      .where(where);

    allProjects.push(...projects);
  }

  // 并发获取每个项目最近 1 条 commit（最多取 10 个项目避免过慢）
  const projectsToFetch = allProjects.slice(0, 10);
  const commits: CommitItem[] = [];

  const results = await Promise.allSettled(
    projectsToFetch.map(async (project) => {
      const [owner, repo] = project.full_name.split("/");
      if (!owner || !repo) return [];
      const repoCommits = await gitea.getRepoCommits(owner, repo, undefined, 3);
      return repoCommits.map((c: GiteaCommit) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        author_name: c.commit.author.name,
        author_email: c.commit.author.email,
        date: c.commit.author.date,
        html_url: c.html_url,
        project_name: project.name,
        project_full_name: project.full_name,
      }));
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value && Array.isArray(result.value)) {
      commits.push(...(result.value as CommitItem[]));
    }
  }

  // 按时间降序排序，取最近 10 条
  commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { data: commits.slice(0, 10) };
});
