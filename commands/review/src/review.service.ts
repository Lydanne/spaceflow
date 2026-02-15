import {
  Injectable,
  ConfigService,
  ConfigReaderService,
  GitProviderService,
  PullRequest,
  PullRequestCommit,
  ChangedFile,
  CreatePullReviewComment,
  CiConfig,
  type LLMMode,
  LlmProxyService,
  logStreamEvent,
  createStreamLoggerState,
  type VerboseLevel,
  shouldLog,
  normalizeVerbose,
  type LlmJsonPutSchema,
  LlmJsonPut,
  parallel,
  GitSdkService,
  parseChangedLinesFromPatch,
  parseDiffText,
  parseHunksFromPatch,
  calculateNewLineNumber,
} from "@spaceflow/core";
import { type AnalyzeDeletionsMode, type ReviewConfig } from "./review.config";
import {
  ReviewSpecService,
  ReviewSpec,
  ReviewIssue,
  ReviewResult,
  ReviewStats,
  FileSummary,
  FileContentsMap,
  FileContentLine,
  type UserInfo,
} from "./review-spec";
import { MarkdownFormatter, ReviewReportService, type ReportFormat } from "./review-report";
import { execSync } from "child_process";
import { readFile, readdir } from "fs/promises";
import { join, dirname, extname, relative, isAbsolute } from "path";
import micromatch from "micromatch";
import { ReviewOptions } from "./review.command";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { parseTitleOptions } from "./parse-title-options";
import { homedir } from "os";

export interface ReviewContext extends ReviewOptions {
  owner: string;
  repo: string;
  prNumber?: number;
  baseRef?: string;
  headRef?: string;
  specSources: string[];
  verbose?: VerboseLevel;
  includes?: string[];
  files?: string[];
  commits?: string[];
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  /** 仅执行删除代码分析，跳过常规代码审查 */
  deletionOnly?: boolean;
  /** 删除代码分析模式：openai 使用标准模式，claude-agent 使用 Agent 模式 */
  deletionAnalysisMode?: LLMMode;
  /** 输出格式：markdown, terminal, json。不指定则智能选择 */
  outputFormat?: ReportFormat;
  /** 是否使用 AI 生成 PR 功能描述 */
  generateDescription?: boolean;
  /** 显示所有问题，不过滤非变更行的问题 */
  showAll?: boolean;
  /** PR 事件类型（opened, synchronize, closed 等） */
  eventAction?: string;
}

export interface FileReviewPrompt {
  filename: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface ReviewPrompt {
  filePrompts: FileReviewPrompt[];
}

export interface LLMReviewOptions {
  verbose?: VerboseLevel;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

const REVIEW_COMMENT_MARKER = "<!-- spaceflow-review -->";

const REVIEW_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string", description: "发生问题的文件路径" },
          line: {
            type: "string",
            description:
              "问题所在的行号，只支持单行或多行 (如 123 或 123-125)，不允许使用 `,` 分隔多个行号",
          },
          ruleId: { type: "string", description: "违反的规则 ID（如 JsTs.FileName.UpperCamel）" },
          specFile: {
            type: "string",
            description: "规则来源的规范文件名（如 js&ts.file-name.md）",
          },
          reason: { type: "string", description: "问题的简要概括" },
          suggestion: {
            type: "string",
            description:
              "修改后的完整代码片段。要求以代码为主体，并在代码中使用详细的中文注释解释逻辑改进点。不要包含 Markdown 反引号。",
          },
          commit: { type: "string", description: "相关的 7 位 commit SHA" },
          severity: {
            type: "string",
            description: "问题严重程度，根据规则文档中的 severity 标记确定",
            enum: ["error", "warn"],
          },
        },
        required: ["file", "line", "ruleId", "specFile", "reason"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "本次代码审查的整体总结" },
  },
  required: ["issues", "summary"],
  additionalProperties: false,
};

