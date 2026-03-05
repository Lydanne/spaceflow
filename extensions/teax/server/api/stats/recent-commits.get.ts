import { eq, and, inArray } from "drizzle-orm";
import { useDB, schema } from "../../db";
import { requireAuth, getGiteaClient } from "../../utils/auth";
import { getVisibleProjectIds } from "../../utils/permission";

interface CommitItem {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: string;
  htmlUrl: string;
  projectName: string;
  projectFullName: string;
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const gitea = await getGiteaClient(event, session);
  const db = useDB();

  // 获取用户所有组织
  const orgs = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations);

  // 收集所有可见项目
  const allProjects: { fullName: string; name: string }[] = [];

  for (const org of orgs) {
    const visibleIds = await getVisibleProjectIds(
      session.user.id,
      org.id,
      !!session.user.isAdmin,
    );

    if (visibleIds !== null && visibleIds.length === 0) continue;

    const where = visibleIds === null
      ? eq(schema.projects.organizationId, org.id)
      : and(
        eq(schema.projects.organizationId, org.id),
        inArray(schema.projects.id, visibleIds),
      );

    const projects = await db
      .select({
        fullName: schema.projects.fullName,
        name: schema.projects.name,
      })
      .from(schema.projects)
      .where(where);

    allProjects.push(...projects);
  }

  // 并发获取每个项目最近 1 条 commit（最多取 10 个项目避免过慢）
  const projectsToFetch = allProjects.slice(0, 10);
  const commits: CommitItem[] = [];

  const results = await Promise.allSettled(
    projectsToFetch.map(async (project) => {
      const [owner, repo] = project.fullName.split("/");
      if (!owner || !repo) return [];
      const repoCommits = await gitea.getRepoCommits(owner, repo, undefined, 3);
      return repoCommits.map((c) => ({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        authorName: c.commit.author.name,
        authorEmail: c.commit.author.email,
        date: c.commit.author.date,
        htmlUrl: c.html_url,
        projectName: project.name,
        projectFullName: project.fullName,
      }));
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      commits.push(...result.value);
    }
  }

  // 按时间降序排序，取最近 10 条
  commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { data: commits.slice(0, 10) };
});
