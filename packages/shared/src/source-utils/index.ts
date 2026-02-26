/**
 * Source 类型定义
 */
export type SourceType = "npm" | "git" | "local";

/**
 * 判断是否为 Git URL
 * 支持: git@xxx.git, https://xxx.git, git+ssh://xxx, git+https://xxx
 */
export function isGitUrl(source: string): boolean {
  return (
    source.startsWith("git@") ||
    source.startsWith("git+") ||
    (source.startsWith("https://") && source.endsWith(".git")) ||
    source.endsWith(".git")
  );
}

/**
 * 判断是否为本地路径
 * 支持: ./path, ../path, /path, link:./path, skills/
 */
export function isLocalPath(source: string): boolean {
  return (
    source.startsWith("workspace:") ||
    source.startsWith("link:") ||
    source.startsWith("./") ||
    source.startsWith("../") ||
    source.startsWith("/") ||
    source.startsWith("skills/")
  );
}

/**
 * 获取 source 类型
 */
export function getSourceType(source: string): SourceType {
  if (isLocalPath(source)) return "local";
  if (isGitUrl(source)) return "git";
  return "npm";
}

/**
 * 规范化 source（移除 link: 前缀等）
 */
export function normalizeSource(source: string): string {
  if (source.startsWith("link:")) {
    return source.substring(5); // 移除 "link:" 前缀
  }
  return source;
}

/**
 * 从 npm 包名中提取纯包名（去除版本号后缀）
 * 例如: @spaceflow/review@0.10.0 → @spaceflow/review
 *       some-package@1.2.3 → some-package
 */
export function extractNpmPackageName(source: string): string {
  // 处理 scoped 包: @scope/name@version
  if (source.startsWith("@")) {
    const slashIndex = source.indexOf("/");
    if (slashIndex !== -1) {
      const afterSlash = source.substring(slashIndex + 1);
      const atIndex = afterSlash.indexOf("@");
      if (atIndex !== -1) {
        return source.substring(0, slashIndex + 1 + atIndex);
      }
    }
    return source;
  }
  // 处理普通包: name@version
  const atIndex = source.indexOf("@");
  if (atIndex !== -1) {
    return source.substring(0, atIndex);
  }
  return source;
}

/**
 * 从 source 提取名称
 * npm 包: @scope/package -> package
 * git URL: git@git.example.com:org/repo.git -> repo
 * 本地路径: ./skills/publish -> publish
 */
export function extractName(source: string): string {
  if (isLocalPath(source)) {
    // 本地路径：取最后一个目录名
    const parts = source.replace(/\/$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "unknown";
  } else if (isGitUrl(source)) {
    let path = source;
    path = path.replace(/\.git$/, "");
    path = path.replace(/^git@[^:]+:/, "");
    path = path.replace(/^https?:\/\/[^/]+\//, "");
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "unknown";
  } else {
    // npm 包名：先去除版本号后缀，再提取名称
    // @spaceflow/review@0.10.0 → @spaceflow/review → review
    const packageName = extractNpmPackageName(source);
    const parts = packageName.split("/");
    const lastPart = parts[parts.length - 1];
    // 移除 spaceflow-plugin- 或 plugin- 前缀
    return lastPart.replace(/^spaceflow-plugin-/, "").replace(/^plugin-/, "");
  }
}

/**
 * 构建 git 仓库的 package spec（用于 pnpm add）
 * git@xxx.git -> git+ssh://git@xxx.git
 * https://xxx.git -> git+https://xxx.git
 */
export function buildGitPackageSpec(source: string, ref?: string): string {
  let spec: string;
  if (source.startsWith("git@")) {
    // SSH 格式: git@host:org/repo.git -> git+ssh://git@host/org/repo.git
    const sshUrl = source.replace(":", "/").replace("git@", "git+ssh://git@");
    spec = sshUrl;
  } else if (source.startsWith("https://")) {
    spec = `git+${source}`;
  } else {
    spec = source;
  }

  // 添加 ref（分支/tag/commit）
  if (ref) {
    spec += `#${ref}`;
  }

  return spec;
}