@Injectable()
export class ReviewService {
  protected readonly llmJsonPut: LlmJsonPut<ReviewResult>;

  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly configService: ConfigService,
    protected readonly configReader: ConfigReaderService,
    protected readonly reviewSpecService: ReviewSpecService,
    protected readonly llmProxyService: LlmProxyService,
    protected readonly reviewReportService: ReviewReportService,
    protected readonly issueVerifyService: IssueVerifyService,
    protected readonly deletionImpactService: DeletionImpactService,
    protected readonly gitSdk: GitSdkService,
  ) {
    this.llmJsonPut = new LlmJsonPut(REVIEW_SCHEMA, {
      llmRequest: async (prompt) => {
        const response = await this.llmProxyService.chat(
          [
            { role: "system", content: prompt.systemPrompt },
            { role: "user", content: prompt.userPrompt },
          ],
          { adapter: "openai" },
        );
        if (!response.content) {
          throw new Error("LLM 返回了空内容");
        }
        return response.content;
      },
    });
  }

  async getContextFromEnv(options: ReviewOptions): Promise<ReviewContext> {
    const reviewConf = this.configReader.getPluginConfig<ReviewConfig>("review");
    const ciConf = this.configService.get<CiConfig>("ci");
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

    // 当没有 PR 且没有指定 base/head 时，自动获取默认值
    let baseRef = options.base;
    let headRef = options.head;
    if (!prNumber && !baseRef && !headRef) {
      headRef = this.gitSdk.getCurrentBranch() ?? "HEAD";
      baseRef = this.gitSdk.getDefaultBranch();
      if (shouldLog(options.verbose, 1)) {
        console.log(`📌 自动检测分支: base=${baseRef}, head=${headRef}`);
      }
    }

    // 合并参数优先级：命令行 > PR 标题 > 配置文件 > 默认值
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
      includes: options.includes ?? titleOptions.includes ?? reviewConf.includes,
      llmMode: options.llmMode ?? titleOptions.llmMode ?? reviewConf.llmMode,
      files: this.normalizeFilePaths(options.files),
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
      eventAction: options.eventAction,
    };
  }

  /**
   * 将文件路径规范化为相对于仓库根目录的路径
   * 支持绝对路径和相对路径输入
   */
  protected normalizeFilePaths(files?: string[]): string[] | undefined {
    if (!files || files.length === 0) return files;

    const cwd = process.cwd();
    return files.map((file) => {
      if (isAbsolute(file)) {
        // 绝对路径转换为相对路径
        return relative(cwd, file);
      }
      return file;
    });
  }

  /**
   * 根据 AnalyzeDeletionsMode 和当前环境解析是否启用删除代码分析
   * @param mode 配置的模式值
   * @param env 当前环境信息
   * @returns 是否启用删除代码分析
   */
  protected resolveAnalyzeDeletions(
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
   * 从 GitHub Actions 事件文件中解析 PR 编号
   * 在 CI 环境中，GitHub Actions 会将事件信息写入 GITHUB_EVENT_PATH 指向的文件
   * @returns PR 编号，如果无法解析则返回 undefined
   */
  protected async getPrNumberFromEvent(): Promise<number | undefined> {
    const eventPath = process.env.GITHUB_EVENT_PATH;
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
   * 执行代码审查的主方法
   * 该方法负责协调整个审查流程，包括：
   * 1. 加载审查规范（specs）
   * 2. 获取 PR/分支的变更文件和提交记录
   * 3. 调用 LLM 进行代码审查
   * 4. 处理历史 issue（更新行号、验证修复状态）
   * 5. 生成并发布审查报告
   *
   * @param context 审查上下文，包含 owner、repo、prNumber 等信息
   * @returns 审查结果，包含发现的问题列表和统计信息
   */
  async execute(context: ReviewContext): Promise<ReviewResult> {
    const {
      owner,
      repo,
      prNumber,
      baseRef,
      headRef,
      specSources,
      dryRun,
      ci,
      verbose,
      includes,
      llmMode,
      files,
      commits: filterCommits,
      deletionOnly,
    } = context;

    // 直接审查文件模式：指定了 -f 文件且 base=head
    const isDirectFileMode = files && files.length > 0 && baseRef === headRef;

    if (shouldLog(verbose, 1)) {
      console.log(`🔍 Review 启动`);
      console.log(`   DRY-RUN mode: ${dryRun ? "enabled" : "disabled"}`);
      console.log(`   CI mode: ${ci ? "enabled" : "disabled"}`);
      console.log(`   Verbose: ${verbose}`);
    }

    // 如果是 deletionOnly 模式，直接执行删除代码分析
    if (deletionOnly) {
      return this.executeDeletionOnly(context);
    }

    // 如果是 closed 事件，仅收集 review 状态
    if (context.eventAction === "closed") {
      return this.executeCollectOnly(context);
    }

    if (shouldLog(verbose, 1)) {
      console.log(`📂 解析规则来源: ${specSources.length} 个`);
    }
    const specDirs = await this.reviewSpecService.resolveSpecSources(specSources);
    if (shouldLog(verbose, 2)) {
      console.log(`   解析到 ${specDirs.length} 个规则目录`, specDirs);
    }

    let specs: ReviewSpec[] = [];
    for (const specDir of specDirs) {
      const dirSpecs = await this.reviewSpecService.loadReviewSpecs(specDir);
      specs.push(...dirSpecs);
    }
    if (shouldLog(verbose, 1)) {
      console.log(`   找到 ${specs.length} 个规则文件`);
    }

    // 去重规则：后加载的覆盖先加载的
    const beforeDedup = specs.reduce((sum, s) => sum + s.rules.length, 0);
    specs = this.reviewSpecService.deduplicateSpecs(specs);
    const afterDedup = specs.reduce((sum, s) => sum + s.rules.length, 0);
    if (beforeDedup !== afterDedup && shouldLog(verbose, 1)) {
      console.log(`   去重规则: ${beforeDedup} -> ${afterDedup} 条`);
    }

    let pr: PullRequest | undefined;
    let commits: PullRequestCommit[] = [];
    let changedFiles: ChangedFile[] = [];

    if (prNumber) {
      if (shouldLog(verbose, 1)) {
        console.log(`📥 获取 PR #${prNumber} 信息 (owner: ${owner}, repo: ${repo})`);
      }
      pr = await this.gitProvider.getPullRequest(owner, repo, prNumber);
      commits = await this.gitProvider.getPullRequestCommits(owner, repo, prNumber);
      changedFiles = await this.gitProvider.getPullRequestFiles(owner, repo, prNumber);
      if (shouldLog(verbose, 1)) {
        console.log(`   PR: ${pr?.title}`);
        console.log(`   Commits: ${commits.length}`);
        console.log(`   Changed files: ${changedFiles.length}`);
      }
    } else if (baseRef && headRef) {
      // 如果指定了 -f 文件且 base=head（无差异模式），直接审查指定文件
      if (files && files.length > 0 && baseRef === headRef) {
        if (shouldLog(verbose, 1)) {
          console.log(`📥 直接审查指定文件模式 (${files.length} 个文件)`);
        }
        changedFiles = files.map((f) => ({ filename: f, status: "modified" as const }));
      } else {
        if (shouldLog(verbose, 1)) {
          console.log(`📥 获取 ${baseRef}...${headRef} 的差异 (owner: ${owner}, repo: ${repo})`);
        }
        changedFiles = await this.getChangedFilesBetweenRefs(owner, repo, baseRef, headRef);
        commits = await this.getCommitsBetweenRefs(baseRef, headRef);
        if (shouldLog(verbose, 1)) {
          console.log(`   Changed files: ${changedFiles.length}`);
          console.log(`   Commits: ${commits.length}`);
        }
      }
    } else {
      if (shouldLog(verbose, 1)) {
        console.log(`❌ 错误: 缺少 prNumber 或 baseRef/headRef`, { prNumber, baseRef, headRef });
      }
      throw new Error("必须指定 PR 编号或者 base/head 分支");
    }

    // 0. 过滤掉 merge commit（消息以 "Merge branch" 开头的 commit）
    const beforeMergeFilterCount = commits.length;
    commits = commits.filter((c) => {
      const message = c.commit?.message || "";
      return !message.startsWith("Merge branch ");
    });
    if (beforeMergeFilterCount !== commits.length && shouldLog(verbose, 1)) {
      console.log(`   跳过 Merge Commits: ${beforeMergeFilterCount} -> ${commits.length} 个`);
    }

    // 1. 按指定的 files 过滤
    if (files && files.length > 0) {
      const beforeFilesCount = changedFiles.length;
      changedFiles = changedFiles.filter((f) => files.includes(f.filename || ""));
      if (shouldLog(verbose, 1)) {
        console.log(`   Files 过滤文件: ${beforeFilesCount} -> ${changedFiles.length} 个文件`);
      }
    }

    // 2. 按指定的 commits 过滤
    if (filterCommits && filterCommits.length > 0) {
      const beforeCommitsCount = commits.length;
      commits = commits.filter((c) => filterCommits.some((fc) => fc && c.sha?.startsWith(fc)));
      if (shouldLog(verbose, 1)) {
        console.log(`   Commits 过滤: ${beforeCommitsCount} -> ${commits.length} 个`);
      }

      // 同时也过滤变更文件，仅保留属于这些 commit 的文件
      const beforeFilesCount = changedFiles.length;
      const commitFilenames = new Set<string>();
      for (const commit of commits) {
        if (!commit.sha) continue;
        const commitFiles = await this.getFilesForCommit(owner, repo, commit.sha, prNumber);
        commitFiles.forEach((f) => commitFilenames.add(f));
      }
      changedFiles = changedFiles.filter((f) => commitFilenames.has(f.filename || ""));
      if (shouldLog(verbose, 1)) {
        console.log(`   按 Commits 过滤文件: ${beforeFilesCount} -> ${changedFiles.length} 个文件`);
      }
    }

    // 3. 使用 includes 过滤文件和 commits
    if (includes && includes.length > 0) {
      const beforeFilesCount = changedFiles.length;
      const filenames = changedFiles.map((file) => file.filename || "");
      const matchedFilenames = micromatch(filenames, includes);
      changedFiles = changedFiles.filter((file) => matchedFilenames.includes(file.filename || ""));
      if (shouldLog(verbose, 1)) {
        console.log(`   Includes 过滤文件: ${beforeFilesCount} -> ${changedFiles.length} 个文件`);
      }

      const beforeCommitsCount = commits.length;
      const filteredCommits: PullRequestCommit[] = [];
      for (const commit of commits) {
        if (!commit.sha) continue;
        const commitFiles = await this.getFilesForCommit(owner, repo, commit.sha, prNumber);
        if (micromatch.some(commitFiles, includes)) {
          filteredCommits.push(commit);
        }
      }
      commits = filteredCommits;
      if (shouldLog(verbose, 1)) {
        console.log(`   Includes 过滤 Commits: ${beforeCommitsCount} -> ${commits.length} 个`);
      }
    }

    // 只按扩展名过滤规则，includes 和 override 在 LLM 审查后处理
    const applicableSpecs = this.reviewSpecService.filterApplicableSpecs(specs, changedFiles);
    if (shouldLog(verbose, 1)) {
      console.log(`   适用的规则文件: ${applicableSpecs.length}`);
    }

    if (applicableSpecs.length === 0 || changedFiles.length === 0) {
      if (shouldLog(verbose, 1)) {
        console.log("✅ 没有需要审查的文件或规则");
      }
      // 即使没有适用的规则，也为每个变更文件生成摘要
      const summary: FileSummary[] = changedFiles
        .filter((f) => f.filename && f.status !== "deleted")
        .map((f) => ({
          file: f.filename!,
          resolved: 0,
          unresolved: 0,
          summary: applicableSpecs.length === 0 ? "无适用的审查规则" : "已跳过",
        }));
      const prInfo =
        context.generateDescription && llmMode
          ? await this.generatePrDescription(commits, changedFiles, llmMode, undefined, verbose)
          : await this.buildFallbackDescription(commits, changedFiles);
      return {
        success: true,
        title: prInfo.title,
        description: prInfo.description,
        issues: [],
        summary,
        round: 1,
      };
    }

    const headSha = pr?.head?.sha || headRef || "HEAD";
    const fileContents = await this.getFileContents(
      owner,
      repo,
      changedFiles,
      commits,
      headSha,
      prNumber,
      verbose,
    );
    if (!llmMode) {
      throw new Error("必须指定 LLM 类型");
    }

    // 获取上一次的审查结果（用于提示词优化）
    let existingResult: ReviewResult | null = null;
    if (ci && prNumber) {
      existingResult = await this.getExistingReviewResult(owner, repo, prNumber);
      if (existingResult && shouldLog(verbose, 1)) {
        console.log(`📋 获取到上一次审查结果，包含 ${existingResult.issues.length} 个问题`);
      }
    }
    // 计算当前轮次：基于已有结果的轮次 + 1
    const currentRound = (existingResult?.round ?? 0) + 1;
    if (shouldLog(verbose, 1)) {
      console.log(`🔄 当前审查轮次: ${currentRound}`);
    }

    const reviewPrompt = await this.buildReviewPrompt(
      specs,
      changedFiles,
      fileContents,
      commits,
      existingResult,
    );
    const result = await this.runLLMReview(llmMode, reviewPrompt, {
      verbose,
      concurrency: context.concurrency,
      timeout: context.timeout,
      retries: context.retries,
      retryDelay: context.retryDelay,
    });
    // 填充 PR 功能描述和标题
    const prInfo = context.generateDescription
      ? await this.generatePrDescription(commits, changedFiles, llmMode, fileContents, verbose)
      : await this.buildFallbackDescription(commits, changedFiles);
    result.title = prInfo.title;
    result.description = prInfo.description;
    // 更新 round 并为新 issues 赋值 round
    result.round = currentRound;
    result.issues = result.issues.map((issue) => ({ ...issue, round: currentRound }));

    if (shouldLog(verbose, 1)) {
      console.log(`📝 LLM 审查完成，发现 ${result.issues.length} 个问题`);
    }

    result.issues = await this.fillIssueCode(result.issues, fileContents);

    // 在 LLM 审查后应用 includes 和 override 过滤
    let filteredIssues = this.reviewSpecService.filterIssuesByIncludes(
      result.issues,
      applicableSpecs,
    );
    if (shouldLog(verbose, 1)) {
      console.log(`   应用 includes 过滤后: ${filteredIssues.length} 个问题`);
    }

    filteredIssues = this.reviewSpecService.filterIssuesByRuleExistence(filteredIssues, specs);
    if (shouldLog(verbose, 1)) {
      console.log(`   应用规则存在性过滤后: ${filteredIssues.length} 个问题`);
    }

    filteredIssues = this.reviewSpecService.filterIssuesByOverrides(
      filteredIssues,
      applicableSpecs,
      verbose,
    );

    // 过滤掉不属于本次 PR commits 的问题（排除 merge commit 引入的代码）
    if (shouldLog(verbose, 3)) {
      console.log(`   🔍 变更行过滤条件检查:`);
      console.log(
        `      showAll=${context.showAll}, isDirectFileMode=${isDirectFileMode}, commits.length=${commits.length}`,
      );
    }
    if (!context.showAll && !isDirectFileMode && commits.length > 0) {
      if (shouldLog(verbose, 2)) {
        console.log(`   🔍 开始变更行过滤，当前 ${filteredIssues.length} 个问题`);
      }
      filteredIssues = this.filterIssuesByValidCommits(
        filteredIssues,
        commits,
        fileContents,
        verbose,
      );
      if (shouldLog(verbose, 2)) {
        console.log(`   🔍 变更行过滤完成，剩余 ${filteredIssues.length} 个问题`);
      }
    } else if (shouldLog(verbose, 1)) {
      console.log(
        `   跳过变更行过滤 (${context.showAll ? "showAll=true" : isDirectFileMode ? "直接审查文件模式" : "commits.length=0"})`,
      );
    }

    filteredIssues = this.reviewSpecService.formatIssues(filteredIssues, {
      specs,
      changedFiles,
    });
    if (shouldLog(verbose, 1)) {
      console.log(`   应用格式化后: ${filteredIssues.length} 个问题`);
    }

    result.issues = filteredIssues;
    if (shouldLog(verbose, 1)) {
      console.log(`📝 最终发现 ${result.issues.length} 个问题`);
    }

    let existingIssues: ReviewIssue[] = [];
    let allIssues = result.issues;

    if (ci && prNumber && existingResult) {
      existingIssues = existingResult.issues ?? [];
      if (existingIssues.length > 0) {
        if (shouldLog(verbose, 1)) {
          console.log(`📋 已有评论中存在 ${existingIssues.length} 个问题`);
        }

        // 如果文件有变更，将该文件的历史问题标记为无效
        // 简化策略：避免复杂的行号更新逻辑
        const reviewConf = this.configReader.getPluginConfig<ReviewConfig>("review");
        if (
          reviewConf.invalidateChangedFiles !== "off" &&
          reviewConf.invalidateChangedFiles !== "keep"
        ) {
          existingIssues = await this.invalidateIssuesForChangedFiles(
            existingIssues,
            pr?.head?.sha,
            owner,
            repo,
            verbose,
          );
        }

        // 验证历史问题是否已修复
        if (context.verifyFixes) {
          const unfixedExistingIssues = existingIssues.filter(
            (i) => i.valid !== "false" && !i.fixed,
          );
          if (unfixedExistingIssues.length > 0 && llmMode) {
            existingIssues = await this.issueVerifyService.verifyIssueFixes(
              existingIssues,
              fileContents,
              specs,
              llmMode,
              verbose,
              context.verifyConcurrency,
            );
          }
        } else {
          if (shouldLog(verbose, 1)) {
            console.log(`   ⏭️  跳过历史问题验证 (verifyFixes=false)`);
          }
        }

        const { filteredIssues: newIssues, skippedCount } = this.filterDuplicateIssues(
          result.issues,
          existingIssues,
        );
        if (skippedCount > 0 && shouldLog(verbose, 1)) {
          console.log(`   跳过 ${skippedCount} 个重复问题，新增 ${newIssues.length} 个问题`);
        }
        result.issues = newIssues;
        allIssues = [...existingIssues, ...newIssues];
      }
    }

    // 统一填充所有问题的 author 信息（仅在有 commits 时）
    if (commits.length > 0) {
      allIssues = await this.fillIssueAuthors(allIssues, commits, owner, repo, verbose);
    }

    // 第一次提交报告：审查问题完成
    if (prNumber && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 提交 PR 评论 (代码审查完成)...`);
      }

      await this.postOrUpdateReviewComment(
        owner,
        repo,
        prNumber,
        {
          ...result,
          issues: allIssues,
        },
        verbose,
      );
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已提交`);
      }
    }

    // 如果启用了删除代码影响分析
    if (context.analyzeDeletions && llmMode) {
      const deletionImpact = await this.deletionImpactService.analyzeDeletionImpact(
        {
          owner,
          repo,
          prNumber,
          baseRef,
          headRef,
          analysisMode: context.deletionAnalysisMode,
          includes,
        },
        llmMode,
        verbose,
      );
      result.deletionImpact = deletionImpact;

      // 第二次更新报告：删除代码分析完成
      if (prNumber && !dryRun) {
        if (shouldLog(verbose, 1)) {
          console.log(`💬 更新 PR 评论 (删除代码分析完成)...`);
        }
        await this.postOrUpdateReviewComment(
          owner,
          repo,
          prNumber,
          {
            ...result,
            issues: allIssues,
          },
          verbose,
        );
        if (shouldLog(verbose, 1)) {
          console.log(`✅ 评论已更新`);
        }
      }
    }

    const reviewComment = this.formatReviewComment(
      { ...result, issues: allIssues },
      { prNumber, outputFormat: context.outputFormat, ci },
    );

    // 终端输出（根据 outputFormat 或智能选择）
    console.log(MarkdownFormatter.clearReviewData(reviewComment, "<hidden>"));

    return result;
  }

  /**
   * 仅收集 review 状态模式（用于 PR 关闭时）
   * 从现有的 AI review 评论中读取问题状态，同步已解决/无效状态，输出统计信息
   */
  protected async executeCollectOnly(context: ReviewContext): Promise<ReviewResult> {
    const { owner, repo, prNumber, verbose, ci, dryRun } = context;

    if (shouldLog(verbose, 1)) {
      console.log(`📊 仅收集 review 状态模式`);
    }

    if (!prNumber) {
      throw new Error("collectOnly 模式必须指定 PR 编号");
    }

    // 1. 从现有的 AI review 评论中读取问题
    const existingResult = await this.getExistingReviewResult(owner, repo, prNumber);
    if (!existingResult) {
      console.log(`ℹ️  PR #${prNumber} 没有找到 AI review 评论`);
      return {
        success: true,
        description: "",
        issues: [],
        summary: [],
        round: 0,
      };
    }

    if (shouldLog(verbose, 1)) {
      console.log(`📋 找到 ${existingResult.issues.length} 个历史问题`);
    }

    // 2. 获取 commits 并填充 author 信息
    const commits = await this.gitProvider.getPullRequestCommits(owner, repo, prNumber);
    existingResult.issues = await this.fillIssueAuthors(
      existingResult.issues,
      commits,
      owner,
      repo,
      verbose,
    );

    // 3. 同步已解决的评论状态
    await this.syncResolvedComments(owner, repo, prNumber, existingResult);

    // 4. 同步评论 reactions（👍/👎）
    await this.syncReactionsToIssues(owner, repo, prNumber, existingResult, verbose);

    // 5. 统计问题状态并设置到 result
    const stats = this.calculateIssueStats(existingResult.issues);
    existingResult.stats = stats;

    // 6. 输出统计信息
    console.log(this.reviewReportService.formatStatsTerminal(stats, prNumber));

    // 7. 更新 PR 评论（如果不是 dry-run）
    if (ci && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 更新 PR 评论...`);
      }
      await this.postOrUpdateReviewComment(owner, repo, prNumber, existingResult, verbose);
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已更新`);
      }
    }

    return existingResult;
  }

  /**
   * 计算问题状态统计
   */
  protected calculateIssueStats(issues: ReviewIssue[]): ReviewStats {
    const total = issues.length;
    const fixed = issues.filter((i) => i.fixed).length;
    const invalid = issues.filter((i) => i.valid === "false").length;
    const pending = total - fixed - invalid;
    const fixRate = total > 0 ? Math.round((fixed / total) * 100 * 10) / 10 : 0;
    return { total, fixed, invalid, pending, fixRate };
  }

  /**
   * 仅执行删除代码分析模式
   */
  protected async executeDeletionOnly(context: ReviewContext): Promise<ReviewResult> {
    const { owner, repo, prNumber, baseRef, headRef, dryRun, ci, verbose, llmMode } = context;

    if (shouldLog(verbose, 1)) {
      console.log(`🗑️  仅执行删除代码分析模式`);
    }

    if (!llmMode) {
      throw new Error("必须指定 LLM 类型");
    }

    const deletionImpact = await this.deletionImpactService.analyzeDeletionImpact(
      {
        owner,
        repo,
        prNumber,
        baseRef,
        headRef,
        analysisMode: context.deletionAnalysisMode,
        includes: context.includes,
      },
      llmMode,
      verbose,
    );

    // 获取 commits 和 changedFiles 用于生成描述
    let commits: PullRequestCommit[] = [];
    let changedFiles: ChangedFile[] = [];
    if (prNumber) {
      commits = await this.gitProvider.getPullRequestCommits(owner, repo, prNumber);
      changedFiles = await this.gitProvider.getPullRequestFiles(owner, repo, prNumber);
    } else if (baseRef && headRef) {
      changedFiles = await this.getChangedFilesBetweenRefs(owner, repo, baseRef, headRef);
      commits = await this.getCommitsBetweenRefs(baseRef, headRef);
    }

    // 使用 includes 过滤文件
    if (context.includes && context.includes.length > 0) {
      const filenames = changedFiles.map((file) => file.filename || "");
      const matchedFilenames = micromatch(filenames, context.includes);
      changedFiles = changedFiles.filter((file) => matchedFilenames.includes(file.filename || ""));
    }

    const prInfo = context.generateDescription
      ? await this.generatePrDescription(commits, changedFiles, llmMode, undefined, verbose)
      : await this.buildFallbackDescription(commits, changedFiles);
    const result: ReviewResult = {
      success: true,
      title: prInfo.title,
      description: prInfo.description,
      issues: [],
      summary: [],
      deletionImpact,
      round: 1,
    };

    const reviewComment = this.formatReviewComment(result, {
      prNumber,
      outputFormat: context.outputFormat,
      ci,
    });

    if (ci && prNumber && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 提交 PR 评论...`);
      }
      await this.postOrUpdateReviewComment(owner, repo, prNumber, result, verbose);
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已提交`);
      }
    }

    // 终端输出（根据 outputFormat 或智能选择）

    console.log(MarkdownFormatter.clearReviewData(reviewComment, "<hidden>"));

    return result;
  }

  protected async getChangedFilesBetweenRefs(
    _owner: string,
    _repo: string,
    baseRef: string,
    headRef: string,
  ): Promise<ChangedFile[]> {
    // 使用 getDiffBetweenRefs 获取包含 patch 的文件列表
    // 这样可以正确解析变更行号，用于过滤非变更行的问题
    const diffFiles = await this.gitSdk.getDiffBetweenRefs(baseRef, headRef);
    const statusFiles = await this.gitSdk.getChangedFilesBetweenRefs(baseRef, headRef);

    // 合并 status 和 patch 信息
    const statusMap = new Map(statusFiles.map((f) => [f.filename, f.status]));
    return diffFiles.map((f) => ({
      filename: f.filename,
      status: statusMap.get(f.filename) || "modified",
      patch: f.patch,
    }));
  }

  protected async getCommitsBetweenRefs(
    baseRef: string,
    headRef: string,
  ): Promise<PullRequestCommit[]> {
    const gitCommits = await this.gitSdk.getCommitsBetweenRefs(baseRef, headRef);
    return gitCommits.map((c) => ({
      sha: c.sha,
      commit: {
        message: c.message,
        author: c.author,
      },
    }));
  }

  protected async getFilesForCommit(
    owner: string,
    repo: string,
    sha: string,
    prNumber?: number,
  ): Promise<string[]> {
    if (prNumber) {
      const commit = await this.gitProvider.getCommit(owner, repo, sha);
      return commit.files?.map((f) => f.filename || "").filter(Boolean) || [];
    } else {
      return this.gitSdk.getFilesForCommit(sha);
    }
  }

  /**
   * 获取文件内容并构建行号到 commit hash 的映射
   * 返回 Map<filename, Array<[commitHash, lineCode]>>
   */
  protected async getFileContents(
    owner: string,
    repo: string,
    changedFiles: ChangedFile[],
    commits: PullRequestCommit[],
    ref: string,
    prNumber?: number,
    verbose?: VerboseLevel,
  ): Promise<FileContentsMap> {
    const contents: FileContentsMap = new Map();
    const latestCommitHash = commits[commits.length - 1]?.sha?.slice(0, 7) || "-------";

    // 优先使用 changedFiles 中的 patch 字段（来自 PR 的整体 diff base...head）
    // 这样行号是相对于最终文件的，而不是每个 commit 的父 commit
    // buildLineCommitMap 遍历每个 commit 的 diff，行号可能与最终文件不一致
    if (shouldLog(verbose, 1)) {
      console.log(`📊 正在构建行号到变更的映射...`);
    }

    for (const file of changedFiles) {
      if (file.filename && file.status !== "deleted") {
        try {
          let rawContent: string;
          if (prNumber) {
            rawContent = await this.gitProvider.getFileContent(owner, repo, file.filename, ref);
          } else {
            rawContent = await this.gitSdk.getFileContent(ref, file.filename);
          }
          const lines = rawContent.split("\n");

          // 优先使用 file.patch（PR 整体 diff），这是相对于最终文件的行号
          let changedLines = parseChangedLinesFromPatch(file.patch);

          // 如果 changedLines 为空，需要判断是否应该将所有行标记为变更
          // 情况1: 文件是新增的（status 为 added/A）
          // 情况2: patch 为空但文件有 additions（部分 Git Provider API 可能不返回完整 patch）
          const isNewFile =
            file.status === "added" ||
            file.status === "A" ||
            (file.additions && file.additions > 0 && file.deletions === 0 && !file.patch);
          if (changedLines.size === 0 && isNewFile) {
            changedLines = new Set(lines.map((_, i) => i + 1));
            if (shouldLog(verbose, 2)) {
              console.log(
                `   ℹ️ ${file.filename}: 新增文件无 patch，将所有 ${lines.length} 行标记为变更`,
              );
            }
          }

          if (shouldLog(verbose, 3)) {
            console.log(`   📄 ${file.filename}: ${lines.length} 行, ${changedLines.size} 行变更`);
            console.log(`      latestCommitHash: ${latestCommitHash}`);
            if (changedLines.size > 0 && changedLines.size <= 20) {
              console.log(
                `      变更行号: ${Array.from(changedLines)
                  .sort((a, b) => a - b)
                  .join(", ")}`,
              );
            } else if (changedLines.size > 20) {
              console.log(`      变更行号: (共 ${changedLines.size} 行，省略详情)`);
            }
            if (!file.patch) {
              console.log(
                `      ⚠️ 该文件没有 patch 信息 (status=${file.status}, additions=${file.additions}, deletions=${file.deletions})`,
              );
            } else {
              console.log(
                `      patch 前 200 字符: ${file.patch.slice(0, 200).replace(/\n/g, "\\n")}`,
              );
            }
          }

          const contentLines: FileContentLine[] = lines.map((line, index) => {
            const lineNum = index + 1;
            // 如果该行在 PR 的整体 diff 中被标记为变更，则使用最新 commit hash
            const hash = changedLines.has(lineNum) ? latestCommitHash : "-------";
            return [hash, line];
          });
          contents.set(file.filename, contentLines);
        } catch {
          console.warn(`警告: 无法获取文件内容: ${file.filename}`);
        }
      }
    }

    if (shouldLog(verbose, 1)) {
      console.log(`📊 映射构建完成，共 ${contents.size} 个文件`);
    }
    return contents;
  }

  protected async runLLMReview(
    llmMode: LLMMode,
    reviewPrompt: ReviewPrompt,
    options: LLMReviewOptions = {},
  ): Promise<ReviewResult> {
    console.log(`🤖 调用 ${llmMode} 进行代码审查...`);

    try {
      const result = await this.callLLM(llmMode, reviewPrompt, options);
      if (!result) {
        throw new Error("AI 未返回有效结果");
      }
      return {
        success: true,
        description: "", // 由 execute 方法填充
        issues: result.issues || [],
        summary: result.summary || [],
        round: 1, // 由 execute 方法根据 existingResult 更新
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error("LLM 调用失败:", error.message);
        if (error.stack) {
          console.error("堆栈信息:\n" + error.stack);
        }
      } else {
        console.error("LLM 调用失败:", error);
      }
      return {
        success: false,
        description: "",
        issues: [],
        summary: [],
        round: 1,
      };
    }
  }

  /**
   * 根据文件过滤 specs，只返回与该文件匹配的规则
   * - 如果 spec 有 includes 配置，只有当文件名匹配 includes 模式时才包含该 spec
   * - 如果 spec 没有 includes 配置，则按扩展名匹配
   */
  protected filterSpecsForFile(specs: ReviewSpec[], filename: string): ReviewSpec[] {
    const ext = extname(filename).slice(1).toLowerCase();
    if (!ext) return [];

    return specs.filter((spec) => {
      // 先检查扩展名是否匹配
      if (!spec.extensions.includes(ext)) {
        return false;
      }

      // 如果有 includes 配置，检查文件名是否匹配 includes 模式
      if (spec.includes.length > 0) {
        return micromatch.isMatch(filename, spec.includes, { matchBase: true });
      }

      // 没有 includes 配置，扩展名匹配即可
      return true;
    });
  }

  /**
   * 构建 systemPrompt
   */
  protected buildSystemPrompt(specsSection: string): string {
    return `你是一个专业的代码审查专家，负责根据团队的编码规范对代码进行严格审查。

## 审查规范

${specsSection}

## 审查要求

1. **严格遵循规范**：只按照上述审查规范进行审查，不要添加规范之外的要求
2. **精准定位问题**：每个问题必须指明具体的行号，行号从文件内容中的 "行号|" 格式获取
3. **避免重复报告**：如果提示词中包含"上一次审查结果"，请不要重复报告已存在的问题
4. **提供可行建议**：对于每个问题，提供具体的修改建议代码

## 注意事项

- 变更文件内容已在上下文中提供，无需调用读取工具
- 你可以读取项目中的其他文件以了解上下文
- 不要调用编辑工具修改文件，你的职责是审查而非修改
- 文件内容格式为 "CommitHash 行号| 代码"，输出的 line 字段应对应原始行号

## 输出要求

- 发现问题时：在 issues 数组中列出所有问题，每个问题包含 file、line、ruleId、specFile、reason、suggestion、severity
- 无论是否发现问题：都必须在 summary 中提供该文件的审查总结，简要说明审查结果`;
  }

  protected async buildReviewPrompt(
    specs: ReviewSpec[],
    changedFiles: ChangedFile[],
    fileContents: FileContentsMap,
    commits: PullRequestCommit[],
    existingResult?: ReviewResult | null,
  ): Promise<ReviewPrompt> {
    const fileDataList = changedFiles
      .filter((f) => f.status !== "deleted" && f.filename)
      .map((file) => {
        const filename = file.filename!;
        const contentLines = fileContents.get(filename);
        if (!contentLines) {
          return {
            filename,
            file,
            linesWithNumbers: "(无法获取内容)",
            commitsSection: "- 无相关 commits",
          };
        }
        const padWidth = String(contentLines.length).length;
        const linesWithNumbers = contentLines
          .map(([hash, line], index) => {
            const lineNum = index + 1;
            return `${hash} ${String(lineNum).padStart(padWidth)}| ${line}`;
          })
          .join("\n");
        // 从 contentLines 中收集该文件相关的 commit hashes
        const fileCommitHashes = new Set<string>();
        for (const [hash] of contentLines) {
          if (hash !== "-------") {
            fileCommitHashes.add(hash);
          }
        }
        const relatedCommits = commits.filter((c) => {
          const shortHash = c.sha?.slice(0, 7) || "";
          return fileCommitHashes.has(shortHash);
        });
        const commitsSection =
          relatedCommits.length > 0
            ? relatedCommits
                .map((c) => `- \`${c.sha?.slice(0, 7)}\` ${c.commit?.message?.split("\n")[0]}`)
                .join("\n")
            : "- 无相关 commits";
        return { filename, file, linesWithNumbers, commitsSection };
      });

    const filePrompts: FileReviewPrompt[] = await Promise.all(
      fileDataList.map(async ({ filename, file, linesWithNumbers, commitsSection }) => {
        const fileDirectoryInfo = await this.getFileDirectoryInfo(filename);

        // 获取该文件上一次的审查结果
        const existingFileSummary = existingResult?.summary?.find((s) => s.file === filename);
        const existingFileIssues = existingResult?.issues?.filter((i) => i.file === filename) ?? [];

        let previousReviewSection = "";
        if (existingFileSummary || existingFileIssues.length > 0) {
          const parts: string[] = [];
          if (existingFileSummary?.summary) {
            parts.push(`**总结**:\n`);
            parts.push(`${existingFileSummary.summary}\n`);
          }
          if (existingFileIssues.length > 0) {
            parts.push(`**已发现的问题** (${existingFileIssues.length} 个):\n`);
            for (const issue of existingFileIssues) {
              const status = issue.fixed
                ? "✅ 已修复"
                : issue.valid === "false"
                  ? "❌ 无效"
                  : "⚠️ 待处理";
              parts.push(`- [${status}] 行 ${issue.line}: ${issue.reason} (规则: ${issue.ruleId})`);
            }
            parts.push("");
            // parts.push("请注意：不要重复报告上述已发现的问题，除非代码有新的变更导致问题复现。\n");
          }
          previousReviewSection = parts.join("\n");
        }

        const userPrompt = `## ${filename} (${file.status})

### 文件内容

\`\`\`
${linesWithNumbers}
\`\`\`

### 该文件的相关 Commits

${commitsSection}

### 该文件所在的目录树

${fileDirectoryInfo}

### 上一次审查结果

${previousReviewSection}`;

        // 根据文件过滤 specs，只注入与当前文件匹配的规则
        const fileSpecs = this.filterSpecsForFile(specs, filename);
        const specsSection = this.reviewSpecService.buildSpecsSection(fileSpecs);
        const systemPrompt = this.buildSystemPrompt(specsSection);

        return { filename, systemPrompt, userPrompt };
      }),
    );

    return { filePrompts };
  }

  protected async fillIssueCode(
    issues: ReviewIssue[],
    fileContents: FileContentsMap,
  ): Promise<ReviewIssue[]> {
    return issues.map((issue) => {
      const contentLines = fileContents.get(issue.file);
      if (!contentLines) {
        return issue;
      }
      const lineRange = issue.line.split("-").map((n) => parseInt(n, 10));
      const startLine = lineRange[0];
      const endLine = lineRange.length > 1 ? lineRange[1] : startLine;
      if (isNaN(startLine) || startLine < 1 || startLine > contentLines.length) {
        return issue;
      }
      const codeLines = contentLines
        .slice(startLine - 1, Math.min(endLine, contentLines.length))
        .map(([, line]) => line);
      const code = codeLines.join("\n").trim();
      return { ...issue, code };
    });
  }

  /**
   * 根据 commit 填充 issue 的 author 信息
   * 如果没有找到对应的 author，使用最后一次提交的人作为默认值
   */
  protected async fillIssueAuthors(
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
      // API 返回的 author/committer 可能为 null（未关联平台用户）
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
          // 尝试从平台用户映射中查找
          const foundUser =
            (gitAuthor.email && gitAuthorToUserMap.get(gitAuthor.email)) ||
            (gitAuthor.name && gitAuthorToUserMap.get(gitAuthor.name));
          if (foundUser) {
            commitAuthorMap.set(shortHash, foundUser);
          } else if (gitAuthor.name) {
            // 使用 Git 原始作者信息（name 作为 login）
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
      // 尝试从平台用户映射中查找
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
      // 如果 issue 已有 author，保留原值
      if (issue.author) {
        if (shouldLog(verbose, 2)) {
          console.log(`[fillIssueAuthors] issue already has author: ${issue.author.login}`);
        }
        return issue;
      }
      // issue.commit 可能是 7 位短 hash
      const shortHash = issue.commit?.slice(0, 7);
      const author =
        shortHash && !shortHash.includes("---") ? commitAuthorMap.get(shortHash) : undefined;
      if (shouldLog(verbose, 2)) {
        console.log(
          `[fillIssueAuthors] issue: file=${issue.file}, commit=${issue.commit}, shortHash=${shortHash}, foundAuthor=${author?.login}, finalAuthor=${(author || defaultAuthor)?.login}`,
        );
      }
      // 优先使用 commit 对应的 author，否则使用默认 author
      return { ...issue, author: author || defaultAuthor };
    });
  }

  protected async getFileDirectoryInfo(filename: string): Promise<string> {
    const dir = dirname(filename);
    const currentFileName = filename.split("/").pop();

    if (dir === "." || dir === "") {
      return "（根目录）";
    }

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      const sortedEntries = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const lines: string[] = [`📁 ${dir}/`];

      for (let i = 0; i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const isCurrent = entry.name === currentFileName;
        const branch = isLast ? "└── " : "├── ";
        const icon = entry.isDirectory() ? "📂" : "📄";
        const marker = isCurrent ? " ← 当前文件" : "";

        lines.push(`${branch}${icon} ${entry.name}${marker}`);
      }

      return lines.join("\n");
    } catch {
      return `📁 ${dir}/`;
    }
  }

  protected async callLLM(
    llmMode: LLMMode,
    reviewPrompt: ReviewPrompt,
    options: LLMReviewOptions = {},
  ): Promise<{ issues: ReviewIssue[]; summary: FileSummary[] } | null> {
    const { verbose, concurrency = 5, timeout, retries = 0, retryDelay = 1000 } = options;
    const fileCount = reviewPrompt.filePrompts.length;
    console.log(
      `📂 开始并行审查 ${fileCount} 个文件 (并发: ${concurrency}, 重试: ${retries}, 超时: ${timeout ?? "无"}ms)`,
    );

    const executor = parallel({
      concurrency,
      timeout,
      retries,
      retryDelay,
      onTaskStart: (taskId) => {
        console.log(`🚀 开始审查: ${taskId}`);
      },
      onTaskComplete: (taskId, success) => {
        console.log(`${success ? "✅" : "❌"} 完成审查: ${taskId}`);
      },
      onRetry: (taskId, attempt, error) => {
        console.log(`🔄 重试 ${taskId} (第 ${attempt} 次): ${error.message}`);
      },
    });

    const results = await executor.map(
      reviewPrompt.filePrompts,
      (filePrompt) => this.reviewSingleFile(llmMode, filePrompt, verbose),
      (filePrompt) => filePrompt.filename,
    );

    const allIssues: ReviewIssue[] = [];
    const fileSummaries: FileSummary[] = [];

    for (const result of results) {
      if (result.success && result.result) {
        allIssues.push(...result.result.issues);
        fileSummaries.push(result.result.summary);
      } else {
        fileSummaries.push({
          file: result.id,
          resolved: 0,
          unresolved: 0,
          summary: `❌ 审查失败: ${result.error?.message ?? "未知错误"}`,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`🔍 审查完成: ${successCount}/${fileCount} 个文件成功`);

    return {
      issues: this.normalizeIssues(allIssues),
      summary: fileSummaries,
    };
  }

  protected async reviewSingleFile(
    llmMode: LLMMode,
    filePrompt: FileReviewPrompt,
    verbose?: VerboseLevel,
  ): Promise<{ issues: ReviewIssue[]; summary: FileSummary }> {
    if (shouldLog(verbose, 3)) {
      console.log(
        `\nsystemPrompt:\n----------------\n${filePrompt.systemPrompt}\n----------------`,
      );
      console.log(`\nuserPrompt:\n----------------\n${filePrompt.userPrompt}\n----------------`);
    }

    const stream = this.llmProxyService.chatStream(
      [
        { role: "system", content: filePrompt.systemPrompt },
        { role: "user", content: filePrompt.userPrompt },
      ],
      {
        adapter: llmMode,
        jsonSchema: this.llmJsonPut,
        verbose,
        allowedTools: [
          "Read",
          "Glob",
          "Grep",
          "WebSearch",
          "TodoWrite",
          "TodoRead",
          "Task",
          "Skill",
        ],
      },
    );

    const streamLoggerState = createStreamLoggerState();
    let fileResult: { issues?: ReviewIssue[]; summary?: string } | undefined;

    for await (const event of stream) {
      if (shouldLog(verbose, 2)) {
        logStreamEvent(event, streamLoggerState);
      }

      if (event.type === "result") {
        fileResult = event.response.structuredOutput as
          | { issues?: ReviewIssue[]; summary?: string }
          | undefined;
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    // 在获取到问题时立即记录发现时间
    const now = new Date().toISOString();
    const issues = (fileResult?.issues ?? []).map((issue) => ({
      ...issue,
      date: issue.date ?? now,
    }));

    return {
      issues,
      summary: {
        file: filePrompt.filename,
        resolved: 0,
        unresolved: 0,
        summary: fileResult?.summary ?? "",
      },
    };
  }

  /**
   * 规范化 issues，拆分包含逗号的行号为多个独立 issue，并添加发现时间
   * 例如 "114, 122" 会被拆分成两个 issue，分别是 "114" 和 "122"
   */
  protected normalizeIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const now = new Date().toISOString();
    return issues.flatMap((issue) => {
      // 确保 line 是字符串（LLM 可能返回数字）
      const lineStr = String(issue.line ?? "");
      const baseIssue = { ...issue, line: lineStr, date: issue.date ?? now };

      if (!lineStr.includes(",")) {
        return baseIssue;
      }

      const lines = lineStr.split(",");

      return lines.map((linePart, index) => ({
        ...baseIssue,
        line: linePart.trim(),
        suggestion: index === 0 ? issue.suggestion : `参考 ${issue.file}:${lines[0]}`,
      }));
    });
  }

  /**
   * 使用 AI 根据 commits、变更文件和代码内容总结 PR 实现的功能
   * @returns 包含 title 和 description 的对象
   */
  protected async generatePrDescription(
    commits: PullRequestCommit[],
    changedFiles: ChangedFile[],
    llmMode: LLMMode,
    fileContents?: FileContentsMap,
    verbose?: VerboseLevel,
  ): Promise<{ title: string; description: string }> {
    const commitMessages = commits
      .map((c) => `- ${c.sha?.slice(0, 7)}: ${c.commit?.message?.split("\n")[0]}`)
      .join("\n");
    const fileChanges = changedFiles
      .slice(0, 30)
      .map((f) => `- ${f.filename} (${f.status})`)
      .join("\n");
    // 构建代码变更内容（只包含变更行，限制总长度）
    let codeChangesSection = "";
    if (fileContents && fileContents.size > 0) {
      const codeSnippets: string[] = [];
      let totalLength = 0;
      const maxTotalLength = 8000; // 限制代码总长度
      for (const [filename, lines] of fileContents) {
        if (totalLength >= maxTotalLength) break;
        // 只提取有变更的行（commitHash 不是 "-------"）
        const changedLines = lines
          .map(([hash, code], idx) => (hash !== "-------" ? `${idx + 1}: ${code}` : null))
          .filter(Boolean);
        if (changedLines.length > 0) {
          const snippet = `### ${filename}\n\`\`\`\n${changedLines.slice(0, 50).join("\n")}\n\`\`\``;
          if (totalLength + snippet.length <= maxTotalLength) {
            codeSnippets.push(snippet);
            totalLength += snippet.length;
          }
        }
      }
      if (codeSnippets.length > 0) {
        codeChangesSection = `\n\n## 代码变更内容\n${codeSnippets.join("\n\n")}`;
      }
    }
    const prompt = `请根据以下 PR 的 commit 记录、文件变更和代码内容，用简洁的中文总结这个 PR 实现了什么功能。
要求：
1. 第一行输出 PR 标题，格式必须是: Feat xxx 或 Fix xxx 或 Refactor xxx（根据变更类型选择，整体不超过 50 个字符）
2. 空一行后输出详细描述
3. 描述应该简明扼要，突出核心功能点
4. 使用 Markdown 格式
5. 不要逐条列出 commit，而是归纳总结
6. 重点分析代码变更的实际功能

## Commit 记录 (${commits.length} 个)
${commitMessages || "无"}

## 文件变更 (${changedFiles.length} 个文件)
${fileChanges || "无"}
${changedFiles.length > 30 ? `\n... 等 ${changedFiles.length - 30} 个文件` : ""}${codeChangesSection}`;
    try {
      const stream = this.llmProxyService.chatStream([{ role: "user", content: prompt }], {
        adapter: llmMode,
      });
      let content = "";
      for await (const event of stream) {
        if (event.type === "text") {
          content += event.content;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      // 解析标题和描述：第一行是标题，其余是描述
      const lines = content.trim().split("\n");
      const title = lines[0]?.replace(/^#+\s*/, "").trim() || "PR 更新";
      const description = lines.slice(1).join("\n").trim();
      return { title, description };
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn("⚠️ AI 总结 PR 功能失败，使用默认描述:", error);
      }
      return this.buildFallbackDescription(commits, changedFiles);
    }
  }

  /**
   * 使用 LLM 生成 PR 标题
   */
  protected async generatePrTitle(
    commits: PullRequestCommit[],
    changedFiles: ChangedFile[],
  ): Promise<string> {
    const commitMessages = commits
      .slice(0, 10)
      .map((c) => c.commit?.message?.split("\n")[0])
      .filter(Boolean)
      .join("\n");
    const fileChanges = changedFiles
      .slice(0, 20)
      .map((f) => `${f.filename} (${f.status})`)
      .join("\n");
    const prompt = `请根据以下 commit 记录和文件变更，生成一个简短的 PR 标题。
要求：
1. 格式必须是: Feat: xxx 或 Fix: xxx 或 Refactor: xxx
2. 根据变更内容选择合适的前缀（新功能用 Feat，修复用 Fix，重构用 Refactor）
3. xxx 部分用简短的中文描述（整体不超过 50 个字符）
4. 只输出标题，不要加任何解释

Commit 记录:
${commitMessages || "无"}

文件变更:
${fileChanges || "无"}`;
    try {
      const stream = this.llmProxyService.chatStream([{ role: "user", content: prompt }], {
        adapter: "openai",
      });
      let title = "";
      for await (const event of stream) {
        if (event.type === "text") {
          title += event.content;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      return title.trim().slice(0, 50) || this.getFallbackTitle(commits);
    } catch {
      return this.getFallbackTitle(commits);
    }
  }

  /**
   * 获取降级标题（从第一个 commit 消息）
   */
  protected getFallbackTitle(commits: PullRequestCommit[]): string {
    const firstCommitMsg = commits[0]?.commit?.message?.split("\n")[0] || "PR 更新";
    return firstCommitMsg.slice(0, 50);
  }

  /**
   * 构建降级描述（当 AI 总结失败时使用）
   */
  protected async buildFallbackDescription(
    commits: PullRequestCommit[],
    changedFiles: ChangedFile[],
  ): Promise<{ title: string; description: string }> {
    const parts: string[] = [];
    // 使用 LLM 生成标题
    const title = await this.generatePrTitle(commits, changedFiles);
    if (commits.length > 0) {
      const messages = commits
        .slice(0, 5)
        .map((c) => `- ${c.commit?.message?.split("\n")[0]}`)
        .filter(Boolean);
      if (messages.length > 0) {
        parts.push(`**提交记录**: ${messages.join("; ")}`);
      }
    }
    if (changedFiles.length > 0) {
      const added = changedFiles.filter((f) => f.status === "added").length;
      const modified = changedFiles.filter((f) => f.status === "modified").length;
      const deleted = changedFiles.filter((f) => f.status === "deleted").length;
      const stats: string[] = [];
      if (added > 0) stats.push(`新增 ${added}`);
      if (modified > 0) stats.push(`修改 ${modified}`);
      if (deleted > 0) stats.push(`删除 ${deleted}`);
      parts.push(`**文件变更**: ${changedFiles.length} 个文件 (${stats.join(", ")})`);
    }
    return { title, description: parts.join("\n") };
  }

  protected formatReviewComment(
    result: ReviewResult,
    options: { prNumber?: number; outputFormat?: ReportFormat; ci?: boolean } = {},
  ): string {
    const { prNumber, outputFormat, ci } = options;
    // 智能选择格式：如果未指定，PR 模式用 markdown，终端用 terminal
    const format: ReportFormat = outputFormat || (ci && prNumber ? "markdown" : "terminal");

    if (format === "markdown") {
      return this.reviewReportService.formatMarkdown(result, {
        prNumber,
        includeReanalysisCheckbox: true,
        includeJsonData: true,
        reviewCommentMarker: REVIEW_COMMENT_MARKER,
      });
    }

    return this.reviewReportService.format(result, format);
  }

  protected async postOrUpdateReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    result: ReviewResult,
    verbose?: VerboseLevel,
  ): Promise<void> {
    // 获取配置
    const reviewConf = this.configReader.getPluginConfig<ReviewConfig>("review");

    // 如果配置启用且有 AI 生成的标题，只在第一轮审查时更新 PR 标题
    if (reviewConf.autoUpdatePrTitle && result.title && result.round === 1) {
      try {
        await this.gitProvider.editPullRequest(owner, repo, prNumber, { title: result.title });
        console.log(`📝 已更新 PR 标题: ${result.title}`);
      } catch (error) {
        console.warn("⚠️ 更新 PR 标题失败:", error);
      }
    }

    // 获取已解决的评论，同步 fixed 状态（在删除旧 review 之前）
    await this.syncResolvedComments(owner, repo, prNumber, result);

    // 获取评论的 reactions，同步 valid 状态（👎 标记为无效）
    await this.syncReactionsToIssues(owner, repo, prNumber, result, verbose);

    // 删除已有的 AI review（避免重复评论）
    await this.deleteExistingAiReviews(owner, repo, prNumber);

    // 调试：检查 issues 是否有 author
    if (shouldLog(verbose, 3)) {
      for (const issue of result.issues.slice(0, 3)) {
        console.log(
          `[postOrUpdateReviewComment] issue: file=${issue.file}, commit=${issue.commit}, author=${issue.author?.login}`,
        );
      }
    }

    const reviewBody = this.formatReviewComment(result, {
      prNumber,
      outputFormat: "markdown",
      ci: true,
    });

    // 获取 PR 信息以获取 head commit SHA
    const pr = await this.gitProvider.getPullRequest(owner, repo, prNumber);
    const commitId = pr.head?.sha;

    // 构建行级评论（根据配置决定是否启用）
    let comments: CreatePullReviewComment[] = [];
    if (reviewConf.lineComments) {
      comments = result.issues
        .filter((issue) => !issue.fixed && issue.valid !== "false")
        .map((issue) => this.issueToReviewComment(issue))
        .filter((comment): comment is CreatePullReviewComment => comment !== null);
    }

    try {
      // 使用 PR Review 发布主评论 + 行级评论（合并为一个消息块）
      await this.gitProvider.createPullReview(owner, repo, prNumber, {
        event: "COMMENT",
        body: reviewBody,
        comments,
        commit_id: commitId,
      });
      const lineMsg = comments.length > 0 ? `，包含 ${comments.length} 条行级评论` : "";
      console.log(`✅ 已发布 AI Review${lineMsg}`);
    } catch (error) {
      console.warn("⚠️ 发布 AI Review 失败:", error);
    }
  }

  /**
   * 从旧的 AI review 中获取已解决的评论，同步 fixed 状态到 result.issues
   */
  protected async syncResolvedComments(
    owner: string,
    repo: string,
    prNumber: number,
    result: ReviewResult,
  ): Promise<void> {
    try {
      const reviews = await this.gitProvider.listPullReviews(owner, repo, prNumber);
      const aiReview = reviews.find((r) => r.body?.includes(REVIEW_COMMENT_MARKER));
      if (!aiReview?.id) {
        return;
      }
      // 获取该 review 的所有行级评论
      const reviewComments = await this.gitProvider.listPullReviewComments(
        owner,
        repo,
        prNumber,
        aiReview.id,
      );
      // 找出已解决的评论（resolver 不为 null）
      const resolvedComments = reviewComments.filter(
        (c) => c.resolver !== null && c.resolver !== undefined,
      );
      if (resolvedComments.length === 0) {
        return;
      }
      // 根据文件路径和行号匹配 issues，标记为已解决
      const now = new Date().toISOString();
      for (const comment of resolvedComments) {
        const matchedIssue = result.issues.find(
          (issue) =>
            issue.file === comment.path && this.lineMatchesPosition(issue.line, comment.position),
        );
        if (matchedIssue && !matchedIssue.fixed) {
          matchedIssue.fixed = now;
          console.log(`🟢 问题已标记为已解决: ${matchedIssue.file}:${matchedIssue.line}`);
        }
      }
    } catch (error) {
      console.warn("⚠️ 同步已解决评论失败:", error);
    }
  }

  /**
   * 检查 issue 的行号是否匹配评论的 position
   */
  protected lineMatchesPosition(issueLine: string, position?: number): boolean {
    if (!position) return false;
    const lines = this.reviewSpecService.parseLineRange(issueLine);
    if (lines.length === 0) return false;
    const startLine = lines[0];
    const endLine = lines[lines.length - 1];
    return position >= startLine && position <= endLine;
  }

  /**
   * 从旧的 AI review 评论中获取 reactions 和回复，同步到 result.issues
   * - 存储所有 reactions 到 issue.reactions 字段
   * - 存储评论回复到 issue.replies 字段
   * - 如果评论有 👎 (-1) reaction，将对应的问题标记为无效
   */
  protected async syncReactionsToIssues(
    owner: string,
    repo: string,
    prNumber: number,
    result: ReviewResult,
    verbose?: VerboseLevel,
  ): Promise<void> {
    try {
      const reviews = await this.gitProvider.listPullReviews(owner, repo, prNumber);
      const aiReview = reviews.find((r) => r.body?.includes(REVIEW_COMMENT_MARKER));
      if (!aiReview?.id) {
        if (shouldLog(verbose, 2)) {
          console.log(`[syncReactionsToIssues] No AI review found`);
        }
        return;
      }

      // 收集所有评审人
      const reviewers = new Set<string>();

      // 1. 从已提交的 review 中获取评审人（排除 AI bot）
      for (const review of reviews) {
        if (review.user?.login && !review.body?.includes(REVIEW_COMMENT_MARKER)) {
          reviewers.add(review.user.login);
        }
      }
      if (shouldLog(verbose, 2)) {
        console.log(
          `[syncReactionsToIssues] reviewers from reviews: ${Array.from(reviewers).join(", ")}`,
        );
      }

      // 2. 从 PR 指定的评审人中获取（包括团队成员）
      try {
        const pr = await this.gitProvider.getPullRequest(owner, repo, prNumber);
        // 添加指定的个人评审人
        for (const reviewer of pr.requested_reviewers || []) {
          if (reviewer.login) {
            reviewers.add(reviewer.login);
          }
        }
        if (shouldLog(verbose, 2)) {
          console.log(
            `[syncReactionsToIssues] requested_reviewers: ${(pr.requested_reviewers || []).map((r) => r.login).join(", ")}`,
          );
          console.log(
            `[syncReactionsToIssues] requested_reviewers_teams: ${JSON.stringify(pr.requested_reviewers_teams || [])}`,
          );
        }
        // 添加指定的团队成员（需要通过 API 获取团队成员列表）
        for (const team of pr.requested_reviewers_teams || []) {
          if (team.id) {
            try {
              const members = await this.gitProvider.getTeamMembers(team.id);
              if (shouldLog(verbose, 2)) {
                console.log(
                  `[syncReactionsToIssues] team ${team.name}(${team.id}) members: ${members.map((m) => m.login).join(", ")}`,
                );
              }
              for (const member of members) {
                if (member.login) {
                  reviewers.add(member.login);
                }
              }
            } catch (e) {
              if (shouldLog(verbose, 2)) {
                console.log(`[syncReactionsToIssues] failed to get team ${team.id} members: ${e}`);
              }
            }
          }
        }
      } catch {
        // 获取 PR 信息失败，继续使用已有的评审人列表
      }
      if (shouldLog(verbose, 2)) {
        console.log(`[syncReactionsToIssues] final reviewers: ${Array.from(reviewers).join(", ")}`);
      }

      // 获取该 review 的所有行级评论
      const reviewComments = await this.gitProvider.listPullReviewComments(
        owner,
        repo,
        prNumber,
        aiReview.id,
      );
      // 构建评论 ID 到 issue 的映射，用于后续匹配回复
      const commentIdToIssue = new Map<number, (typeof result.issues)[0]>();
      // 遍历每个评论，获取其 reactions
      for (const comment of reviewComments) {
        if (!comment.id) continue;
        // 找到对应的 issue
        const matchedIssue = result.issues.find(
          (issue) =>
            issue.file === comment.path && this.lineMatchesPosition(issue.line, comment.position),
        );
        if (matchedIssue) {
          commentIdToIssue.set(comment.id, matchedIssue);
        }
        try {
          const reactions = await this.gitProvider.getIssueCommentReactions(
            owner,
            repo,
            comment.id,
          );
          if (reactions.length === 0 || !matchedIssue) continue;
          // 按 content 分组，收集每种 reaction 的用户列表
          const reactionMap = new Map<string, string[]>();
          for (const r of reactions) {
            if (!r.content) continue;
            const users = reactionMap.get(r.content) || [];
            if (r.user?.login) {
              users.push(r.user.login);
            }
            reactionMap.set(r.content, users);
          }
          // 存储到 issue.reactions
          matchedIssue.reactions = Array.from(reactionMap.entries()).map(([content, users]) => ({
            content,
            users,
          }));
          // 检查是否有评审人的 👎 (-1) reaction，标记为无效
          const thumbsDownUsers = reactionMap.get("-1") || [];
          const reviewerThumbsDown = thumbsDownUsers.filter((u) => reviewers.has(u));
          if (reviewerThumbsDown.length > 0 && matchedIssue.valid !== "false") {
            matchedIssue.valid = "false";
            console.log(
              `👎 问题已标记为无效: ${matchedIssue.file}:${matchedIssue.line} (by 评审人: ${reviewerThumbsDown.join(", ")})`,
            );
          }
        } catch {
          // 单个评论获取 reactions 失败，继续处理其他评论
        }
      }
      // 获取 PR 上的所有 Issue Comments（包含对 review 评论的回复）
      await this.syncRepliesToIssues(owner, repo, prNumber, reviewComments, result);
    } catch (error) {
      console.warn("⚠️ 同步评论 reactions 失败:", error);
    }
  }

  /**
   * 同步评论回复到对应的 issues
   * review 评论回复是通过同一个 review 下的后续评论实现的
   */
  protected async syncRepliesToIssues(
    _owner: string,
    _repo: string,
    _prNumber: number,
    reviewComments: {
      id?: number;
      path?: string;
      position?: number;
      body?: string;
      user?: { id?: number; login?: string };
      created_at?: string;
    }[],
    result: ReviewResult,
  ): Promise<void> {
    try {
      // 按文件路径和行号分组评论，第一条是原始评论，后续是回复
      const commentsByLocation = new Map<string, typeof reviewComments>();
      for (const comment of reviewComments) {
        if (!comment.path || !comment.position) continue;
        const key = `${comment.path}:${comment.position}`;
        const comments = commentsByLocation.get(key) || [];
        comments.push(comment);
        commentsByLocation.set(key, comments);
      }
      // 遍历每个位置的评论，将非第一条评论作为回复
      for (const [, comments] of commentsByLocation) {
        if (comments.length <= 1) continue;
        // 按创建时间排序
        comments.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeA - timeB;
        });
        const firstComment = comments[0];
        // 找到对应的 issue
        const matchedIssue = result.issues.find(
          (issue) =>
            issue.file === firstComment.path &&
            this.lineMatchesPosition(issue.line, firstComment.position),
        );
        if (!matchedIssue) continue;
        // 后续评论作为回复
        const replies = comments.slice(1).map((c) => ({
          user: {
            id: c.user?.id?.toString(),
            login: c.user?.login || "unknown",
          },
          body: c.body || "",
          createdAt: c.created_at || "",
        }));
        matchedIssue.replies = replies;
      }
    } catch (error) {
      console.warn("⚠️ 同步评论回复失败:", error);
    }
  }

  /**
   * 删除已有的 AI review（通过 marker 识别）
   */
  protected async deleteExistingAiReviews(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<void> {
    try {
      const reviews = await this.gitProvider.listPullReviews(owner, repo, prNumber);
      const aiReviews = reviews.filter((r) => r.body?.includes(REVIEW_COMMENT_MARKER));
      for (const review of aiReviews) {
        if (review.id) {
          await this.gitProvider.deletePullReview(owner, repo, prNumber, review.id);
        }
      }
      if (aiReviews.length > 0) {
        console.log(`🗑️ 已删除 ${aiReviews.length} 个旧的 AI review`);
      }
    } catch (error) {
      console.warn("⚠️ 删除旧 AI review 失败:", error);
    }
  }

  /**
   * 将单个 ReviewIssue 转换为 CreatePullReviewComment
   */
  protected issueToReviewComment(issue: ReviewIssue): CreatePullReviewComment | null {
    const lineNums = this.reviewSpecService.parseLineRange(issue.line);
    if (lineNums.length === 0) {
      return null;
    }
    const lineNum = lineNums[0];
    // 构建评论内容，参照 markdown.formatter.ts 的格式
    const severityEmoji =
      issue.severity === "error" ? "🔴" : issue.severity === "warn" ? "🟡" : "⚪";
    const lines: string[] = [];
    lines.push(`${severityEmoji} **${issue.reason}**`);
    lines.push(`- **文件**: \`${issue.file}:${issue.line}\``);
    lines.push(`- **规则**: \`${issue.ruleId}\` (来自 \`${issue.specFile}\`)`);
    if (issue.commit) {
      lines.push(`- **Commit**: ${issue.commit}`);
    }
    lines.push(`- **开发人员**: ${issue.author ? "@" + issue.author.login : "未知"}`);
    if (issue.suggestion) {
      const ext = extname(issue.file).slice(1) || "";
      const cleanSuggestion = issue.suggestion.replace(/```/g, "//").trim();
      lines.push(`- **建议**:`);
      lines.push(`\`\`\`${ext}`);
      lines.push(cleanSuggestion);
      lines.push("```");
    }
    return {
      path: issue.file,
      body: lines.join("\n"),
      new_position: lineNum,
      old_position: 0,
    };
  }

  protected generateIssueKey(issue: ReviewIssue): string {
    return `${issue.file}:${issue.line}:${issue.ruleId}`;
  }

  protected parseExistingReviewResult(commentBody: string): ReviewResult | null {
    const parsed = this.reviewReportService.parseMarkdown(commentBody);
    if (!parsed) {
      return null;
    }
    return parsed.result;
  }

  /**
   * 将有变更文件的历史 issue 标记为无效
   * 简化策略：如果文件在最新 commit 中有变更，则将该文件的所有历史问题标记为无效
   * @param issues 历史 issue 列表
   * @param headSha 当前 PR head 的 SHA
   * @param owner 仓库所有者
   * @param repo 仓库名
   * @param verbose 日志级别
   * @returns 更新后的 issue 列表
   */
  protected async invalidateIssuesForChangedFiles(
    issues: ReviewIssue[],
    headSha: string | undefined,
    owner: string,
    repo: string,
    verbose?: VerboseLevel,
  ): Promise<ReviewIssue[]> {
    if (!headSha) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⚠️ 无法获取 PR head SHA，跳过变更文件检查`);
      }
      return issues;
    }

    if (shouldLog(verbose, 1)) {
      console.log(`   📊 获取最新 commit 变更文件: ${headSha.slice(0, 7)}`);
    }

    try {
      // 使用 Git Provider API 获取最新一次 commit 的 diff
      const diffText = await this.gitProvider.getCommitDiff(owner, repo, headSha);
      const diffFiles = parseDiffText(diffText);

      if (diffFiles.length === 0) {
        if (shouldLog(verbose, 1)) {
          console.log(`   ⏭️ 最新 commit 无文件变更`);
        }
        return issues;
      }

      // 构建变更文件集合
      const changedFileSet = new Set(diffFiles.map((f) => f.filename));
      if (shouldLog(verbose, 2)) {
        console.log(`   [invalidateIssues] 变更文件: ${[...changedFileSet].join(", ")}`);
      }

      // 将变更文件的历史 issue 标记为无效
      let invalidatedCount = 0;
      const updatedIssues = issues.map((issue) => {
        // 如果 issue 已修复或已无效，不需要处理
        if (issue.fixed || issue.valid === "false") {
          return issue;
        }

        // 如果 issue 所在文件有变更，标记为无效
        if (changedFileSet.has(issue.file)) {
          invalidatedCount++;
          if (shouldLog(verbose, 1)) {
            console.log(`   🗑️ Issue ${issue.file}:${issue.line} 所在文件有变更，标记为无效`);
          }
          return { ...issue, valid: "false", originalLine: issue.originalLine ?? issue.line };
        }

        return issue;
      });

      if (invalidatedCount > 0 && shouldLog(verbose, 1)) {
        console.log(`   📊 共标记 ${invalidatedCount} 个历史问题为无效（文件有变更）`);
      }

      return updatedIssues;
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⚠️ 获取最新 commit 变更文件失败: ${error}`);
      }
      return issues;
    }
  }

  /**
   * 根据代码变更更新历史 issue 的行号
   * 当代码发生变化时，之前发现的 issue 行号可能已经不准确
   * 此方法通过分析 diff 来计算新的行号
   * @param issues 历史 issue 列表
   * @param filePatchMap 文件名到 patch 的映射
   * @param verbose 日志级别
   * @returns 更新后的 issue 列表
   */
  protected updateIssueLineNumbers(
    issues: ReviewIssue[],
    filePatchMap: Map<string, string>,
    verbose?: VerboseLevel,
  ): ReviewIssue[] {
    let updatedCount = 0;
    let invalidatedCount = 0;
    const updatedIssues = issues.map((issue) => {
      // 如果 issue 已修复或无效，不需要更新行号
      if (issue.fixed || issue.valid === "false") {
        return issue;
      }

      const patch = filePatchMap.get(issue.file);
      if (!patch) {
        // 文件没有变更，行号不变
        return issue;
      }

      const lines = this.reviewSpecService.parseLineRange(issue.line);
      if (lines.length === 0) {
        return issue;
      }

      const startLine = lines[0];
      const endLine = lines[lines.length - 1];
      const hunks = parseHunksFromPatch(patch);

      // 计算新的起始行号
      const newStartLine = calculateNewLineNumber(startLine, hunks);
      if (newStartLine === null) {
        // 起始行被删除，直接标记为无效问题
        invalidatedCount++;
        if (shouldLog(verbose, 1)) {
          console.log(`📍 Issue ${issue.file}:${issue.line} 对应的代码已被删除，标记为无效`);
        }
        return { ...issue, valid: "false", originalLine: issue.originalLine ?? issue.line };
      }

      // 如果是范围行号，计算新的结束行号
      let newLine: string;
      if (startLine === endLine) {
        newLine = String(newStartLine);
      } else {
        const newEndLine = calculateNewLineNumber(endLine, hunks);
        if (newEndLine === null || newEndLine === newStartLine) {
          // 结束行被删除或范围缩小为单行，使用起始行
          newLine = String(newStartLine);
        } else {
          newLine = `${newStartLine}-${newEndLine}`;
        }
      }

      // 如果行号发生变化，更新 issue
      if (newLine !== issue.line) {
        updatedCount++;
        if (shouldLog(verbose, 1)) {
          console.log(`📍 Issue 行号更新: ${issue.file}:${issue.line} -> ${issue.file}:${newLine}`);
        }
        return { ...issue, line: newLine, originalLine: issue.originalLine ?? issue.line };
      }

      return issue;
    });

    if ((updatedCount > 0 || invalidatedCount > 0) && shouldLog(verbose, 1)) {
      const parts: string[] = [];
      if (updatedCount > 0) parts.push(`更新 ${updatedCount} 个行号`);
      if (invalidatedCount > 0) parts.push(`标记 ${invalidatedCount} 个无效`);
      console.log(`📊 Issue 行号处理: ${parts.join("，")}`);
    }

    return updatedIssues;
  }

  /**
   * 过滤掉不属于本次 PR commits 的问题（排除 merge commit 引入的代码）
   * 根据 fileContents 中问题行的实际 commit hash 进行验证，而不是依赖 LLM 填写的 commit
   */
  protected filterIssuesByValidCommits(
    issues: ReviewIssue[],
    commits: PullRequestCommit[],
    fileContents: FileContentsMap,
    verbose?: VerboseLevel,
  ): ReviewIssue[] {
    const validCommitHashes = new Set(commits.map((c) => c.sha?.slice(0, 7)).filter(Boolean));

    if (shouldLog(verbose, 3)) {
      console.log(`   🔍 有效 commit hashes: ${Array.from(validCommitHashes).join(", ")}`);
    }

    const beforeCount = issues.length;
    const filtered = issues.filter((issue) => {
      const contentLines = fileContents.get(issue.file);
      if (!contentLines) {
        // 文件不在 fileContents 中，保留 issue
        if (shouldLog(verbose, 3)) {
          console.log(`   ✅ Issue ${issue.file}:${issue.line} - 文件不在 fileContents 中，保留`);
        }
        return true;
      }

      const lineNums = this.reviewSpecService.parseLineRange(issue.line);
      if (lineNums.length === 0) {
        if (shouldLog(verbose, 3)) {
          console.log(`   ✅ Issue ${issue.file}:${issue.line} - 无法解析行号，保留`);
        }
        return true;
      }

      // 检查问题行范围内是否有任意一行属于本次 PR 的有效 commits
      for (const lineNum of lineNums) {
        const lineData = contentLines[lineNum - 1];
        if (lineData) {
          const [actualHash] = lineData;
          if (actualHash !== "-------" && validCommitHashes.has(actualHash)) {
            if (shouldLog(verbose, 3)) {
              console.log(
                `   ✅ Issue ${issue.file}:${issue.line} - 行 ${lineNum} hash=${actualHash} 匹配，保留`,
              );
            }
            return true;
          }
        }
      }

      // 问题行都不属于本次 PR 的有效 commits
      if (shouldLog(verbose, 2)) {
        console.log(`   Issue ${issue.file}:${issue.line} 不在本次 PR 变更行范围内，跳过`);
      }
      if (shouldLog(verbose, 3)) {
        const hashes = lineNums.map((ln) => {
          const ld = contentLines[ln - 1];
          return ld ? `${ln}:${ld[0]}` : `${ln}:N/A`;
        });
        console.log(`   ❌ Issue ${issue.file}:${issue.line} - 行号 hash: ${hashes.join(", ")}`);
      }
      return false;
    });
    if (beforeCount !== filtered.length && shouldLog(verbose, 1)) {
      console.log(`   过滤非本次 PR commits 问题后: ${beforeCount} -> ${filtered.length} 个问题`);
    }
    return filtered;
  }

  protected filterDuplicateIssues(
    newIssues: ReviewIssue[],
    existingIssues: ReviewIssue[],
  ): { filteredIssues: ReviewIssue[]; skippedCount: number } {
    // 只有 valid === 'true' 的历史问题才阻止新问题，其他情况允许覆盖
    const existingKeys = new Set(
      existingIssues
        .filter((issue) => issue.valid === "true")
        .map((issue) => this.generateIssueKey(issue)),
    );
    const filteredIssues = newIssues.filter(
      (issue) => !existingKeys.has(this.generateIssueKey(issue)),
    );
    const skippedCount = newIssues.length - filteredIssues.length;
    return { filteredIssues, skippedCount };
  }

  protected async getExistingReviewResult(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<ReviewResult | null> {
    try {
      // 从 PR Review 获取已有的审查结果
      const reviews = await this.gitProvider.listPullReviews(owner, repo, prNumber);
      const existingReview = reviews.find((r) => r.body?.includes(REVIEW_COMMENT_MARKER));
      if (existingReview?.body) {
        return this.parseExistingReviewResult(existingReview.body);
      }
    } catch (error) {
      console.warn("⚠️ 获取已有评论失败:", error);
    }
    return null;
  }

  protected async ensureClaudeCli(): Promise<void> {
    try {
      execSync("claude --version", { stdio: "ignore" });
    } catch {
      console.log("🔧 Claude CLI 未安装，正在安装...");
      try {
        execSync("npm install -g @anthropic-ai/claude-code", {
          stdio: "inherit",
        });
        console.log("✅ Claude CLI 安装完成");
      } catch (installError) {
        throw new Error(
          `Claude CLI 安装失败: ${installError instanceof Error ? installError.message : String(installError)}`,
        );
      }
    }
  }

  /**
   * 构建文件行号到 commit hash 的映射
   * 遍历每个 commit，获取其修改的文件和行号
   * 优先使用 API，失败时回退到 git 命令
   */
  protected async buildLineCommitMap(
    owner: string,
    repo: string,
    commits: PullRequestCommit[],
    verbose?: VerboseLevel,
  ): Promise<Map<string, Map<number, string>>> {
    // Map<filename, Map<lineNumber, commitHash>>
    const fileLineMap = new Map<string, Map<number, string>>();

    // 按时间顺序遍历 commits（早的在前），后面的 commit 会覆盖前面的
    for (const commit of commits) {
      if (!commit.sha) continue;

      const shortHash = commit.sha.slice(0, 7);
      let files: Array<{ filename: string; patch: string }> = [];

      // 优先使用 getCommitDiff API 获取 diff 文本
      try {
        const diffText = await this.gitProvider.getCommitDiff(owner, repo, commit.sha);
        files = parseDiffText(diffText);
      } catch {
        // API 失败，回退到 git 命令
        files = this.gitSdk.getCommitDiff(commit.sha);
      }
      if (shouldLog(verbose, 2)) console.log(`   commit ${shortHash}: ${files.length} 个文件变更`);

      for (const file of files) {
        // 解析这个 commit 修改的行号
        const changedLines = parseChangedLinesFromPatch(file.patch);

        // 获取或创建文件的行号映射
        if (!fileLineMap.has(file.filename)) {
          fileLineMap.set(file.filename, new Map());
        }
        const lineMap = fileLineMap.get(file.filename)!;

        // 记录每行对应的 commit hash
        for (const lineNum of changedLines) {
          lineMap.set(lineNum, shortHash);
        }
      }
    }

    return fileLineMap;
  }
}
