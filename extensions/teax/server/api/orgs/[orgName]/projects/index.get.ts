import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { getVisibleRepositoryIds } from "~~/server/utils/permission";
import { resolveOrgId } from "~~/server/utils/resolve-org";
import { syncRepositoryWatchForUser } from "~~/server/services/repository-watch.service";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const session = await requireAuth(event);
  const db = useDB();

  // 获取可见项目 ID（null=全部可见）
  const visibleIds = await getVisibleRepositoryIds(session.user.id, orgId, !!session.user.is_admin);

  // 用户没有任何 project:view 权限 → 空列表
  if (visibleIds !== null && visibleIds.length === 0) {
    return { data: [], total: 0, page: 1, limit: 20, hasMore: false };
  }

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const whereConditions = visibleIds === null
    ? eq(schema.repositories.organization_id, orgId)
    : and(eq(schema.repositories.organization_id, orgId), inArray(schema.repositories.id, visibleIds));

  const projectList = await db
    .select({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
      gitea_repo_id: schema.repositories.gitea_repo_id,
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
      description: schema.repositories.description,
      default_branch: schema.repositories.default_branch,
      clone_url: schema.repositories.clone_url,
      settings: schema.repositories.settings,
      created_by: schema.repositories.created_by,
      created_at: schema.repositories.created_at,
      updated_at: schema.repositories.updated_at,
    })
    .from(schema.repositories)
    .where(whereConditions)
    .orderBy(desc(schema.repositories.updated_at))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.repositories)
    .where(whereConditions);

  const total = Number(totalResult[0]?.count ?? 0);

  const repoIds = projectList.map((p) => p.id);
  const watchMap = new Map<string, { watching: boolean; synced_at: Date | null }>();

  if (repoIds.length > 0) {
    const watchRows = await db
      .select({
        repository_id: schema.repositoryWatches.repository_id,
        watching: schema.repositoryWatches.watching,
        synced_at: schema.repositoryWatches.synced_at,
      })
      .from(schema.repositoryWatches)
      .where(and(
        eq(schema.repositoryWatches.user_id, session.user.id),
        inArray(schema.repositoryWatches.repository_id, repoIds),
      ));

    for (const row of watchRows) {
      watchMap.set(row.repository_id, {
        watching: row.watching,
        synced_at: row.synced_at,
      });
    }

    // 自动同步当前页仓库 watch 状态：
    // - 缓存新鲜时直接用本地
    // - 过期或缺失时才拉取 Gitea
    const syncResults = await Promise.allSettled(
      projectList.map(async (project) => {
        const [owner, repo] = project.full_name.split("/", 2);
        if (!owner || !repo) return;

        const current = watchMap.get(project.id);
        const synced = await syncRepositoryWatchForUser(event, {
          userId: session.user.id,
          repoId: project.id,
          owner,
          repo,
          current: current
            ? {
                watching: current.watching,
                synced_at: current.synced_at,
              }
            : null,
        });

        watchMap.set(project.id, {
          watching: synced.watching,
          synced_at: synced.syncedAt,
        });
      }),
    );

    for (const result of syncResults) {
      if (result.status === "rejected") {
        console.warn("[projects] sync watch state failed:", result.reason);
      }
    }
  }

  const projectListWithWatch = projectList.map((p) => {
    const state = watchMap.get(p.id);
    return {
      ...p,
      watching: state?.watching ?? false,
      watch_synced_at: state?.synced_at ?? null,
    };
  });

  return {
    data: projectListWithWatch,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
});
