import {
  GitProviderService,
  PullRequestCommit,
  type CiConfig,
  type LLMMode,
  type VerboseLevel,
  shouldLog,
  normalizeVerbose,
  GitSdkService,
} from "@spaceflow/core";
import type { IConfigReader, LocalReviewMode } from "@spaceflow/core";
import { type AnalyzeDeletionsMode, type ReviewConfig } from "./review.config";
import { ReviewOptions } from "./review.config";
import { parseTitleOptions } from "./parse-title-options";
import { type ReviewIssue, type UserInfo } from "./review-spec";
import { readFile } from "fs/promises";
import { globSync, statSync } from "fs";
import { join } from "path";
import { isAbsolute, normalize, relative } from "path";
import { homedir } from "os";
import type { ReportFormat } from "./review-report";

export interface ReviewContext extends ReviewOptions {
  owner: string;
  repo: string;
  prNumber?: number;
  baseRef?: string;
  headRef?: string;
  specSources: string[];
  verbose?: VerboseLevel;
  includes?: string[];
  whenModifiedCode?: string[];
  files?: string[];
  commits?: string[];
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  /** 仅执行删除代码分析，跳过常规代码审查 */
  deletionOnly?: boolean;
  /** 删除代码分析模式：openai 使用标准模式，open-code 使用 Agent 模式 */
  deletionAnalysisMode?: LLMMode;
  /** 输出格式：markdown, terminal, json。不指定则智能选择 */
  outputFormat?: ReportFormat;
  /** 是否使用 AI 生成 PR 功能描述 */
  generateDescription?: boolean;
  /** 显示所有问题，不过滤非变更行的问题 */
  showAll?: boolean;
  /** PR 事件类型（opened, synchronize, closed 等） */
  eventAction?: string;
  /**
   * 本地代码审查模式（已解析）
   * - 'uncommitted': 审查所有未提交的代码（暂存区 + 工作区）
   * - 'staged': 仅审查暂存区的代码
   * - false: 禁用本地模式
   */
  localMode?: LocalReviewMode;
}

