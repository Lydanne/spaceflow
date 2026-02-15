import type { RemoteRepoRef, GitProviderType } from "./types";
import { detectProvider } from "./detect-provider";

/** 已知的 GitHub 域名 */
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** 已知的 GitLab 域名 */
const GITLAB_HOSTS = new Set(["gitlab.com", "www.gitlab.com"]);

/**
 * 解析浏览器中复制的仓库 URL 为结构化的仓库引用
 *
 * 支持的 URL 格式：
 * - Gitea 仓库：https://git.example.com/owner/repo
 * - Gitea 目录：https://git.example.com/owner/repo/src/branch/main/path/to/dir
 * - Gitea 标签：https://git.example.com/owner/repo/src/tag/v1.0/path/to/dir
 * - Gitea commit：https://git.example.com/owner/repo/src/commit/abc123/path/to/dir
 * - GitHub 仓库：https://github.com/owner/repo
 * - GitHub 目录：https://github.com/owner/repo/tree/main/path/to/dir
 * - GitLab 仓库：https://gitlab.com/owner/repo
 * - GitLab 目录：https://gitlab.com/owner/repo/-/tree/main/path/to/dir
 * - git+ssh URL：git+ssh://git@host/owner/repo.git
 * - SSH URL：git@host:owner/repo.git
 *
 * @returns 解析后的仓库引用，无法解析时返回 null
 */
export function parseRepoUrl(url: string): RemoteRepoRef | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  // SSH 格式: git@host:owner/repo.git
  if (trimmed.startsWith("git@")) {
    return parseSshUrl(trimmed);
  }
  // git+ssh:// 格式
  if (trimmed.startsWith("git+ssh://")) {
    return parseGitSshUrl(trimmed);
  }
  // HTTP(S) URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return parseHttpUrl(trimmed);
  }
  return null;
}

/** 解析 HTTP(S) URL */
function parseHttpUrl(url: string): RemoteRepoRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const hostname = parsed.hostname;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  const serverUrl = `${parsed.protocol}//${parsed.host}`;
  const isGithub = isGithubHost(hostname);
  const isGitlab = isGitlabHost(hostname);
  const provider: GitProviderType = isGithub
    ? "github"
    : isGitlab
      ? "gitlab"
      : detectProviderForHost(serverUrl);
  // 仓库根目录（只有 owner/repo）
  if (segments.length === 2) {
    return { owner, repo, path: "", provider, serverUrl };
  }
  // GitHub: /owner/repo/tree/branch/path...
  if (isGithub && segments[2] === "tree" && segments.length >= 4) {
    const ref = segments[3];
    const path = segments.slice(4).join("/");
    return { owner, repo, path, ref, provider, serverUrl };
  }
  // GitLab: /owner/repo/-/tree/branch/path...
  if (segments[2] === "-" && segments[3] === "tree" && segments.length >= 5) {
    const ref = segments[4];
    const path = segments.slice(5).join("/");
    return { owner, repo, path, ref, provider: isGitlab ? "gitlab" : provider, serverUrl };
  }
  // Gitea: /owner/repo/src/branch/<branch>/path...
  //        /owner/repo/src/tag/<tag>/path...
  //        /owner/repo/src/commit/<sha>/path...
  if (segments[2] === "src" && segments.length >= 4) {
    const refType = segments[3]; // "branch", "tag", "commit"
    if (
      (refType === "branch" || refType === "tag" || refType === "commit") &&
      segments.length >= 5
    ) {
      const ref = segments[4];
      const path = segments.slice(5).join("/");
      return { owner, repo, path, ref, provider: "gitea", serverUrl };
    }
  }
  // 无法识别的子路径，当作仓库根目录
  return { owner, repo, path: "", provider, serverUrl };
}

/** 解析 git@host:owner/repo.git 格式 */
function parseSshUrl(url: string): RemoteRepoRef | null {
  const match = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (!match) return null;
  const host = match[1];
  const pathPart = match[2];
  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1];
  const serverUrl = `https://${host}`;
  const provider: GitProviderType = isGithubHost(host)
    ? "github"
    : isGitlabHost(host)
      ? "gitlab"
      : detectProviderForHost(serverUrl);
  return { owner, repo, path: "", provider, serverUrl };
}

/** 解析 git+ssh://git@host/owner/repo.git 格式 */
function parseGitSshUrl(url: string): RemoteRepoRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url.replace("git+ssh://", "ssh://"));
  } catch {
    return null;
  }
  const host = parsed.hostname;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  const serverUrl = `https://${host}`;
  const provider: GitProviderType = isGithubHost(host)
    ? "github"
    : isGitlabHost(host)
      ? "gitlab"
      : detectProviderForHost(serverUrl);
  return { owner, repo, path: "", provider, serverUrl };
}

/** 判断是否为 GitHub 域名 */
function isGithubHost(hostname: string): boolean {
  return GITHUB_HOSTS.has(hostname) || hostname.endsWith(".github.com");
}

/** 判断是否为 GitLab 域名 */
function isGitlabHost(hostname: string): boolean {
  return GITLAB_HOSTS.has(hostname) || hostname.endsWith(".gitlab.com");
}

/** 根据服务器 URL 检测 provider 类型（非 GitHub/GitLab 默认为 Gitea） */
function detectProviderForHost(serverUrl: string): GitProviderType {
  const detected = detectProvider({ GIT_PROVIDER_URL: serverUrl });
  return detected.provider;
}
