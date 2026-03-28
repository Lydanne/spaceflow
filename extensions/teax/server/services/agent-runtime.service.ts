import { spawn } from "node:child_process";
import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { schema, useDB } from "~~/server/db";
import { resolveAgentMetaRepoConfig } from "~~/server/services/agent-meta-config.service";

const repoLocks = new Map<string, Promise<void>>();
const AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG = "teax-agent-runtime:base";

/**
 * Runtime 全局解析配置。
 * - rootDir/repo/session 为宿主机目录
 * - dockerWorkspaceRoot 为容器内工作根目录（默认 /runtime）
 */
interface RuntimeResolvedConfig {
  rootDir: string;
  sessionsRootDir: string;
  dockerBin: string;
  dockerBaseDockerfilePath: string;
  dockerBaseBuildContext: string;
  dockerBuildOnStart: boolean;
  dockerWorkspaceRoot: string;
  keepWorktreeOnStop: boolean;
}

interface RepoPathInfo {
  sessionPath: string;
}

/**
 * 容器内路径映射信息。
 * 每个会话 worktree 在容器内走 `containerSessionPath`，对应宿主机 `sessionPath`。
 */
interface RepoContainerPathInfo {
  containerSessionPath: string;
}

/**
 * Docker Runtime 启动/复用结果。
 * 该结构会写入 `agent_runtimes.metadata.docker`，用于后续排障与展示。
 */
interface DockerRuntimeEnsureResult {
  containerName: string;
  containerId: string;
  imageTag: string;
  baseImageTag: string;
  baseDockerfilePath: string;
  dockerfilePath: string;
  buildContext: string;
  dockerfileSource: "projects" | "globals" | "generated";
}

interface RepositorySnapshot {
  id: string;
  full_name: string;
  clone_url: string;
  default_branch: string | null;
}

interface DockerExecOptions {
  env?: Record<string, string>;
}

interface RuntimeGitAuth {
  username: string;
  token: string;
  tokenSource: "AGENT_META_REPO_TOKEN" | "AGENT_BOT_TOKEN" | "GITEA_SERVICE_TOKEN";
}

/**
 * `agent_runtimes.metadata.docker` 关键字段结构。
 * - meta_repo_container_path 固定为 `${AGENT_RUNTIME_ROOT}/.teax`
 * - 用于追踪当前 runtime 的镜像与挂载状态
 */
interface AgentRuntimeDockerMetadata {
  container_name: string;
  container_id: string;
  meta_repo_local_path: string;
  meta_repo_container_path: string;
  base_image_tag: string;
  base_dockerfile_path: string;
  image_tag: string;
  dockerfile_path: string;
  build_context: string;
  dockerfile_source: "projects" | "globals" | "generated";
}

/**
 * 解析运行时配置（固定 docker 模式）。
 */
function resolveRuntimeConfig(): RuntimeResolvedConfig {
  const config = useRuntimeConfig();
  const rawRoot = String(config.agentRuntimeRoot || ".teax-agent-runtime");
  const rootDir = isAbsolute(rawRoot) ? rawRoot : resolve(process.cwd(), rawRoot);
  const rawBaseDockerfile = String(config.agentRuntimeDockerBaseDockerfile || "").trim();
  const rawBaseBuildContext = String(config.agentRuntimeDockerBaseBuildContext || "").trim();
  const dockerBaseDockerfilePath = rawBaseDockerfile
    ? (isAbsolute(rawBaseDockerfile) ? rawBaseDockerfile : resolve(process.cwd(), rawBaseDockerfile))
    : "";
  const dockerBaseBuildContext = rawBaseBuildContext
    ? (isAbsolute(rawBaseBuildContext)
        ? rawBaseBuildContext
        : resolve(process.cwd(), rawBaseBuildContext))
    : resolve(process.cwd());

  return {
    rootDir,
    sessionsRootDir: join(rootDir, "sessions"),
    dockerBin: String(config.agentRuntimeDockerBin || "docker"),
    dockerBaseDockerfilePath,
    dockerBaseBuildContext,
    dockerBuildOnStart: config.agentRuntimeDockerBuildOnStart !== false,
    dockerWorkspaceRoot: String(config.agentRuntimeDockerWorkspaceRoot || "/runtime"),
    keepWorktreeOnStop: config.agentRuntimeKeepWorktreeOnStop === true,
  };
}

