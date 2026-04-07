import micromatch from "micromatch";

/**
 * includes 模式中的变更类型前缀
 *
 * 语法：`<status>|<glob>`，例如：
 * - `added|*\/**\/*.ts`          → 仅匹配新增文件
 * - `modified|*\/**\/*.ts`       → 仅匹配修改文件
 * - `deleted|*\/**\/*.ts`        → 仅匹配删除文件
 * - `*\/**\/*.ts`               → 不限变更类型（原有行为）
 *
 * ## 全量 diff 语义说明
 *
 * 每次 review 是对当前分支与 base 分支（develop/master）的**全量 diff**，
 * 文件的 status 由平台 compare API 给出，表示该文件**相对 base 分支**的变更类型。
 *
 * 因此，若 `a.ts` 是在当前分支上首次引入的（相对 base 不存在），
 * 无论后续经过多少次 commit 修改，其 status **始终为 `added`**。
 * 这意味着 `added|*.ts` 在后续每次 review 中都会继续匹配该文件，
 * 这是符合预期的行为——只要文件相对 base 是"新建"的，`added|` 就应该始终生效。
 */
export type IncludeStatusPrefix = "added" | "modified" | "deleted";

/**
 * 代码结构类型，用于 filterCodeBlocks 配置
 */
export type CodeBlockType = "function" | "class" | "interface" | "type" | "method";

export const CODE_BLOCK_TYPES: CodeBlockType[] = [
  "function",
  "class",
  "interface",
  "type",
  "method",
];

/** status 值到前缀的映射（兼容 GitHub/GitLab/Gitea 各平台） */
const STATUS_ALIAS: Record<string, IncludeStatusPrefix> = {
  added: "added",
  created: "added",
  renamed: "modified",
  modified: "modified",
  changed: "modified",
  removed: "deleted",
  deleted: "deleted",
};

export interface ParsedIncludePattern {
  /** 变更类型前缀，undefined 表示不限类型 */
  status: IncludeStatusPrefix | undefined;
  /** 去掉前缀后的 glob 模式 */
  glob: string;
}

/**
 * 解析单条 include 模式，拆分 status 前缀和 glob。
 *
 * 只有当 `|` 前面的部分是已知 status 关键字时才视为前缀，否则当作普通 glob 处理（容错），
 * 这样可以避免误解析 extglob 语法中含 `|` 的模式（如 `+(*.ts|*.js)`）。
 * 排除模式（以 `!` 开头）始终作为普通 glob 处理。
 */
export function parseIncludePattern(pattern: string): ParsedIncludePattern {
  if (pattern.startsWith("!")) {
    return { status: undefined, glob: pattern };
  }
  const separatorIndex = pattern.indexOf("|");
  if (separatorIndex === -1) {
    return { status: undefined, glob: pattern };
  }
  const prefix = pattern.slice(0, separatorIndex).trim().toLowerCase();
  const glob = pattern.slice(separatorIndex + 1).trim();
  const status = STATUS_ALIAS[prefix] as IncludeStatusPrefix | undefined;
  if (!status) {
    // 前缀无法识别（如 extglob 中的 `|`），当作普通 glob 处理
    return { status: undefined, glob: pattern };
  }

  return { status, glob };
}

export interface FileWithStatus {
  filename?: string;
  status?: string;
}

/**
 * 根据 includes 模式列表过滤文件，支持 `status|glob` 前缀语法。
 *
 * 算法：
 * 1. 将 includes 拆分为：排除模式(`!`)、无前缀正向 glob、有 status 前缀 glob
 * 2. 每个文件先检查是否命中任意正向条件（无前缀 glob 或匹配 status 的前缀 glob）
 * 3. 最后用排除模式做全局过滤（排除模式始终优先）
 *
 * @param files     待过滤的文件列表
 * @param includes  include 模式列表，支持 `added|*.ts`、`modified|*.ts`、`deleted|*.ts` 前缀
 * @returns         匹配的文件列表
 */