export class ReviewContextBuilder {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
    protected readonly gitSdk: GitSdkService,
  ) {}

  async getContextFromEnv(options: ReviewOptions): Promise<ReviewContext> {
    const reviewConf = this.config.getPluginConfig<ReviewConfig>("review");
    if (shouldLog(options.verbose, 3)) {
      console.log(`[getContextFromEnv] reviewConf: ${JSON.stringify(reviewConf)}`);
    }
    const ciConf = this.config.get<CiConfig>("ci");
    const repository = ciConf?.repository;

    if (options.ci) {
      this.gitProvider.validateConfig();
    }

    let repoPath = repository;
    if (!repoPath) {
      // 非 CI 模式下，从 git remote 获取仓库信息
      const remoteUrl = this.gitSdk.getRemoteUrl();
      if (remoteUrl) {
        const parsed = this.gitSdk.parseRepositoryFromRemoteUrl(remoteUrl);
        if (parsed) {
          repoPath = `${parsed.owner}/${parsed.repo}`;
          if (shouldLog(options.verbose, 1)) {
            console.log(`📦 从 git remote 获取仓库: ${repoPath}`);
          }
        }
      }
    }

    if (!repoPath) {
      throw new Error("缺少配置 ci.repository");
    }

    const parts = repoPath.split("/");
    if (parts.length < 2) {
      throw new Error("ci.repository 格式不正确");
    }

    const owner = parts[0];
    const repo = parts[1];

    let prNumber = options.prNumber;

    if (!prNumber && options.ci) {
      prNumber = await this.getPrNumberFromEvent();
    }

    // 从 PR 标题解析命令参数（命令行参数优先，标题参数作为补充）
    let titleOptions: ReturnType<typeof parseTitleOptions> = {};
    if (prNumber && options.ci) {
      try {
        const pr = await this.gitProvider.getPullRequest(owner, repo, prNumber);
        if (pr?.title) {
          titleOptions = parseTitleOptions(pr.title);
          if (Object.keys(titleOptions).length > 0 && shouldLog(options.verbose, 1)) {
            console.log(`📋 从 PR 标题解析到参数:`, titleOptions);
          }
        }
      } catch (error) {
        if (shouldLog(options.verbose, 1)) {
          console.warn(`⚠️ 获取 PR 标题失败:`, error);
        }
      }
    }

    const specSources = [
      join(homedir(), ".spaceflow", "deps"),
      join(process.cwd(), ".spaceflow", "deps"),
    ];
    if (options.references?.length) {
      specSources.push(...options.references);
    }
    if (reviewConf.references?.length) {
      specSources.push(...reviewConf.references);
    }

    let normalizedFiles = this.normalizeFilePaths(options.files);

    // 当命令行传了 includes 且没有 PR/base/head 上下文时，展开 includes patterns 为文件列表
    // 使得 includes 在直接文件模式下可以指定文件夹和 glob，并对结果全量审查（不受 diff 限制）
    const isDirectIncludesMode =
      !!options.includes?.length && !prNumber && !options.base && !options.head && !options.ci;
    if (isDirectIncludesMode) {
      const cwd = process.cwd();
      const expandedFiles = options.includes!.flatMap((pattern) => {
        try {
          return Array.from(globSync(pattern, { cwd })).filter((f) => {
            try {
              return statSync(isAbsolute(f) ? f : join(cwd, f)).isFile();
            } catch {
              return false;
            }
          });
        } catch {
          return [pattern];
        }
      });
      const normalizedExpanded = this.normalizeFilePaths(expandedFiles) ?? [];
      normalizedFiles = [...(normalizedFiles ?? []), ...normalizedExpanded];
    }

    // 解析本地模式：非 CI、非 PR、无 base/head 时默认启用 uncommitted 模式
    // 当显式指定 files 时，强制走“按文件审查模式”，不进入本地未提交模式
    const localMode = this.resolveLocalMode(options, {
      ci: options.ci,
      hasPrNumber: !!prNumber,
      hasBaseHead: !!(options.base || options.head),
      hasFiles: !!normalizedFiles?.length,
    });

    // 当没有 PR 且没有指定 base/head 且不是本地模式时，自动获取默认值
    let baseRef = options.base;
    let headRef = options.head;
    if (!prNumber && !baseRef && !headRef && !localMode) {
      headRef = this.gitSdk.getCurrentBranch() ?? "HEAD";
      baseRef = this.gitSdk.getDefaultBranch();
      if (shouldLog(options.verbose, 1)) {
        console.log(`📌 自动检测分支: base=${baseRef}, head=${headRef}`);
      }
    }

    // 合并参数优先级：命令行 > PR 标题 > 配置文件 > 默认值
    const ctxIncludes = options.includes ?? titleOptions.includes ?? reviewConf.includes;
    if (shouldLog(options.verbose, 2)) {
      console.log(
        `[getContextFromEnv] includes: commandLine=${JSON.stringify(options.includes)}, title=${JSON.stringify(titleOptions.includes)}, config=${JSON.stringify(reviewConf.includes)}, final=${JSON.stringify(ctxIncludes)}`,
      );
    }
    return {
      owner,
      repo,
      prNumber,
      baseRef,
      headRef,
      specSources,
      dryRun: options.dryRun || titleOptions.dryRun || false,
      ci: options.ci ?? false,
      verbose: normalizeVerbose(options.verbose ?? titleOptions.verbose),
      includes: ctxIncludes,
      whenModifiedCode: options.whenModifiedCode ?? reviewConf.whenModifiedCode,
      llmMode: options.llmMode ?? titleOptions.llmMode ?? reviewConf.llmMode,
      llmModel: options.llmModel,
      files: normalizedFiles,
      commits: options.commits,
      verifyFixes:
        options.verifyFixes ?? titleOptions.verifyFixes ?? reviewConf.verifyFixes ?? true,
      verifyConcurrency: options.verifyConcurrency ?? reviewConf.verifyFixesConcurrency ?? 10,
      analyzeDeletions: this.resolveAnalyzeDeletions(
        options.analyzeDeletions ??
          options.deletionOnly ??
          titleOptions.analyzeDeletions ??
          titleOptions.deletionOnly ??
          reviewConf.analyzeDeletions ??
          false,
        { ci: options.ci, hasPrNumber: !!prNumber },
      ),
      deletionOnly: options.deletionOnly || titleOptions.deletionOnly || false,
      deletionAnalysisMode:
        options.deletionAnalysisMode ??
        titleOptions.deletionAnalysisMode ??
        reviewConf.deletionAnalysisMode ??
        "openai",
      concurrency: options.concurrency ?? reviewConf.concurrency ?? 5,
      timeout: options.timeout ?? reviewConf.timeout,
      retries: options.retries ?? reviewConf.retries ?? 0,
      retryDelay: options.retryDelay ?? reviewConf.retryDelay ?? 1000,
      generateDescription: options.generateDescription ?? reviewConf.generateDescription ?? false,
      showAll: options.showAll ?? false,
      flush: options.flush ?? false,
      eventAction: options.eventAction,
      localMode,
      duplicateWorkflowResolved:
        options.duplicateWorkflowResolved ?? reviewConf.duplicateWorkflowResolved ?? "delete",
      autoApprove: options.autoApprove ?? reviewConf.autoApprove ?? false,
      systemRules: options.systemRules ?? reviewConf.systemRules,
    };
  }

  /**
   * 解析本地代码审查模式
   * - 显式指定 --local [mode] 时使用指定值
   * - 显式指定 --no-local 时禁用
   * - 非 CI、非 PR、无 base/head 时默认启用 uncommitted 模式
   */
  resolveLocalMode(
    options: ReviewOptions,
    env: { ci: boolean; hasPrNumber: boolean; hasBaseHead: boolean; hasFiles: boolean },
  ): "uncommitted" | "staged" | false {
    // 显式指定了 files，优先进入按文件审查模式
    if (env.hasFiles) {
      return false;
    }
    // 显式指定了 --no-local
    if (options.local === false) {
      return false;
    }
    // 显式指定了 --local [mode]
    if (options.local === "staged" || options.local === "uncommitted") {
      return options.local;
    }
    // CI 或 PR 模式下不启用本地模式
    if (env.ci || env.hasPrNumber) {
      return false;
    }
    // 指定了 base/head 时不启用本地模式
    if (env.hasBaseHead) {
      return false;
    }
    // 默认启用 uncommitted 模式
    return "uncommitted";
  }

  /**
   * 将文件路径规范化为相对于仓库根目录的路径
   * 支持绝对路径和相对路径输入
   */
  normalizeFilePaths(files?: string[]): string[] | undefined {
    if (!files || files.length === 0) return files;

    const cwd = process.cwd();
    return files.map((file) => this.normalizeSingleFilePath(file, cwd));
  }

  /**
   * 规范化单个文件路径为仓库相对路径：
   * - 绝对路径转相对路径
   * - 统一分隔符为 /
   * - 移除前导 ./
   */
  private normalizeSingleFilePath(file: string, cwd: string): string {
    const normalizedInput = normalize(file);
    const relativePath = isAbsolute(normalizedInput)
      ? relative(cwd, normalizedInput)
      : normalizedInput;
    return relativePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
  }

  /**
   * 根据 AnalyzeDeletionsMode 和当前环境解析是否启用删除代码分析
   * @param mode 配置的模式值
   * @param env 当前环境信息
   * @returns 是否启用删除代码分析
   */
  resolveAnalyzeDeletions(
    mode: AnalyzeDeletionsMode,
    env: { ci: boolean; hasPrNumber: boolean },
  ): boolean {
    if (typeof mode === "boolean") {
      return mode;
    }
    switch (mode) {
      case "ci":
        return env.ci;
      case "pr":
        return env.hasPrNumber;
      case "terminal":
        return !env.ci;
      default:
        return false;
    }
  }

  /**
   * 从 CI 事件文件中解析 PR 编号
   * 在 CI 环境中，GitHub/Gitea Actions 会将事件信息写入 GITHUB_EVENT_PATH / GITEA_EVENT_PATH 指向的文件
   * @returns PR 编号，如果无法解析则返回 undefined
   */
  async getPrNumberFromEvent(): Promise<number | undefined> {
    const eventPath = process.env.GITHUB_EVENT_PATH || process.env.GITEA_EVENT_PATH;
    if (!eventPath) {
      return undefined;
    }

    try {
      const eventContent = await readFile(eventPath, "utf-8");
      const event = JSON.parse(eventContent);
      // 支持多种事件类型：
      // - pull_request 事件: event.pull_request.number 或 event.number
      // - issue_comment 事件: event.issue.number
      return event.pull_request?.number || event.issue?.number || event.number;
    } catch {
      return undefined;
    }
  }

  /**
   * 根据 commit 填充 issue 的 author 信息
   * 如果没有找到对应的 author，使用最后一次提交的人作为默认值
   */
  async fillIssueAuthors(
    issues: ReviewIssue[],
    commits: PullRequestCommit[],
    _owner: string,
    _repo: string,
    verbose?: VerboseLevel,
  ): Promise<ReviewIssue[]> {
    if (shouldLog(verbose, 2)) {
      console.log(`[fillIssueAuthors] issues=${issues.length}, commits=${commits.length}`);
    }

    // 收集需要查找的 Git 作者信息（email 或 name）
    const gitAuthorsToSearch = new Set<string>();
    for (const commit of commits) {
      const platformUser = commit.author || commit.committer;
      if (!platformUser?.login) {
        const gitAuthor = commit.commit?.author;
        if (gitAuthor?.email) gitAuthorsToSearch.add(gitAuthor.email);
        if (gitAuthor?.name) gitAuthorsToSearch.add(gitAuthor.name);
      }
    }

    // 通过 Git Provider API 查找用户，建立 email/name -> UserInfo 的映射
    const gitAuthorToUserMap = new Map<string, UserInfo>();
    for (const query of gitAuthorsToSearch) {
      try {
        const users = await this.gitProvider.searchUsers(query, 1);
        if (users.length > 0 && users[0].login) {
          const user: UserInfo = { id: String(users[0].id), login: users[0].login };
          gitAuthorToUserMap.set(query, user);
          if (shouldLog(verbose, 2)) {
            console.log(`[fillIssueAuthors] found user: ${query} -> ${user.login}`);
          }
        }
      } catch {
        // 忽略搜索失败
      }
    }

    // 构建 commit hash 到 author 的映射
    const commitAuthorMap = new Map<string, UserInfo>();
    for (const commit of commits) {
      const platformUser = commit.author || commit.committer;
      const gitAuthor = commit.commit?.author;
      if (shouldLog(verbose, 2)) {
        console.log(
          `[fillIssueAuthors] commit: sha=${commit.sha?.slice(0, 7)}, platformUser=${platformUser?.login}, gitAuthor=${gitAuthor?.name}`,
        );
      }
      if (commit.sha) {
        const shortHash = commit.sha.slice(0, 7);
        if (platformUser?.login) {
          commitAuthorMap.set(shortHash, {
            id: String(platformUser.id),
            login: platformUser.login,
          });
        } else if (gitAuthor) {
          const foundUser =
            (gitAuthor.email && gitAuthorToUserMap.get(gitAuthor.email)) ||
            (gitAuthor.name && gitAuthorToUserMap.get(gitAuthor.name));
          if (foundUser) {
            commitAuthorMap.set(shortHash, foundUser);
          } else if (gitAuthor.name) {
            commitAuthorMap.set(shortHash, { id: "0", login: gitAuthor.name });
          }
        }
      }
    }
    if (shouldLog(verbose, 2)) {
      console.log(`[fillIssueAuthors] commitAuthorMap size: ${commitAuthorMap.size}`);
    }

    // 获取最后一次提交的 author 作为默认值
    const lastCommit = commits[commits.length - 1];
    const lastPlatformUser = lastCommit?.author || lastCommit?.committer;
    const lastGitAuthor = lastCommit?.commit?.author;
    let defaultAuthor: UserInfo | undefined;
    if (lastPlatformUser?.login) {
      defaultAuthor = { id: String(lastPlatformUser.id), login: lastPlatformUser.login };
    } else if (lastGitAuthor) {
      const foundUser =
        (lastGitAuthor.email && gitAuthorToUserMap.get(lastGitAuthor.email)) ||
        (lastGitAuthor.name && gitAuthorToUserMap.get(lastGitAuthor.name));
      defaultAuthor =
        foundUser || (lastGitAuthor.name ? { id: "0", login: lastGitAuthor.name } : undefined);
    }
    if (shouldLog(verbose, 2)) {
      console.log(`[fillIssueAuthors] defaultAuthor: ${JSON.stringify(defaultAuthor)}`);
    }
    // 为每个 issue 填充 author
    return issues.map((issue) => {
      if (issue.author) {
        const shortHash = issue.commit?.slice(0, 7);
        if (shortHash?.includes("---")) {
          return { ...issue, commit: undefined, valid: "false" };
        }
        if (shouldLog(verbose, 2)) {
          console.log(`[fillIssueAuthors] issue already has author: ${issue.author.login}`);
        }
        return issue;
      }
      const shortHash = issue.commit?.slice(0, 7);
      const isValidHash = Boolean(shortHash && !shortHash.includes("---"));
      if (!isValidHash) {
        if (shouldLog(verbose, 2)) {
          console.log(
            `[fillIssueAuthors] issue: file=${issue.file}, commit=${issue.commit} is invalid hash, marking as invalid`,
          );
        }
        return { ...issue, commit: undefined, valid: "false" };
      }
      const author = commitAuthorMap.get(shortHash!);
      if (shouldLog(verbose, 2)) {
        console.log(
          `[fillIssueAuthors] issue: file=${issue.file}, commit=${issue.commit}, shortHash=${shortHash}, foundAuthor=${author?.login}, finalAuthor=${(author || defaultAuthor)?.login}`,
        );
      }
      return { ...issue, author: author || defaultAuthor };
    });
  }
}