function buildWorkingBranch(sessionId: string, specified?: string): string {
  if (specified?.trim()) return specified.trim();
  return `agent/${sessionId.slice(0, 8)}`;
}

function buildRepoRuntimeKey(repositoryId: string): string {
  return `teax-agent-repo-${repositoryId.slice(0, 8)}`;
}

function toDockerSafeSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return normalized || "default";
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function stringifyForShell(part: string): string {
  if (!part) return "''";
  if (/^[a-zA-Z0-9._/:=@-]+$/.test(part)) {
    return part;
  }
  return JSON.stringify(part);
}

function formatCommand(bin: string, args: string[]): string {
  return [bin, ...args].map((part) => stringifyForShell(part)).join(" ");
}

function logRuntimeStep(step: string, payload?: Record<string, unknown>) {
  if (payload && Object.keys(payload).length > 0) {
    console.info(`[agent-runtime] ${step}`, payload);
    return;
  }
  console.info(`[agent-runtime] ${step}`);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runDocker(args: string[], cwd?: string, options?: { suppressErrorLog?: boolean }) {
  const config = resolveRuntimeConfig();
  const commandText = formatCommand(config.dockerBin, args);
  const startedAt = Date.now();
  const MAX_CAPTURE_BYTES = 20 * 1024 * 1024;
  logRuntimeStep("run command", {
    command: commandText,
    cwd: cwd || process.cwd(),
  });
  return await new Promise<{ stdout: string; stderr: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(config.dockerBin, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;

    const appendCapture = (
      current: string,
      incoming: string,
      truncated: boolean,
    ): { next: string; truncated: boolean } => {
      if (truncated || incoming.length === 0) {
        return { next: current, truncated };
      }
      const remaining = MAX_CAPTURE_BYTES - Buffer.byteLength(current);
      if (remaining <= 0) {
        return { next: current, truncated: true };
      }
      const incomingBytes = Buffer.byteLength(incoming);
      if (incomingBytes <= remaining) {
        return { next: current + incoming, truncated: false };
      }
      return {
        next: current + Buffer.from(incoming).subarray(0, remaining).toString("utf8"),
        truncated: true,
      };
    };

    const emitLines = (
      streamType: "stdout" | "stderr",
      text: string,
    ) => {
      if (!text) return;
      const isStdout = streamType === "stdout";
      const merged = (isStdout ? stdoutRemainder : stderrRemainder) + text;
      const lines = merged.split(/\r?\n/);
      const remainder = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        console.info(`[agent-runtime] command ${streamType}`, {
          command: commandText,
          line,
        });
      }
      if (isStdout) {
        stdoutRemainder = remainder;
      } else {
        stderrRemainder = remainder;
      }
    };

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const captured = appendCapture(stdoutBuffer, text, stdoutTruncated);
      stdoutBuffer = captured.next;
      stdoutTruncated = captured.truncated;
      emitLines("stdout", text);
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const captured = appendCapture(stderrBuffer, text, stderrTruncated);
      stderrBuffer = captured.next;
      stderrTruncated = captured.truncated;
      emitLines("stderr", text);
    });

    child.on("error", (error) => {
      if (!options?.suppressErrorLog) {
        console.error("[agent-runtime] command spawn failed", {
          command: commandText,
          duration_ms: Date.now() - startedAt,
          message: error.message,
        });
      }
      rejectPromise(error);
    });

    child.on("close", (code, signal) => {
      if (stdoutRemainder.trim()) {
        console.info("[agent-runtime] command stdout", {
          command: commandText,
          line: stdoutRemainder.trim(),
        });
      }
      if (stderrRemainder.trim()) {
        console.info("[agent-runtime] command stderr", {
          command: commandText,
          line: stderrRemainder.trim(),
        });
      }

      if (stdoutTruncated) {
        console.info("[agent-runtime] command stdout truncated", {
          command: commandText,
          limit_bytes: MAX_CAPTURE_BYTES,
        });
      }
      if (stderrTruncated) {
        console.info("[agent-runtime] command stderr truncated", {
          command: commandText,
          limit_bytes: MAX_CAPTURE_BYTES,
        });
      }

      const cleanedStdout = stdoutBuffer.trim();
      const cleanedStderr = stderrBuffer.trim();

      if (code === 0) {
        logRuntimeStep("command success", {
          command: commandText,
          duration_ms: Date.now() - startedAt,
        });
        resolvePromise({
          stdout: cleanedStdout,
          stderr: cleanedStderr,
        });
        return;
      }

      const message = `Command failed (${code ?? signal ?? "unknown"}): ${commandText}`;
      const error = new Error(message) as Error & {
        stdout?: string;
        stderr?: string;
        code?: number | null;
        signal?: NodeJS.Signals | null;
      };
      error.stdout = cleanedStdout;
      error.stderr = cleanedStderr;
      error.code = code;
      error.signal = signal;

      if (!options?.suppressErrorLog) {
        console.error("[agent-runtime] command failed", {
          command: commandText,
          duration_ms: Date.now() - startedAt,
          code,
          signal,
          stdout: cleanedStdout || undefined,
          stderr: cleanedStderr || undefined,
          message,
        });
      }
      rejectPromise(error);
    });
  });
}

