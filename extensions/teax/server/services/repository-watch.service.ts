import type { H3Event } from "h3";
import { and, eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { useGiteaSdk } from "~~/server/utils/gitea";

/**
 * Watch 状态自动同步间隔（毫秒）。
 * 5 分钟内命中缓存，超过后再向 Gitea 拉取最新状态。
 */
export const WATCH_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface WatchState {
  watching: boolean;
  syncedAt: Date | null;
}

interface SyncWatchParams {
  userId: string;
  repoId: string;
  owner: string;
  repo: string;
  force?: boolean;
  current?: {
    watching: boolean;
    synced_at: Date | null;
  } | null;
}

function isFresh(syncedAt: Date | null, now: Date): boolean {
  if (!syncedAt) return false;
  return now.getTime() - new Date(syncedAt).getTime() < WATCH_SYNC_INTERVAL_MS;
}

export async function upsertWatchState(
  userId: string,
  repoId: string,
  watching: boolean,
): Promise<WatchState> {
  const db = useDB();
  const now = new Date();

  const [row] = await db
    .insert(schema.repositoryWatches)
    .values({
      user_id: userId,
      repository_id: repoId,
      watching,
      synced_at: now,
      row_creator: userId,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.repositoryWatches.user_id,
        schema.repositoryWatches.repository_id,
      ],
      set: {
        watching,
        synced_at: now,
        updated_at: now,
      },
    })
    .returning({
      watching: schema.repositoryWatches.watching,
      synced_at: schema.repositoryWatches.synced_at,
    });

  return {
    watching: row?.watching ?? watching,
    syncedAt: row?.synced_at ?? now,
  };
}

/**
 * 自动同步单仓库 watch 状态。
 * - force=false：优先使用本地缓存，过期后再请求 Gitea
 * - force=true：强制请求 Gitea
 */
export async function syncRepositoryWatchForUser(
  event: H3Event,
  params: SyncWatchParams,
): Promise<WatchState> {
  const db = useDB();
  const now = new Date();

  const current = params.current ?? (await db
    .select({
      watching: schema.repositoryWatches.watching,
      synced_at: schema.repositoryWatches.synced_at,
    })
    .from(schema.repositoryWatches)
    .where(and(
      eq(schema.repositoryWatches.user_id, params.userId),
      eq(schema.repositoryWatches.repository_id, params.repoId),
    ))
    .limit(1)
    .then((rows) => rows[0] || null));

  if (!params.force && current && isFresh(current.synced_at, now)) {
    return {
      watching: current.watching,
      syncedAt: current.synced_at,
    };
  }

  let watchingFromGitea: boolean;
  try {
    const gitea = await useGiteaSdk(event).role("user");
    const subscription = await gitea.getRepoSubscription(params.owner, params.repo);
    watchingFromGitea = Boolean(subscription.subscribed && !subscription.ignored);
  } catch (err) {
    const statusCode = (err as { statusCode?: number; status?: number })?.statusCode
      || (err as { statusCode?: number; status?: number })?.status;

    if (statusCode === 404) {
      watchingFromGitea = false;
    } else if (params.force) {
      throw err;
    } else if (current) {
      return {
        watching: current.watching,
        syncedAt: current.synced_at,
      };
    } else {
      return {
        watching: false,
        syncedAt: null,
      };
    }
  }

  return upsertWatchState(params.userId, params.repoId, watchingFromGitea);
}
