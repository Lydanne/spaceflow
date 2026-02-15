import type { GitProviderType } from "./types";

/** 环境检测结果 */
export interface DetectedProviderInfo {
  /** 检测到的 provider 类型 */
  provider: GitProviderType;
  /** 检测到的服务器 URL */
  serverUrl: string;
  /** 检测到的 API Token */
  token: string;
  /** 检测来源说明 */
  source: string;
}

/**
 * 从环境变量自动检测 Git Provider 类型和配置
 *
 * 检测优先级：
 * 1. 显式指定 `GIT_PROVIDER_TYPE` 环境变量（最高优先级）
 * 2. 存在 `GITEA_TOKEN` → Gitea
 * 3. 存在 `GITLAB_TOKEN` 或 `CI_JOB_TOKEN`（GitLab CI）→ GitLab
 * 4. 存在 `GITHUB_TOKEN` → GitHub
 * 5. 默认 → GitHub
 */
export function detectProvider(
  env: Record<string, string | undefined> = process.env,
): DetectedProviderInfo {
  const explicit = env.GIT_PROVIDER_TYPE as GitProviderType | undefined;
  if (explicit && isValidProvider(explicit)) {
    return buildResult(explicit, env, "GIT_PROVIDER_TYPE 环境变量");
  }
  if (env.GITEA_TOKEN) {
    return buildResult("gitea", env, "检测到 GITEA_TOKEN");
  }
  if (env.GITLAB_TOKEN || env.CI_JOB_TOKEN) {
    return buildResult(
      "gitlab",
      env,
      env.GITLAB_TOKEN ? "检测到 GITLAB_TOKEN" : "检测到 CI_JOB_TOKEN（GitLab CI）",
    );
  }
  if (env.GITHUB_TOKEN) {
    return buildResult("github", env, "检测到 GITHUB_TOKEN");
  }
  return buildResult("github", env, "默认");
}

/** 检查是否为有效的 provider 类型 */
function isValidProvider(value: string): value is GitProviderType {
  return value === "gitea" || value === "github" || value === "gitlab";
}

/** 根据 provider 类型从环境变量中提取 serverUrl 和 token */
function buildResult(
  provider: GitProviderType,
  env: Record<string, string | undefined>,
  source: string,
): DetectedProviderInfo {
  const serverUrl = resolveServerUrl(provider, env);
  const token = resolveToken(provider, env);
  return { provider, serverUrl, token, source };
}

/**
 * 解析服务器 URL
 * - 优先使用 GIT_PROVIDER_URL
 * - Gitea: GITEA_SERVER_URL > GITHUB_SERVER_URL
 * - GitHub: GITHUB_API_URL > 默认 https://api.github.com
 * - GitLab: CI_SERVER_URL > GITLAB_URL
 */
function resolveServerUrl(
  provider: GitProviderType,
  env: Record<string, string | undefined>,
): string {
  if (env.GIT_PROVIDER_URL) {
    return env.GIT_PROVIDER_URL;
  }
  if (provider === "github") {
    return env.GITHUB_API_URL || "https://api.github.com";
  }
  if (provider === "gitlab") {
    return env.CI_SERVER_URL || env.GITLAB_URL || "https://gitlab.com";
  }
  // Gitea: 优先 GITEA_SERVER_URL，其次从 GITHUB_SERVER_URL 推导
  if (env.GITEA_SERVER_URL) {
    return env.GITEA_SERVER_URL;
  }
  if (env.GITHUB_SERVER_URL) {
    return env.GITHUB_SERVER_URL;
  }
  return "";
}

/**
 * 解析 API Token
 * - 优先使用 GIT_PROVIDER_TOKEN
 * - Gitea: GITEA_TOKEN > GITHUB_TOKEN
 * - GitHub: GITHUB_TOKEN
 * - GitLab: GITLAB_TOKEN > CI_JOB_TOKEN
 */
function resolveToken(provider: GitProviderType, env: Record<string, string | undefined>): string {
  if (env.GIT_PROVIDER_TOKEN) {
    return env.GIT_PROVIDER_TOKEN;
  }
  if (provider === "github") {
    return env.GITHUB_TOKEN || "";
  }
  if (provider === "gitlab") {
    return env.GITLAB_TOKEN || env.CI_JOB_TOKEN || "";
  }
  return env.GITEA_TOKEN || env.GITHUB_TOKEN || "";
}
