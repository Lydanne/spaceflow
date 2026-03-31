import { syncRepositoryWatchForUser } from "~~/server/services/repository-watch.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

/**
 * 手动同步单仓库 Watch 状态。
 * force=true：强制向 Gitea 拉取当前用户订阅状态并回写本地缓存。
 */
export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "repo:view", repoId);

  const watchState = await syncRepositoryWatchForUser(event, {
    userId: session.user.id,
    repoId,
    owner,
    repo,
    force: true,
  });

  return {
    data: {
      repository_id: repoId,
      watching: watchState.watching,
      synced_at: watchState.syncedAt,
    },
  };
});