async function runDockerExec(
  containerName: string,
  command: string[],
  options?: DockerExecOptions,
) {
  const args = ["exec"];
  if (options?.env) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push("-e", `${key}=${value}`);
    }
  }
  args.push(containerName, ...command);
  return runDocker(args);
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

async function resolveRuntimeGitAuth(): Promise<RuntimeGitAuth | null> {
  const metaRepoConfig = resolveAgentMetaRepoConfig();
  if (metaRepoConfig.token) {
    return {
      username: metaRepoConfig.botUsername || "TeaxBot",
      token: metaRepoConfig.token,
      tokenSource: metaRepoConfig.tokenSource,
    };
  }

  const runtimeConfig = useRuntimeConfig();
  const serviceToken = String(runtimeConfig.giteaServiceToken || "").trim();
  const giteaUrl = String(runtimeConfig.giteaUrl || "").trim().replace(/\/+$/, "");
  if (!serviceToken || !giteaUrl) {
    return null;
  }

  try {
    const profile = await $fetch<{ login?: string }>(`${giteaUrl}/api/v1/user`, {
      headers: {
        Authorization: `token ${serviceToken}`,
      },
    });
    const username = String(profile?.login || "").trim() || "oauth2";
    return {
      username,
      token: serviceToken,
      tokenSource: "GITEA_SERVICE_TOKEN",
    };
  } catch (error) {
    logRuntimeStep("resolve git auth fallback username", {
      message: (error as { message?: string })?.message || "unknown",
    });
    return {
      username: "oauth2",
      token: serviceToken,
      tokenSource: "GITEA_SERVICE_TOKEN",
    };
  }
}

async function ensureDockerGitCredentials(params: {
  runtimeKey: string;
  cloneUrl: string;
}) {
  let parsedCloneUrl: URL | null = null;
  try {
    parsedCloneUrl = new URL(params.cloneUrl);
  } catch {
    return;
  }
  if (!/^https?:$/.test(parsedCloneUrl.protocol)) {
    return;
  }

  const auth = await resolveRuntimeGitAuth();
  if (!auth) {
    return;
  }

  const runtimeConfig = resolveRuntimeConfig();
  const hostMetaRepoPath = join(runtimeConfig.rootDir, ".teax");
  const hostCredentialsPath = join(hostMetaRepoPath, "git-credentials");
  const containerCredentialsPath = posix.join(runtimeConfig.dockerWorkspaceRoot, ".teax", "git-credentials");
  await mkdir(hostMetaRepoPath, { recursive: true });

  const credentialUrl = new URL(`${parsedCloneUrl.protocol}//${parsedCloneUrl.host}/`);
  credentialUrl.username = auth.username;
  credentialUrl.password = auth.token;
  const credentialLine = credentialUrl.toString();

  let existingLines: string[] = [];
  try {
    const current = await readFile(hostCredentialsPath, "utf8");
    existingLines = current.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    existingLines = [];
  }

  const filteredLines = existingLines.filter((line) => {
    try {
      return new URL(line).host !== parsedCloneUrl.host;
    } catch {
      return true;
    }
  });
  filteredLines.push(credentialLine);
  await writeFile(hostCredentialsPath, `${filteredLines.join("\n")}\n`, { mode: 0o600 });
  await chmod(hostCredentialsPath, 0o600);

  await runDockerExec(params.runtimeKey, [
    "git",
    "config",
    "--global",
    "credential.helper",
    `store --file ${containerCredentialsPath}`,
  ]);
  await runDockerExec(params.runtimeKey, [
    "git",
    "config",
    "--global",
    "credential.useHttpPath",
    "false",
  ]);
  await runDockerExec(params.runtimeKey, [
    "git",
    "config",
    "--global",
    "credential.username",
    auth.username,
  ]);

  logRuntimeStep("runtime git credentials ready", {
    runtime_key: params.runtimeKey,
    clone_host: parsedCloneUrl.host,
    token_source: auth.tokenSource,
    username: auth.username,
  });
}