export function filterFilesByIncludes<T extends FileWithStatus>(
  files: T[],
  includes: string[],
): T[] {
  if (!includes || includes.length === 0) return files;

  const parsed = includes.map(parseIncludePattern);

  // 排除模式（以 ! 开头），用于最终全局过滤
  const negativeGlobs = parsed
    .filter((p) => p.status === undefined && p.glob.startsWith("!"))
    .map((p) => p.glob.slice(1)); // 去掉 ! 前缀，用 micromatch.not 处理
  // 无前缀的正向 globs
  const plainGlobs = parsed
    .filter((p) => p.status === undefined && !p.glob.startsWith("!"))
    .map((p) => p.glob);
  // 有 status 前缀的 patterns
  const statusPatterns = parsed.filter((p) => p.status !== undefined);

  return files.filter((file) => {
    const filename = file.filename ?? "";
    if (!filename) return false;

    // 最终排除：命中排除模式的文件直接过滤掉
    if (
      negativeGlobs.length > 0 &&
      micromatch.isMatch(filename, negativeGlobs, { matchBase: true })
    ) {
      return false;
    }

    // 正向匹配：无前缀 glob
    if (plainGlobs.length > 0 && micromatch.isMatch(filename, plainGlobs, { matchBase: true })) {
      return true;
    }

    // 正向匹配：有 status 前缀的 glob，按文件实际 status 过滤
    // glob 可以带 ! 前缀表示在该 status 范围内排除，如 added|!**/*.spec.ts
    if (statusPatterns.length > 0) {
      const fileStatus = STATUS_ALIAS[file.status?.toLowerCase() ?? ""] ?? "modified";
      // 按 status 分组，每组内正向 glob + 排除 glob 合并后批量匹配
      const matchingStatusGlobs = statusPatterns
        .filter(({ status }) => status === fileStatus)
        .map(({ glob }) => glob);
      if (matchingStatusGlobs.length > 0) {
        // 有正向 glob 才有意义，纯排除 glob 组合 micromatch 会视为全匹配再排除
        const positiveGlobs = matchingStatusGlobs.filter((g) => !g.startsWith("!"));
        const negativeStatusGlobs = matchingStatusGlobs
          .filter((g) => g.startsWith("!"))
          .map((g) => g.slice(1));
        if (positiveGlobs.length > 0) {
          const matchesPositive = micromatch.isMatch(filename, positiveGlobs, { matchBase: true });
          const matchesNegative =
            negativeStatusGlobs.length > 0 &&
            micromatch.isMatch(filename, negativeStatusGlobs, { matchBase: true });
          if (matchesPositive && !matchesNegative) return true;
        }
      }
    }

    return false;
  });
}

/**
 * 从 includes 模式列表中提取纯 glob（用于 commit 过滤，commit 没有 status 概念）。
 * 带 status 前缀的模式会去掉前缀，仅保留 glob 部分。
 */
export function extractGlobsFromIncludes(includes: string[]): string[] {
  return includes.map((p) => parseIncludePattern(p).glob).filter((g) => g.length > 0);
}

/**
 * 从 filterCodeBlocks 配置中解析代码结构过滤类型。
 *
 * 支持两种格式：
 * - `"added|code-function"` — 仅对 added 文件过滤函数
 * - `"function"` — 不限 status，始终过滤函数
 *
 * 只返回匹配指定 status 的类型（默认 added）；无 status 前缀的条目始终包含。
 */
export function extractCodeBlockTypes(
  filterCodeBlocks: string[],
  status: IncludeStatusPrefix = "added",
): CodeBlockType[] {
  const types = new Set<CodeBlockType>();
  for (const entry of filterCodeBlocks) {
    const separatorIndex = entry.indexOf("|");
    if (separatorIndex === -1) {
      if ((CODE_BLOCK_TYPES as string[]).includes(entry)) {
        types.add(entry as CodeBlockType);
      }
    } else {
      const prefix = entry.slice(0, separatorIndex).trim().toLowerCase();
      const rest = entry.slice(separatorIndex + 1).trim();
      const entryStatus = STATUS_ALIAS[prefix] as IncludeStatusPrefix | undefined;
      if (entryStatus !== status) continue;
      const type = rest.startsWith("code-") ? rest.slice("code-".length) : rest;
      if ((CODE_BLOCK_TYPES as string[]).includes(type)) {
        types.add(type as CodeBlockType);
      }
    }
  }
  return [...types];
}
