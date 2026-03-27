import { execFile } from "node:child_process";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { schema, useDB } from "~~/server/db";

const execFileAsync = promisify(execFile);
const repoLocks = new Map<string, Promise<void>>();

type RuntimeMode = "local" | "mock";

interface RuntimeResolvedConfig {
  mode: RuntimeMode;
  rootDir: string;
  reposRootDir: string;
  sessionsRootDir: string;
  gitBin: string;
  keepWorktreeOnStop: boolean;
  allowMockFallback: boolean;
}

interface RepoPathInfo {
  repoRootPath: string;
  sessionPath: string;
}

interface RepositorySnapshot {
  id: string;
  full_name: string;
  clone_url: string;
  default_branch: string | null;
}

/**
 * 解析运行时配置（支持 local/mock 双模式）。
 * - local：真实执行 git worktree（需宿主具备 git 和仓库访问权限）
 * - mock：仅创建目录结构，方便本地开发验证流程
 */
function resolveRuntimeConfig(): RuntimeResolvedConfig {
  const config = useRuntimeConfig();
  const rawMode = String(config.agentRuntimeMode || "mock");
  const mode: RuntimeMode = rawMode === "local" ? "local" : "mock";
  const rawRoot = String(config.agentRuntimeRoot || ".teax-agent-runtime");
  const rootDir = isAbsolute(rawRoot) ? rawRoot : resolve(process.cwd(), rawRoot);

  return {
    mode,
    rootDir,
    reposRootDir: join(rootDir, "repos"),
    sessionsRootDir: join(rootDir, "sessions"),
    gitBin: String(config.agentRuntimeGitBin || "git"),
    keepWorktreeOnStop: config.agentRuntimeKeepWorktreeOnStop === true,
    allowMockFallback: config.agentRuntimeAllowMockFallback !== false,
  };
}

function toSafePathSegments(repoFullName: string): string[] {
  return repoFullName
    .split("/")
    .map((item) => item.trim().replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter(Boolean);
}

function buildWorkingBranch(sessionId: string, specified?: string): string {
  if (specified?.trim()) return specified.trim();
  return `agent/${sessionId.slice(0, 8)}`;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args: string[], cwd?: string) {
  const config = resolveRuntimeConfig();
  const { stdout, stderr } = await execFileAsync(config.gitBin, args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: (stdout || "").trim(),
    stderr: (stderr || "").trim(),
  };
}

async function withRepositoryLock<T>(repositoryId: string, fn: () => Promise<T>): Promise<T> {
  const previous = repoLocks.get(repositoryId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolveCurrent) => {
    release = resolveCurrent;
  });
  repoLocks.set(repositoryId, previous.then(() => current));

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (repoLocks.get(repositoryId) === current) {
      repoLocks.delete(repositoryId);
    }
  }
}

async function getRepositoryById(repositoryId: string): Promise<RepositorySnapshot> {
  const db = useDB();
  const [repository] = await db
    .select({
      id: schema.repositories.id,
      full_name: schema.repositories.full_name,
      clone_url: schema.repositories.clone_url,
      default_branch: schema.repositories.default_branch,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repositoryId))
    .limit(1);

  if (!repository) {
    throw createError({ statusCode: 404, message: "Repository not found" });
  }
  return repository;
}

function buildRepoPaths(repository: RepositorySnapshot, sessionId: string): RepoPathInfo {
  const config = resolveRuntimeConfig();
  const repoSegments = toSafePathSegments(repository.full_name);
  const repoRootPath = join(config.reposRootDir, ...repoSegments);
  const sessionPath = join(config.sessionsRootDir, sessionId);
  return { repoRootPath, sessionPath };
}

/**
 * 确保仓库 runtime 可用（MVP：持久化为一条 runtime 记录）。
 */