function buildRepoPaths(sessionId: string): RepoPathInfo {
  const config = resolveRuntimeConfig();
  const sessionPath = join(config.sessionsRootDir, sessionId);
  return { sessionPath };
}

function buildRepoContainerPaths(sessionId: string): RepoContainerPathInfo {
  const config = resolveRuntimeConfig();
  return {
    containerSessionPath: posix.join(config.dockerWorkspaceRoot, "sessions", sessionId),
  };
}

async function inspectDockerContainer(containerName: string) {
  try {
    const result = await runDocker([
      "inspect",
      "--format",
      "{{.Id}}|{{.State.Running}}|{{.Config.Image}}",
      containerName,
    ], undefined, {
      suppressErrorLog: true,
    });
    const [containerId, runningRaw, imageTag] = result.stdout.split("|");
    return {
      containerId: (containerId || "").trim(),
      running: (runningRaw || "").trim() === "true",
      imageTag: (imageTag || "").trim(),
    };
  } catch (error) {
    const stderr = ((error as { stderr?: string })?.stderr || "").trim();
    if (/no such object/i.test(stderr)) {
      logRuntimeStep("docker inspect container not found", {
        container_name: containerName,
      });
      return null;
    }
    console.error("[agent-runtime] docker inspect failed", {
      container_name: containerName,
      stderr: stderr || undefined,
      message: (error as { message?: string })?.message || "unknown",
    });
    return null;
  }
}

function rewriteDockerfileToUseBaseImage(content: string) {
  const lines = content.split(/\r?\n/);
  let replaced = false;
  const rewritten = lines.map((line) => {
    if (replaced) {
      return line;
    }
    const fromMatch = line.match(/^\s*FROM\s+\S+(\s+AS\s+\S+)?\s*$/i);
    if (!fromMatch) {
      return line;
    }
    replaced = true;
    const stageAlias = fromMatch[1] || "";
    return `FROM ${AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG}${stageAlias}`;
  });

  return replaced
    ? rewritten.join("\n")
    : `FROM ${AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG}\n${rewritten.join("\n")}`;
}

async function ensureDockerBaseBuildSpec() {
  const runtimeConfig = resolveRuntimeConfig();
  if (runtimeConfig.dockerBaseDockerfilePath) {
    if (!await pathExists(runtimeConfig.dockerBaseDockerfilePath)) {
      throw createError({
        statusCode: 500,
        message: `Base Dockerfile not found: ${runtimeConfig.dockerBaseDockerfilePath}`,
      });
    }
    const buildContext = runtimeConfig.dockerBaseBuildContext || resolve(dirname(runtimeConfig.dockerBaseDockerfilePath));
    return {
      dockerfilePath: runtimeConfig.dockerBaseDockerfilePath,
      buildContext,
      imageTag: AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG,
      generated: false,
    };
  }

  const generatedContext = join(runtimeConfig.rootDir, "docker-build", "base");
  const generatedDockerfile = join(generatedContext, "Dockerfile.base");
  await mkdir(generatedContext, { recursive: true });
  await writeFile(
    generatedDockerfile,
    [
      "FROM node:24-bookworm",
      "ENV DEBIAN_FRONTEND=noninteractive",
      "RUN set -eux; \\",
      "    attempts=0; \\",
      "    until apt-get update -o Acquire::Retries=3; do \\",
      "      attempts=$((attempts + 1)); \\",
      "      if [ \"$attempts\" -ge 5 ]; then \\",
      "        echo \"apt-get update failed after $attempts attempts\"; \\",
      "        exit 1; \\",
      "      fi; \\",
      "      echo \"apt-get update failed, retrying in 20s...\"; \\",
      "      sleep 20; \\",
      "    done; \\",
      "    apt-get install -y --no-install-recommends \\",
      "      git ca-certificates curl wget openssh-client bash; \\",
      "    rm -rf /var/lib/apt/lists/*",
      "RUN set -eux; \\",
      "    unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy; \\",
      "    npm config delete proxy || true; \\",
      "    npm config delete https-proxy || true; \\",
      "    attempts=0; \\",
      "    until npm install -g --no-audit --no-fund opencode-ai@latest; do \\",
      "      attempts=$((attempts + 1)); \\",
      "      if [ \"$attempts\" -ge 5 ]; then \\",
      "        echo \"npm install failed after $attempts attempts\"; \\",
      "        exit 1; \\",
      "      fi; \\",
      "      echo \"npm install failed, retrying in 20s...\"; \\",
      "      sleep 20; \\",
      "    done",
      "WORKDIR /runtime",
      "CMD [\"sleep\", \"infinity\"]",
      "",
    ].join("\n"),
  );

  return {
    dockerfilePath: generatedDockerfile,
    buildContext: runtimeConfig.dockerBaseBuildContext || generatedContext,
    imageTag: AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG,
    generated: true,
  };
}