export async function ensureRepoRuntime(params: {
  repositoryId: string;
  actorId: string;
}) {
  const db = useDB();
  const runtimeConfig = resolveRuntimeConfig();
  const repository = await getRepositoryById(params.repositoryId);

  await mkdir(runtimeConfig.reposRootDir, { recursive: true });
  await mkdir(runtimeConfig.sessionsRootDir, { recursive: true });

  const paths = buildRepoPaths(repository, "placeholder-session-id");
  const runtimeKey = `teax-agent-repo-${params.repositoryId.slice(0, 8)}`;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(schema.agentRuntimes)
    .where(eq(schema.agentRuntimes.repository_id, params.repositoryId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.agentRuntimes)
      .set({
        provider: runtimeConfig.mode,
        runtime_key: existing.runtime_key || runtimeKey,
        status: "running",
        last_heartbeat_at: now,
        metadata: {
          ...(existing.metadata as Record<string, unknown> || {}),
          root_dir: runtimeConfig.rootDir,
          repo_root_path: paths.repoRootPath,
          sessions_root_dir: runtimeConfig.sessionsRootDir,
          mode: runtimeConfig.mode,
        },
        updated_at: now,
      })
      .where(eq(schema.agentRuntimes.id, existing.id))
      .returning();

    return {
      runtime: updated || existing,
      repository,
    };
  }

  const [created] = await db
    .insert(schema.agentRuntimes)
    .values({
      scope: "repo",
      repository_id: params.repositoryId,
      provider: runtimeConfig.mode,
      runtime_key: runtimeKey,
      status: "running",
      last_heartbeat_at: now,
      metadata: {
        root_dir: runtimeConfig.rootDir,
        repo_root_path: paths.repoRootPath,
        sessions_root_dir: runtimeConfig.sessionsRootDir,
        mode: runtimeConfig.mode,
      },
      row_creator: params.actorId,
    })
    .returning();

  if (!created) {
    throw createError({ statusCode: 500, message: "Failed to ensure runtime" });
  }

  return {
    runtime: created,
    repository,
  };
}