async function ensureRepoDockerfileAndContext(params: {
  repository: RepositorySnapshot;
}) {
  const runtimeConfig = resolveRuntimeConfig();
  const generatedContext = join(runtimeConfig.rootDir, "docker-build", params.repository.id);
  const generatedDockerfile = join(generatedContext, "Dockerfile.repo");
  await mkdir(generatedContext, { recursive: true });

  const repoSegments = params.repository.full_name.split("/").map((item) => item.trim()).filter(Boolean);
  const dockerfileCandidates: Array<{ source: "projects" | "globals"; path: string }> = [
    {
      source: "projects",
      path: join(runtimeConfig.rootDir, ".teax", "projects", ...repoSegments, "Dockerfile"),
    },
    {
      source: "globals",
      path: join(runtimeConfig.rootDir, ".teax", "globals", "Dockerfile"),
    },
  ];

  for (const candidate of dockerfileCandidates) {
    if (!await pathExists(candidate.path)) {
      continue;
    }
    const rawDockerfile = await readFile(candidate.path, "utf8");
    const rewrittenDockerfile = rewriteDockerfileToUseBaseImage(rawDockerfile);
    await writeFile(generatedDockerfile, rewrittenDockerfile);
    return {
      dockerfilePath: generatedDockerfile,
      sourceDockerfilePath: candidate.path,
      buildContext: resolve(dirname(candidate.path)),
      dockerfileSource: candidate.source,
      generated: true,
    };
  }

  await writeFile(
    generatedDockerfile,
    [
      `FROM ${AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG}`,
      "WORKDIR /runtime",
      "CMD [\"sleep\", \"infinity\"]",
      "",
    ].join("\n"),
  );
  return {
    dockerfilePath: generatedDockerfile,
    sourceDockerfilePath: generatedDockerfile,
    buildContext: generatedContext,
    dockerfileSource: "generated" as const,
    generated: true,
  };
}

async function ensureDockerRuntimeContainer(params: {
  repository: RepositorySnapshot;
  runtimeKey: string;
}): Promise<DockerRuntimeEnsureResult> {
  const runtimeConfig = resolveRuntimeConfig();
  const metaRepoLocalPath = join(runtimeConfig.rootDir, ".teax");
  const imageTag = `teax-agent-runtime:${toDockerSafeSegment(`${params.repository.full_name}-${params.repository.id.slice(0, 8)}`)}`;
  const containerName = params.runtimeKey;
  const containerSessionsRoot = posix.join(runtimeConfig.dockerWorkspaceRoot, "sessions");
  // 容器内元数据挂载点：${AGENT_RUNTIME_ROOT}/.teax
  const containerMetaRepoRoot = posix.join(runtimeConfig.dockerWorkspaceRoot, ".teax");
  logRuntimeStep("runtime bootstrap begin", {
    repository_id: params.repository.id,
    repository_full_name: params.repository.full_name,
    runtime_key: params.runtimeKey,
    image_tag: imageTag,
  });

  await mkdir(runtimeConfig.sessionsRootDir, { recursive: true });
  await mkdir(metaRepoLocalPath, { recursive: true });
  await mkdir(join(metaRepoLocalPath, "projects"), { recursive: true });
  await mkdir(join(metaRepoLocalPath, "globals"), { recursive: true });

  const existing = await inspectDockerContainer(containerName);
  if (existing?.running) {
    logRuntimeStep("runtime bootstrap reuse running container", {
      container_name: containerName,
      container_id: existing.containerId,
      image_tag: existing.imageTag || imageTag,
    });
    const repoBuildSpec = await ensureRepoDockerfileAndContext({
      repository: params.repository,
    });
    return {
      containerName,
      containerId: existing.containerId,
      imageTag: existing.imageTag || imageTag,
      baseImageTag: AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG,
      baseDockerfilePath: runtimeConfig.dockerBaseDockerfilePath || "",
      dockerfilePath: repoBuildSpec.sourceDockerfilePath,
      buildContext: repoBuildSpec.buildContext,
      dockerfileSource: repoBuildSpec.dockerfileSource,
    };
  }

  if (!runtimeConfig.dockerBuildOnStart && existing && !existing.running) {
    logRuntimeStep("runtime bootstrap start existing stopped container", {
      container_name: containerName,
    });
    const repoBuildSpec = await ensureRepoDockerfileAndContext({
      repository: params.repository,
    });
    await runDocker(["start", containerName]);
    const started = await inspectDockerContainer(containerName);
    if (!started?.running) {
      throw createError({ statusCode: 500, message: `Failed to start docker runtime: ${containerName}` });
    }
    return {
      containerName,
      containerId: started.containerId,
      imageTag: started.imageTag || imageTag,
      baseImageTag: AGENT_RUNTIME_FIXED_BASE_IMAGE_TAG,
      baseDockerfilePath: runtimeConfig.dockerBaseDockerfilePath || "",
      dockerfilePath: repoBuildSpec.sourceDockerfilePath,
      buildContext: repoBuildSpec.buildContext,
      dockerfileSource: repoBuildSpec.dockerfileSource,
    };
  }

  const baseBuildSpec = await ensureDockerBaseBuildSpec();
  const repoBuildSpec = await ensureRepoDockerfileAndContext({
    repository: params.repository,
  });

  if (runtimeConfig.dockerBuildOnStart || !existing) {
    // 第一步：先构建基础镜像。
    logRuntimeStep("runtime bootstrap step 1/4 build base image", {
      dockerfile: baseBuildSpec.dockerfilePath,
      context: baseBuildSpec.buildContext,
      image_tag: baseBuildSpec.imageTag,
    });
    await runDocker([
      "build",
      "-f",
      baseBuildSpec.dockerfilePath,
      "-t",
      baseBuildSpec.imageTag,
      baseBuildSpec.buildContext,
    ]);
    // 第二步：再基于基础镜像构建仓库运行镜像。
    logRuntimeStep("runtime bootstrap step 2/4 build repo image", {
      dockerfile: repoBuildSpec.dockerfilePath,
      source_dockerfile: repoBuildSpec.sourceDockerfilePath,
      dockerfile_source: repoBuildSpec.dockerfileSource,
      context: repoBuildSpec.buildContext,
      image_tag: imageTag,
      base_image_tag: baseBuildSpec.imageTag,
    });
    await runDocker([
      "build",
      "-f",
      repoBuildSpec.dockerfilePath,
      "-t",
      imageTag,
      repoBuildSpec.buildContext,
    ]);
  }

  if (existing) {
    logRuntimeStep("runtime bootstrap step 3/4 remove old container", {
      container_name: containerName,
    });
    await stopAndRemoveDockerContainer(containerName);
  }

  logRuntimeStep("runtime bootstrap step 4/4 run container", {
    container_name: containerName,
    image_tag: imageTag,
    mount_session_root: runtimeConfig.sessionsRootDir,
    mount_meta_repo: metaRepoLocalPath,
    workspace_root: runtimeConfig.dockerWorkspaceRoot,
  });
  await runDocker([
    "run",
    "-d",
    "--name",
    containerName,
    "--restart",
    "unless-stopped",
    "--label",
    "teax.agent-runtime=true",
    "--label",
    `teax.repository-id=${params.repository.id}`,
    "-v",
    `${runtimeConfig.sessionsRootDir}:${containerSessionsRoot}`,
    "-v",
    `${metaRepoLocalPath}:${containerMetaRepoRoot}`,
    "-w",
    runtimeConfig.dockerWorkspaceRoot,
    "-e",
    `AGENT_RUNTIME_ROOT=${runtimeConfig.dockerWorkspaceRoot}`,
    "-e",
    `AGENT_META_REPO_DIR=${containerMetaRepoRoot}`,
    "-e",
    `TEAX_REPOSITORY_ID=${params.repository.id}`,
    "-e",
    `TEAX_REPOSITORY_FULL_NAME=${params.repository.full_name}`,
    imageTag,
    "sleep",
    "infinity",
  ]);

  const checked = await inspectDockerContainer(containerName);
  if (!checked?.running) {
    throw createError({ statusCode: 500, message: `Failed to start docker runtime: ${containerName}` });
  }
  logRuntimeStep("runtime bootstrap completed", {
    container_name: containerName,
    container_id: checked.containerId,
    image_tag: checked.imageTag || imageTag,
  });

  return {
    containerName,
    containerId: checked.containerId,
    imageTag: checked.imageTag || imageTag,
    baseImageTag: baseBuildSpec.imageTag,
    baseDockerfilePath: baseBuildSpec.dockerfilePath,
    dockerfilePath: repoBuildSpec.sourceDockerfilePath,
    buildContext: repoBuildSpec.buildContext,
    dockerfileSource: repoBuildSpec.dockerfileSource,
  };
}