async function prepareWorktreeInMockMode(params: {
  repository: RepositorySnapshot;
  sessionId: string;
  runtimeId: string;
  baseBranch: string;
  workingBranch: string;
  actorId: string;
}) {
  const db = useDB();
  const paths = buildRepoPaths(params.repository, params.sessionId);

  await mkdir(paths.repoRootPath, { recursive: true });
  await mkdir(paths.sessionPath, { recursive: true });
  await writeFile(
    join(paths.sessionPath, ".teax-worktree.json"),
    JSON.stringify(
      {
        mode: "mock",
        session_id: params.sessionId,
        repository: params.repository.full_name,
        base_branch: params.baseBranch,
        working_branch: params.workingBranch,
        created_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const [upserted] = await db
    .insert(schema.agentSessionWorktrees)
    .values({
      session_id: params.sessionId,
      repository_id: params.repository.id,
      runtime_id: params.runtimeId,
      base_branch: params.baseBranch,
      working_branch: params.workingBranch,
      worktree_path: paths.sessionPath,
      status: "active",
      prepared_at: new Date(),
      metadata: {
        mode: "mock",
      },
      row_creator: params.actorId,
    })
    .onConflictDoUpdate({
      target: [schema.agentSessionWorktrees.session_id],
      set: {
        repository_id: params.repository.id,
        runtime_id: params.runtimeId,
        base_branch: params.baseBranch,
        working_branch: params.workingBranch,
        worktree_path: paths.sessionPath,
        status: "active",
        prepared_at: new Date(),
        removed_at: null,
        last_error: null,
        metadata: {
          mode: "mock",
        },
        updated_at: new Date(),
      },
    })
    .returning();

  return {
    sessionPath: paths.sessionPath,
    worktree: upserted,
    mode: "mock" as const,
  };
}

async function prepareWorktreeInLocalMode(params: {
  repository: RepositorySnapshot;
  sessionId: string;
  runtimeId: string;
  baseBranch: string;
  workingBranch: string;
  actorId: string;
}) {
  const db = useDB();
  const paths = buildRepoPaths(params.repository, params.sessionId);
  const repoGitDirPath = join(paths.repoRootPath, ".git");

  await mkdir(paths.repoRootPath, { recursive: true });
  await mkdir(resolveRuntimeConfig().sessionsRootDir, { recursive: true });

  if (!await pathExists(repoGitDirPath)) {
    await rm(paths.repoRootPath, { recursive: true, force: true });
    await runGit(["clone", "--no-checkout", params.repository.clone_url, paths.repoRootPath]);
  } else {
    await runGit(["remote", "set-url", "origin", params.repository.clone_url], paths.repoRootPath);
  }

  await runGit(["fetch", "origin", "--prune"], paths.repoRootPath);

  if (await pathExists(paths.sessionPath)) {
    try {
      await runGit(["worktree", "remove", "--force", paths.sessionPath], paths.repoRootPath);
    } catch {
      // 忽略历史脏状态，后续直接强制清理目录
    }
    await rm(paths.sessionPath, { recursive: true, force: true });
  }

  await runGit(
    [
      "worktree",
      "add",
      "-B",
      params.workingBranch,
      paths.sessionPath,
      `origin/${params.baseBranch}`,
    ],
    paths.repoRootPath,
  );
  await runGit(["worktree", "prune"], paths.repoRootPath);

  const [headResult, branchResult] = await Promise.all([
    runGit(["rev-parse", "HEAD"], paths.sessionPath),
    runGit(["rev-parse", "--abbrev-ref", "HEAD"], paths.sessionPath),
  ]);

  const [upserted] = await db
    .insert(schema.agentSessionWorktrees)
    .values({
      session_id: params.sessionId,
      repository_id: params.repository.id,
      runtime_id: params.runtimeId,
      base_branch: params.baseBranch,
      working_branch: params.workingBranch,
      worktree_path: paths.sessionPath,
      status: "active",
      prepared_at: new Date(),
      metadata: {
        mode: "local",
        head: headResult.stdout,
        checked_out_branch: branchResult.stdout,
      },
      row_creator: params.actorId,
    })
    .onConflictDoUpdate({
      target: [schema.agentSessionWorktrees.session_id],
      set: {
        repository_id: params.repository.id,
        runtime_id: params.runtimeId,
        base_branch: params.baseBranch,
        working_branch: params.workingBranch,
        worktree_path: paths.sessionPath,
        status: "active",
        prepared_at: new Date(),
        removed_at: null,
        last_error: null,
        metadata: {
          mode: "local",
          head: headResult.stdout,
          checked_out_branch: branchResult.stdout,
        },
        updated_at: new Date(),
      },
    })
    .returning();

  return {
    sessionPath: paths.sessionPath,
    worktree: upserted,
    mode: "local" as const,
  };
}

/**
 * 创建并准备会话 worktree。
 * 该方法负责会话状态从 created/preparing 进入 running。
 */
export async function prepareRepoSessionWorktree(params: {
  repositoryId: string;
  sessionId: string;
  baseBranch?: string;
  workingBranch?: string;
  actorId: string;
}) {
  const db = useDB();
  const runtimeConfig = resolveRuntimeConfig();
  const repository = await getRepositoryById(params.repositoryId);
  const runtimeResult = await ensureRepoRuntime({
    repositoryId: params.repositoryId,
    actorId: params.actorId,
  });

  const baseBranch = (params.baseBranch || repository.default_branch || "main").trim();
  const workingBranch = buildWorkingBranch(params.sessionId, params.workingBranch);

  await db
    .update(schema.agentSessions)
    .set({
      status: "preparing",
      runtime_id: runtimeResult.runtime.id,
      base_branch: baseBranch,
      working_branch: workingBranch,
      started_at: new Date(),
      finished_at: null,
      updated_at: new Date(),
    })
    .where(eq(schema.agentSessions.id, params.sessionId));

  return withRepositoryLock(params.repositoryId, async () => {
    try {
      let prepared:
        | Awaited<ReturnType<typeof prepareWorktreeInLocalMode>>
        | Awaited<ReturnType<typeof prepareWorktreeInMockMode>>;

      if (runtimeConfig.mode === "local") {
        try {
          prepared = await prepareWorktreeInLocalMode({
            repository,
            sessionId: params.sessionId,
            runtimeId: runtimeResult.runtime.id,
            baseBranch,
            workingBranch,
            actorId: params.actorId,
          });
        } catch (error) {
          if (!runtimeConfig.allowMockFallback) {
            throw error;
          }
          prepared = await prepareWorktreeInMockMode({
            repository,
            sessionId: params.sessionId,
            runtimeId: runtimeResult.runtime.id,
            baseBranch,
            workingBranch,
            actorId: params.actorId,
          });
        }
      } else {
        prepared = await prepareWorktreeInMockMode({
          repository,
          sessionId: params.sessionId,
          runtimeId: runtimeResult.runtime.id,
          baseBranch,
          workingBranch,
          actorId: params.actorId,
        });
      }

      await db
        .update(schema.agentSessions)
        .set({
          status: "running",
          runtime_id: runtimeResult.runtime.id,
          base_branch: baseBranch,
          working_branch: workingBranch,
          session_path: prepared.sessionPath,
          started_at: new Date(),
          finished_at: null,
          updated_at: new Date(),
        })
        .where(eq(schema.agentSessions.id, params.sessionId));

      return {
        runtimeId: runtimeResult.runtime.id,
        sessionPath: prepared.sessionPath,
        baseBranch,
        workingBranch,
        mode: prepared.mode,
      };
    } catch (error) {
      const message = (error as { message?: string })?.message || "Failed to prepare worktree";
      await db
        .insert(schema.agentSessionWorktrees)
        .values({
          session_id: params.sessionId,
          repository_id: params.repositoryId,
          runtime_id: runtimeResult.runtime.id,
          base_branch: baseBranch,
          working_branch: workingBranch,
          worktree_path: buildRepoPaths(repository, params.sessionId).sessionPath,
          status: "failed",
          last_error: message,
          row_creator: params.actorId,
        })
        .onConflictDoUpdate({
          target: [schema.agentSessionWorktrees.session_id],
          set: {
            runtime_id: runtimeResult.runtime.id,
            base_branch: baseBranch,
            working_branch: workingBranch,
            worktree_path: buildRepoPaths(repository, params.sessionId).sessionPath,
            status: "failed",
            last_error: message,
            updated_at: new Date(),
          },
        });

      await db
        .update(schema.agentSessions)
        .set({
          status: "failed",
          finished_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(schema.agentSessions.id, params.sessionId));

      throw createError({ statusCode: 500, message });
    }
  });
}

/**
 * 清理会话 worktree（停止或结束会话时调用）。
 */
export async function cleanupSessionWorktree(params: {
  repositoryId: string;
  sessionId: string;
  actorId: string;
}) {
  const db = useDB();
  const runtimeConfig = resolveRuntimeConfig();
  const repository = await getRepositoryById(params.repositoryId);
  const [worktree] = await db
    .select()
    .from(schema.agentSessionWorktrees)
    .where(eq(schema.agentSessionWorktrees.session_id, params.sessionId))
    .limit(1);

  if (!worktree) {
    return { removed: false, reason: "worktree_not_found" as const };
  }

  return withRepositoryLock(params.repositoryId, async () => {
    const sessionPath = worktree.worktree_path;
    const repoRootPath = buildRepoPaths(repository, params.sessionId).repoRootPath;
    const shouldDeletePath = !runtimeConfig.keepWorktreeOnStop;

    if (runtimeConfig.mode === "local" && shouldDeletePath) {
      try {
        await runGit(["worktree", "remove", "--force", sessionPath], repoRootPath);
        await runGit(["worktree", "prune"], repoRootPath);
      } catch {
        // 失败时降级为目录清理，避免残留阻塞后续会话
      }
    }

    if (shouldDeletePath) {
      await rm(sessionPath, { recursive: true, force: true });
    }

    const [updated] = await db
      .update(schema.agentSessionWorktrees)
      .set({
        status: shouldDeletePath ? "removed" : "active",
        removed_at: shouldDeletePath ? new Date() : null,
        last_error: null,
        metadata: {
          ...(worktree.metadata as Record<string, unknown> || {}),
          keep_path_on_stop: runtimeConfig.keepWorktreeOnStop,
          cleaned_by: params.actorId,
        },
        updated_at: new Date(),
      })
      .where(eq(schema.agentSessionWorktrees.id, worktree.id))
      .returning();

    return {
      removed: shouldDeletePath,
      worktree: updated || worktree,
    };
  });
}

/**
 * 查询仓库 runtime 运行态摘要。
 */
export async function getRepoRuntimeSummary(params: {
  repositoryId: string;
}) {
  const db = useDB();
  const runtimeConfig = resolveRuntimeConfig();
  const repository = await getRepositoryById(params.repositoryId);
  const [runtime] = await db
    .select()
    .from(schema.agentRuntimes)
    .where(eq(schema.agentRuntimes.repository_id, params.repositoryId))
    .limit(1);

  const [activeSessionCountRow] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.agentSessions)
    .where(
      and(
        eq(schema.agentSessions.repository_id, params.repositoryId),
        inArray(schema.agentSessions.status, ["created", "preparing", "running"]),
      ),
    );

  const [activeWorktreeCountRow] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.agentSessionWorktrees)
    .where(
      and(
        eq(schema.agentSessionWorktrees.repository_id, params.repositoryId),
        inArray(schema.agentSessionWorktrees.status, ["preparing", "active"]),
      ),
    );

  const paths = buildRepoPaths(repository, "placeholder-session-id");

  return {
    repository_id: repository.id,
    repository_full_name: repository.full_name,
    mode: runtimeConfig.mode,
    root_dir: runtimeConfig.rootDir,
    repo_root_path: paths.repoRootPath,
    sessions_root_dir: runtimeConfig.sessionsRootDir,
    runtime: runtime || null,
    runtime_status: runtime?.status || "stopped",
    active_session_count: toNumber(activeSessionCountRow?.count),
    active_worktree_count: toNumber(activeWorktreeCountRow?.count),
  };
}

/**
 * 显式停止仓库 runtime。
 * force=true 时会先清理活跃 worktree，再将 runtime 标记为 stopped。
 */
export async function stopRepoRuntime(params: {
  repositoryId: string;
  actorId: string;
  force: boolean;
}) {
  const db = useDB();
  const [runtime] = await db
    .select()
    .from(schema.agentRuntimes)
    .where(eq(schema.agentRuntimes.repository_id, params.repositoryId))
    .limit(1);

  if (!runtime) {
    return {
      runtime: null,
      stopped: true,
      active_worktree_count: 0,
    };
  }

  const activeWorktrees = await db
    .select({
      session_id: schema.agentSessionWorktrees.session_id,
    })
    .from(schema.agentSessionWorktrees)
    .where(
      and(
        eq(schema.agentSessionWorktrees.repository_id, params.repositoryId),
        inArray(schema.agentSessionWorktrees.status, ["preparing", "active"]),
      ),
    );

  if (activeWorktrees.length > 0 && !params.force) {
    throw createError({
      statusCode: 409,
      message: "Runtime has active worktrees, use force=true to stop",
    });
  }

  if (params.force && activeWorktrees.length > 0) {
    for (const row of activeWorktrees) {
      await cleanupSessionWorktree({
        repositoryId: params.repositoryId,
        sessionId: row.session_id,
        actorId: params.actorId,
      });
    }

    await db
      .update(schema.agentSessions)
      .set({
        status: "stopped",
        finished_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(schema.agentSessions.repository_id, params.repositoryId),
          inArray(schema.agentSessions.status, ["created", "preparing", "running"]),
        ),
      );
  }

  const [updated] = await db
    .update(schema.agentRuntimes)
    .set({
      status: "stopped",
      last_heartbeat_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(schema.agentRuntimes.id, runtime.id))
    .returning();

  return {
    runtime: updated || runtime,
    stopped: true,
    active_worktree_count: activeWorktrees.length,
  };
}

export async function getSessionWorktreeBySessionId(params: {
  repositoryId: string;
  sessionId: string;
}) {
  const db = useDB();
  const [worktree] = await db
    .select()
    .from(schema.agentSessionWorktrees)
    .where(
      and(
        eq(schema.agentSessionWorktrees.repository_id, params.repositoryId),
        eq(schema.agentSessionWorktrees.session_id, params.sessionId),
      ),
    )
    .limit(1);

  return worktree || null;
}

export async function listRuntimeActiveSessions(params: {
  repositoryId: string;
}) {
  const db = useDB();
  return db
    .select({
      id: schema.agentSessions.id,
      status: schema.agentSessions.status,
      session_path: schema.agentSessions.session_path,
      working_branch: schema.agentSessions.working_branch,
      updated_at: schema.agentSessions.updated_at,
    })
    .from(schema.agentSessions)
    .where(
      and(
        eq(schema.agentSessions.repository_id, params.repositoryId),
        or(
          eq(schema.agentSessions.status, "created"),
          eq(schema.agentSessions.status, "preparing"),
          eq(schema.agentSessions.status, "running"),
        ),
      ),
    )
    .orderBy(schema.agentSessions.updated_at);
}