async function stopAndRemoveDockerContainer(containerName: string) {
  const container = await inspectDockerContainer(containerName);
  if (!container) {
    return false;
  }
  if (container.running) {
    await runDocker(["stop", containerName]);
  }
  await runDocker(["rm", containerName]);
  return true;
}

/**
 * 确保仓库 runtime 可用。
 * 固定 docker 模式：构建并启动仓库级容器，然后落库状态。
 */
export async function ensureRepoRuntime(params: {
  repositoryId: string;
  actorId: string;
}) {
  const db = useDB();
  const runtimeConfig = resolveRuntimeConfig();
  const metaRepoConfig = resolveAgentMetaRepoConfig();
  const repository = await getRepositoryById(params.repositoryId);
  logRuntimeStep("ensure repo runtime begin", {
    repository_id: params.repositoryId,
    actor_id: params.actorId,
    repository_full_name: repository.full_name,
  });

  await mkdir(runtimeConfig.sessionsRootDir, { recursive: true });

  return withRepositoryLock(params.repositoryId, async () => {
    logRuntimeStep("ensure repo runtime lock acquired", {
      repository_id: params.repositoryId,
    });
    const now = new Date();
    const [existing] = await db
      .select()
      .from(schema.agentRuntimes)
      .where(eq(schema.agentRuntimes.repository_id, params.repositoryId))
      .limit(1);

    const runtimeKey = existing?.runtime_key || buildRepoRuntimeKey(params.repositoryId);
    const provider = "docker";
    let metadata: Record<string, unknown> = {
      ...(existing?.metadata as Record<string, unknown> || {}),
      root_dir: runtimeConfig.rootDir,
      repo_root_path: "",
      sessions_root_dir: runtimeConfig.sessionsRootDir,
      mode: "docker",
      meta_repo: {
        url: metaRepoConfig.url || null,
        branch: metaRepoConfig.branch,
        auth_type: metaRepoConfig.authType,
        token_source: metaRepoConfig.tokenSource,
        token_configured: Boolean(metaRepoConfig.token),
        bot_username: metaRepoConfig.botUsername,
        bot_email: metaRepoConfig.botEmail,
      },
    };

    const dockerRuntime = await ensureDockerRuntimeContainer({
      repository,
      runtimeKey,
    });
    const dockerMetadata: AgentRuntimeDockerMetadata = {
      container_name: dockerRuntime.containerName,
      container_id: dockerRuntime.containerId,
      meta_repo_local_path: join(runtimeConfig.rootDir, ".teax"),
      meta_repo_container_path: posix.join(runtimeConfig.dockerWorkspaceRoot, ".teax"),
      base_image_tag: dockerRuntime.baseImageTag,
      base_dockerfile_path: dockerRuntime.baseDockerfilePath,
      image_tag: dockerRuntime.imageTag,
      dockerfile_path: dockerRuntime.dockerfilePath,
      build_context: dockerRuntime.buildContext,
      dockerfile_source: dockerRuntime.dockerfileSource,
    };
    metadata = {
      ...metadata,
      docker: dockerMetadata,
    };

    if (existing) {
      const [updated] = await db
        .update(schema.agentRuntimes)
        .set({
          provider,
          runtime_key: runtimeKey,
          status: "running",
          last_heartbeat_at: now,
          last_error: null,
          metadata,
          updated_at: now,
        })
        .where(eq(schema.agentRuntimes.id, existing.id))
        .returning();

      return {
        runtime: updated || existing,
        repository,
        mode: provider,
      };
    }

    const [created] = await db
      .insert(schema.agentRuntimes)
      .values({
        scope: "repo",
        repository_id: params.repositoryId,
        provider,
        runtime_key: runtimeKey,
        status: "running",
        last_heartbeat_at: now,
        metadata,
        row_creator: params.actorId,
      })
      .returning();

    if (!created) {
      throw createError({ statusCode: 500, message: "Failed to ensure runtime" });
    }

    return {
      runtime: created,
      repository,
      mode: provider,
    };
  });
}

async function prepareWorktreeInDockerMode(params: {
  repository: RepositorySnapshot;
  sessionId: string;
  runtimeId: string;
  runtimeKey: string;
  baseBranch: string;
  workingBranch: string;
  actorId: string;
}) {
  const db = useDB();
  const paths = buildRepoPaths(params.sessionId);
  const containerPaths = buildRepoContainerPaths(params.sessionId);
  const gitExecOptions: DockerExecOptions = {
    env: {
      GIT_TERMINAL_PROMPT: "0",
    },
  };

  await mkdir(resolveRuntimeConfig().sessionsRootDir, { recursive: true });
  await ensureDockerGitCredentials({
    runtimeKey: params.runtimeKey,
    cloneUrl: params.repository.clone_url,
  });

  if (await pathExists(paths.sessionPath)) {
    await rm(paths.sessionPath, { recursive: true, force: true });
  }

  await runDockerExec(params.runtimeKey, [
    "git",
    "clone",
    "--branch",
    params.baseBranch,
    "--single-branch",
    "--origin",
    "origin",
    params.repository.clone_url,
    containerPaths.containerSessionPath,
  ], gitExecOptions);
  await runDockerExec(params.runtimeKey, [
    "git",
    "-C",
    containerPaths.containerSessionPath,
    "checkout",
    "-B",
    params.workingBranch,
    `origin/${params.baseBranch}`,
  ], gitExecOptions);
  await runDockerExec(params.runtimeKey, [
    "git",
    "-C",
    containerPaths.containerSessionPath,
    "reset",
    "--hard",
  ], gitExecOptions);
  await runDockerExec(params.runtimeKey, [
    "git",
    "-C",
    containerPaths.containerSessionPath,
    "clean",
    "-fd",
  ], gitExecOptions);

  const [headResult, branchResult] = await Promise.all([
    runDockerExec(params.runtimeKey, [
      "git",
      "-C",
      containerPaths.containerSessionPath,
      "rev-parse",
      "HEAD",
    ], gitExecOptions),
    runDockerExec(params.runtimeKey, [
      "git",
      "-C",
      containerPaths.containerSessionPath,
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ], gitExecOptions),
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
        mode: "docker",
        container_name: params.runtimeKey,
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
          mode: "docker",
          container_name: params.runtimeKey,
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
    mode: "docker" as const,
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
      const prepared = await prepareWorktreeInDockerMode({
        repository,
        sessionId: params.sessionId,
        runtimeId: runtimeResult.runtime.id,
        runtimeKey: runtimeResult.runtime.runtime_key || buildRepoRuntimeKey(params.repositoryId),
        baseBranch,
        workingBranch,
        actorId: params.actorId,
      });

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
          worktree_path: buildRepoPaths(params.sessionId).sessionPath,
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
            worktree_path: buildRepoPaths(params.sessionId).sessionPath,
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
    const shouldDeletePath = !runtimeConfig.keepWorktreeOnStop;

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

  let runtimeStatus = runtime?.status || "stopped";

  // docker 运行态以容器实时状态为准，避免 DB 状态陈旧导致前端误判。
  if (runtime?.provider === "docker") {
    const runtimeKey = runtime.runtime_key || buildRepoRuntimeKey(params.repositoryId);
    const inspected = await inspectDockerContainer(runtimeKey);
    runtimeStatus = inspected?.running ? "running" : "stopped";
  }

  return {
    repository_id: repository.id,
    repository_full_name: repository.full_name,
    mode: "docker",
    root_dir: runtimeConfig.rootDir,
    repo_root_path: "",
    sessions_root_dir: runtimeConfig.sessionsRootDir,
    runtime: runtime || null,
    runtime_status: runtimeStatus,
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

  if (runtime.provider === "docker") {
    const runtimeKey = runtime.runtime_key || buildRepoRuntimeKey(params.repositoryId);
    await stopAndRemoveDockerContainer(runtimeKey);
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
