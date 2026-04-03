import {
  GitProviderService,
  PullRequest,
  PullRequestCommit,
  ChangedFile,
  type LLMMode,
  LlmProxyService,
  type VerboseLevel,
  shouldLog,
  GitSdkService,
} from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { type ReviewConfig } from "./review.config";
import { ReviewSpecService, ReviewIssue, ReviewResult, FileSummary } from "./review-spec";
import { MarkdownFormatter, ReviewReportService } from "./review-report";
import micromatch from "micromatch";
import { ReviewOptions } from "./review.config";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { execSync } from "child_process";
import { ReviewContextBuilder, type ReviewContext } from "./review-context";
import { ReviewIssueFilter } from "./review-issue-filter";
import { ReviewLlmProcessor } from "./review-llm";
import { ReviewPrComment } from "./review-pr-comment";
import {
  extractIssueKeyFromBody as extractIssueKeyFromBodyFn,
  isAiGeneratedComment as isAiGeneratedCommentFn,
  generateIssueKey as generateIssueKeyFn,
  deleteExistingAiReviews as deleteExistingAiReviewsFn,
  syncRepliesToIssues as syncRepliesToIssuesFn,
  calculateIssueStats as calculateIssueStatsFn,
} from "./review-pr-comment-utils";

export type { ReviewContext } from "./review-context";
export type { FileReviewPrompt, ReviewPrompt, LLMReviewOptions } from "./review-llm";

export class ReviewService {
  protected readonly contextBuilder: ReviewContextBuilder;
  protected readonly issueFilter: ReviewIssueFilter;
  protected readonly llmProcessor: ReviewLlmProcessor;
  protected readonly prComment: ReviewPrComment;

  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
    protected readonly reviewSpecService: ReviewSpecService,
    protected readonly llmProxyService: LlmProxyService,
    protected readonly reviewReportService: ReviewReportService,
    protected readonly issueVerifyService: IssueVerifyService,
    protected readonly deletionImpactService: DeletionImpactService,
    protected readonly gitSdk: GitSdkService,
  ) {
    this.contextBuilder = new ReviewContextBuilder(gitProvider, config, gitSdk);
    this.issueFilter = new ReviewIssueFilter(
      gitProvider,
      config,
      reviewSpecService,
      issueVerifyService,
      gitSdk,
    );
    this.llmProcessor = new ReviewLlmProcessor(llmProxyService, reviewSpecService);
    this.prComment = new ReviewPrComment(
      gitProvider,
      config,
      reviewSpecService,
      reviewReportService,
    );
  }

  async getContextFromEnv(options: ReviewOptions): Promise<ReviewContext> {
    return this.contextBuilder.getContextFromEnv(options);
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
      localMode,
      skipDuplicateWorkflow,
      autoApprove,
    } = context;

    // 直接审查文件模式：指定了 -f 文件且 base=head
    const isDirectFileMode = files && files.length > 0 && baseRef === headRef;
    // 本地模式：审查未提交的代码（可能回退到分支比较）
    let isLocalMode = !!localMode;
    // 用于回退时动态计算的 base/head
    let effectiveBaseRef = baseRef;
    let effectiveHeadRef = headRef;

    if (shouldLog(verbose, 1)) {
      console.log(`🔍 Review 启动`);
      console.log(`   DRY-RUN mode: ${dryRun ? "enabled" : "disabled"}`);
      console.log(`   CI mode: ${ci ? "enabled" : "disabled"}`);
      if (isLocalMode) {
        console.log(`   Local mode: ${localMode}`);
      }
      console.log(`   Verbose: ${verbose}`);
    }

    // 如果是 deletionOnly 模式，直接执行删除代码分析
    if (deletionOnly) {
      return this.executeDeletionOnly(context);
    }

    // 如果是 closed 事件或 flush 模式，仅收集 review 状态
    if (context.eventAction === "closed" || context.flush) {
      return this.executeCollectOnly(context);
    }

    const specs = await this.issueFilter.loadSpecs(specSources, verbose);

    let pr: PullRequest | undefined;
    let commits: PullRequestCommit[] = [];
    let changedFiles: ChangedFile[] = [];

    if (isLocalMode) {
      // 本地模式：从 git 获取未提交/暂存区的变更
      if (shouldLog(verbose, 1)) {
        console.log(`📥 本地模式: 获取${localMode === "staged" ? "暂存区" : "未提交"}的代码变更`);
      }
      const localFiles =
        localMode === "staged" ? this.gitSdk.getStagedFiles() : this.gitSdk.getUncommittedFiles();

      if (localFiles.length === 0) {
        // 本地无变更，回退到分支比较模式
        if (shouldLog(verbose, 1)) {
          console.log(
            `ℹ️  没有${localMode === "staged" ? "暂存区" : "未提交"}的代码变更，回退到分支比较模式`,
          );
        }
        isLocalMode = false;
        effectiveHeadRef = this.gitSdk.getCurrentBranch() ?? "HEAD";
        effectiveBaseRef = this.gitSdk.getDefaultBranch();
        if (shouldLog(verbose, 1)) {
          console.log(`📌 自动检测分支: base=${effectiveBaseRef}, head=${effectiveHeadRef}`);
        }
        // 同分支无法比较，提前返回
        if (effectiveBaseRef === effectiveHeadRef) {
          console.log(`ℹ️  当前分支 ${effectiveHeadRef} 与默认分支相同，没有可审查的代码变更`);
          return {
            success: true,
            description: "",
            issues: [],
            summary: [],
            round: 1,
          };
        }
      } else {
        // 一次性获取所有 diff，避免每个文件调用一次 git 命令
        const localDiffs =
          localMode === "staged" ? this.gitSdk.getStagedDiff() : this.gitSdk.getUncommittedDiff();
        const diffMap = new Map(localDiffs.map((d) => [d.filename, d.patch]));

        changedFiles = localFiles.map((f) => ({
          filename: f.filename,
          status: f.status as ChangedFile["status"],
          patch: diffMap.get(f.filename),
        }));

        if (shouldLog(verbose, 1)) {
          console.log(`   Changed files: ${changedFiles.length}`);
        }
      }
    }

    // PR 模式、分支比较模式、或本地模式回退后的分支比较
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

      // 检查是否有其他同名 review workflow 正在运行中（防止同一 PR 重复审查）
      if (skipDuplicateWorkflow && ci && pr?.head?.sha) {
        const skipResult = await this.checkDuplicateWorkflow(
          owner,
          repo,
          prNumber,
          pr.head.sha,
          verbose,
        );
        if (skipResult) return skipResult;
      }
    } else if (effectiveBaseRef && effectiveHeadRef) {
      // 如果指定了 -f 文件且 base=head（无差异模式），直接审查指定文件
      if (files && files.length > 0 && effectiveBaseRef === effectiveHeadRef) {
        if (shouldLog(verbose, 1)) {
          console.log(`📥 直接审查指定文件模式 (${files.length} 个文件)`);
        }
        changedFiles = files.map((f) => ({ filename: f, status: "modified" as const }));
      } else if (changedFiles.length === 0) {
        // 仅当 changedFiles 为空时才获取（避免与回退逻辑重复）
        if (shouldLog(verbose, 1)) {
          console.log(
            `📥 获取 ${effectiveBaseRef}...${effectiveHeadRef} 的差异 (owner: ${owner}, repo: ${repo})`,
          );
        }
        changedFiles = await this.getChangedFilesBetweenRefs(
          owner,
          repo,
          effectiveBaseRef,
          effectiveHeadRef,
        );
        commits = await this.getCommitsBetweenRefs(effectiveBaseRef, effectiveHeadRef);
        if (shouldLog(verbose, 1)) {
          console.log(`   Changed files: ${changedFiles.length}`);
          console.log(`   Commits: ${commits.length}`);
        }
      }
    } else if (!isLocalMode) {
      // 非本地模式且无有效的 base/head
      if (shouldLog(verbose, 1)) {
        console.log(`❌ 错误: 缺少 prNumber 或 baseRef/headRef`, { prNumber, baseRef, headRef });
      }
      throw new Error("必须指定 PR 编号或者 base/head 分支");
    }

    // 0. 过滤掉 merge commit
    {
      const beforeMergeFilterCount = commits.length;
      commits = commits.filter((c) => {
        const message = c.commit?.message || "";
        return !message.startsWith("Merge ");
      });
      if (beforeMergeFilterCount !== commits.length && shouldLog(verbose, 1)) {
        console.log(`   跳过 Merge Commits: ${beforeMergeFilterCount} -> ${commits.length} 个`);
      }
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
      return this.handleNoApplicableSpecs(
        context,
        applicableSpecs,
        changedFiles,
        commits,
        ci,
        prNumber,
        dryRun,
        verbose,
        llmMode,
        autoApprove,
      );
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
      isLocalMode,
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
      : await this.buildBasicDescription(commits, changedFiles);
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

    // 过滤掉不属于本次 PR commits 的问题
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

        // 先同步最新的 resolved 状态
        await this.syncResolvedComments(owner, repo, prNumber, existingResult);

        // 如果文件有变更，将该文件的历史问题标记为无效
        const reviewConf = this.config.getPluginConfig<ReviewConfig>("review");
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
          existingIssues = await this.issueFilter.verifyAndUpdateIssues(
            context,
            existingIssues,
            commits,
            {
              specs,
              fileContents,
            },
          );
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
        { verbose, autoApprove, skipSync: true },
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
          { verbose, skipSync: true },
        );
        if (shouldLog(verbose, 1)) {
          console.log(`✅ 评论已更新`);
        }
      }
    }

    const reviewComment = this.prComment.formatReviewComment(
      { ...result, issues: allIssues },
      { prNumber, outputFormat: context.outputFormat, ci },
    );

    // 终端输出（根据 outputFormat 或智能选择）
    console.log(MarkdownFormatter.clearReviewData(reviewComment, "<hidden>"));

    return result;
  }

  /**
   * 仅收集 review 状态模式（用于 PR 关闭或 --flush 指令）
   */
  protected async executeCollectOnly(context: ReviewContext): Promise<ReviewResult> {
    const { owner, repo, prNumber, verbose, ci, dryRun, autoApprove } = context;

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

    // 4. 同步评论 reactions（👍/👎/☹️）
    await this.syncReactionsToIssues(owner, repo, prNumber, existingResult, verbose);

    // 5. LLM 验证历史问题是否已修复
    try {
      existingResult.issues = await this.issueFilter.verifyAndUpdateIssues(
        context,
        existingResult.issues,
        commits,
      );
    } catch (error) {
      console.warn("⚠️ LLM 验证修复状态失败，跳过:", error);
    }

    // 6. 统计问题状态并设置到 result
    const stats = this.calculateIssueStats(existingResult.issues);
    existingResult.stats = stats;

    // 7. 输出统计信息
    console.log(this.reviewReportService.formatStatsTerminal(stats, prNumber));

    // 8. 更新 PR 评论（如果不是 dry-run）
    if (ci && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 更新 PR 评论...`);
      }
      await this.postOrUpdateReviewComment(owner, repo, prNumber, existingResult, {
        verbose,
        autoApprove,
      });
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已更新`);
      }
    }

    return existingResult;
  }

  /**
   * 仅执行删除代码分析模式
   */
  protected async executeDeletionOnly(context: ReviewContext): Promise<ReviewResult> {
    const { owner, repo, prNumber, baseRef, headRef, dryRun, ci, verbose, llmMode, autoApprove } =
      context;

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
      : await this.buildBasicDescription(commits, changedFiles);
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
      await this.postOrUpdateReviewComment(owner, repo, prNumber, result, { verbose, autoApprove });
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已提交`);
      }
    }

    // 终端输出
    console.log(MarkdownFormatter.clearReviewData(reviewComment, "<hidden>"));

    return result;
  }

  /**
   * 处理无适用规则或无变更文件的情况
   */
  private async handleNoApplicableSpecs(
    context: ReviewContext,
    applicableSpecs: any[],
    changedFiles: ChangedFile[],
    commits: PullRequestCommit[],
    ci: boolean,
    prNumber: number | undefined,
    dryRun: boolean,
    verbose: VerboseLevel | undefined,
    llmMode: LLMMode | undefined,
    autoApprove: boolean | undefined,
  ): Promise<ReviewResult> {
    if (shouldLog(verbose, 1)) {
      console.log("✅ 没有需要审查的文件或规则");
    }

    // 获取上一次的审查结果以计算正确的轮次
    let existingResult: ReviewResult | null = null;
    if (ci && prNumber) {
      existingResult = await this.getExistingReviewResult(context.owner, context.repo, prNumber);
    }
    const currentRound = (existingResult?.round ?? 0) + 1;

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
        : await this.buildBasicDescription(commits, changedFiles);
    const result: ReviewResult = {
      success: true,
      title: prInfo.title,
      description: prInfo.description,
      issues: [],
      summary,
      round: currentRound,
    };

    // CI 模式下也需要发送 review 评论
    if (ci && prNumber && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 提交 PR 评论...`);
      }
      await this.postOrUpdateReviewComment(context.owner, context.repo, prNumber, result, {
        verbose,
        autoApprove,
      });
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已提交`);
      }
    }

    return result;
  }

  /**
   * 检查是否有其他同名 review workflow 正在运行中
   */
  private async checkDuplicateWorkflow(
    owner: string,
    repo: string,
    prNumber: number,
    headSha: string,
    verbose?: VerboseLevel,
  ): Promise<ReviewResult | null> {
    const ref = process.env.GITHUB_REF || process.env.GITEA_REF || "";
    const prMatch = ref.match(/refs\/pull\/(\d+)/);
    const currentPrNumber = prMatch ? parseInt(prMatch[1], 10) : prNumber;

    try {
      const runningWorkflows = await this.gitProvider.listWorkflowRuns(owner, repo, {
        status: "in_progress",
      });
      const currentWorkflowName = process.env.GITHUB_WORKFLOW || process.env.GITEA_WORKFLOW;
      const currentRunId = process.env.GITHUB_RUN_ID || process.env.GITEA_RUN_ID;
      const duplicateReviewRuns = runningWorkflows.filter(
        (w) =>
          w.sha === headSha &&
          w.name === currentWorkflowName &&
          (!currentRunId || String(w.id) !== currentRunId),
      );
      if (duplicateReviewRuns.length > 0) {
        if (shouldLog(verbose, 1)) {
          console.log(
            `⏭️ 跳过审查: 当前 PR #${currentPrNumber} 有 ${duplicateReviewRuns.length} 个同名 workflow 正在运行中`,
          );
        }
        return {
          success: true,
          description: `跳过审查: PR #${currentPrNumber} 有 ${duplicateReviewRuns.length} 个同名 workflow 正在运行中，等待完成后重新审查`,
          issues: [],
          summary: [],
          round: 1,
        };
      }
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn(
          `⚠️ 无法检查重复 workflow（可能缺少 repo owner 权限），跳过此检查:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    return null;
  }

  // --- Delegation methods for backward compatibility with tests ---

  protected async fillIssueAuthors(...args: Parameters<ReviewContextBuilder["fillIssueAuthors"]>) {
    return this.contextBuilder.fillIssueAuthors(...args);
  }

  protected async getFileContents(...args: Parameters<ReviewIssueFilter["getFileContents"]>) {
    return this.issueFilter.getFileContents(...args);
  }

  protected async getFilesForCommit(...args: Parameters<ReviewIssueFilter["getFilesForCommit"]>) {
    return this.issueFilter.getFilesForCommit(...args);
  }

  protected async invalidateIssuesForChangedFiles(
    ...args: Parameters<ReviewIssueFilter["invalidateIssuesForChangedFiles"]>
  ) {
    return this.issueFilter.invalidateIssuesForChangedFiles(...args);
  }

  protected async getChangedFilesBetweenRefs(
    ...args: Parameters<ReviewIssueFilter["getChangedFilesBetweenRefs"]>
  ) {
    return this.issueFilter.getChangedFilesBetweenRefs(...args);
  }

  protected async getCommitsBetweenRefs(
    ...args: Parameters<ReviewIssueFilter["getCommitsBetweenRefs"]>
  ) {
    return this.issueFilter.getCommitsBetweenRefs(...args);
  }

  protected async buildLineCommitMap(...args: Parameters<ReviewIssueFilter["buildLineCommitMap"]>) {
    return this.issueFilter.buildLineCommitMap(...args);
  }

  protected updateIssueLineNumbers(
    ...args: Parameters<ReviewIssueFilter["updateIssueLineNumbers"]>
  ) {
    return this.issueFilter.updateIssueLineNumbers(...args);
  }

  protected filterIssuesByValidCommits(
    ...args: Parameters<ReviewIssueFilter["filterIssuesByValidCommits"]>
  ) {
    return this.issueFilter.filterIssuesByValidCommits(...args);
  }

  protected filterDuplicateIssues(...args: Parameters<ReviewIssueFilter["filterDuplicateIssues"]>) {
    return this.issueFilter.filterDuplicateIssues(...args);
  }

  protected async fillIssueCode(...args: Parameters<ReviewIssueFilter["fillIssueCode"]>) {
    return this.issueFilter.fillIssueCode(...args);
  }

  protected async getExistingReviewResult(owner: string, repo: string, prNumber: number) {
    return this.issueFilter.getExistingReviewResult(owner, repo, prNumber, (body) =>
      this.reviewReportService.parseMarkdown(body),
    );
  }

  protected async runLLMReview(...args: Parameters<ReviewLlmProcessor["runLLMReview"]>) {
    return this.llmProcessor.runLLMReview(...args);
  }

  protected filterSpecsForFile(...args: Parameters<ReviewLlmProcessor["filterSpecsForFile"]>) {
    return this.llmProcessor.filterSpecsForFile(...args);
  }

  protected buildSystemPrompt(...args: Parameters<ReviewLlmProcessor["buildSystemPrompt"]>) {
    return this.llmProcessor.buildSystemPrompt(...args);
  }

  protected async buildReviewPrompt(...args: Parameters<ReviewLlmProcessor["buildReviewPrompt"]>) {
    return this.llmProcessor.buildReviewPrompt(...args);
  }

  protected normalizeIssues(...args: Parameters<ReviewLlmProcessor["normalizeIssues"]>) {
    return this.llmProcessor.normalizeIssues(...args);
  }

  protected async generatePrDescription(
    ...args: Parameters<ReviewLlmProcessor["generatePrDescription"]>
  ) {
    return this.llmProcessor.generatePrDescription(...args);
  }

  protected async buildBasicDescription(
    ...args: Parameters<ReviewLlmProcessor["buildBasicDescription"]>
  ) {
    return this.llmProcessor.buildBasicDescription(...args);
  }

  protected async reviewSingleFile(...args: Parameters<ReviewLlmProcessor["reviewSingleFile"]>) {
    return this.llmProcessor.reviewSingleFile(...args);
  }

  protected async getFileDirectoryInfo(
    ...args: Parameters<ReviewLlmProcessor["getFileDirectoryInfo"]>
  ) {
    return this.llmProcessor.getFileDirectoryInfo(...args);
  }

  protected formatReviewComment(...args: Parameters<ReviewPrComment["formatReviewComment"]>) {
    return this.prComment.formatReviewComment(...args);
  }

  protected async postOrUpdateReviewComment(
    ...args: Parameters<ReviewPrComment["postOrUpdateReviewComment"]>
  ) {
    return this.prComment.postOrUpdateReviewComment(...args);
  }

  protected async syncResolvedComments(
    ...args: Parameters<ReviewPrComment["syncResolvedComments"]>
  ) {
    return this.prComment.syncResolvedComments(...args);
  }

  protected async syncReactionsToIssues(
    ...args: Parameters<ReviewPrComment["syncReactionsToIssues"]>
  ) {
    return this.prComment.syncReactionsToIssues(...args);
  }

  protected lineMatchesPosition(...args: Parameters<ReviewPrComment["lineMatchesPosition"]>) {
    return this.prComment.lineMatchesPosition(...args);
  }

  protected issueToReviewComment(...args: Parameters<ReviewPrComment["issueToReviewComment"]>) {
    return this.prComment.issueToReviewComment(...args);
  }

  protected parseExistingReviewResult(
    ...args: Parameters<ReviewPrComment["parseExistingReviewResult"]>
  ) {
    return this.prComment.parseExistingReviewResult(...args);
  }

  protected async generatePrTitle(...args: Parameters<ReviewLlmProcessor["generatePrTitle"]>) {
    return this.llmProcessor.generatePrTitle(...args);
  }

  protected getFallbackTitle(...args: Parameters<ReviewLlmProcessor["getFallbackTitle"]>) {
    return this.llmProcessor.getFallbackTitle(...args);
  }

  protected async callLLM(...args: Parameters<ReviewLlmProcessor["callLLM"]>) {
    return this.llmProcessor.callLLM(...args);
  }

  protected calculateIssueStats(issues: ReviewIssue[]) {
    return calculateIssueStatsFn(issues);
  }

  protected buildLineReviewBody(...args: Parameters<ReviewPrComment["buildLineReviewBody"]>) {
    return this.prComment.buildLineReviewBody(...args);
  }

  protected async findExistingAiComments(
    owner: string,
    repo: string,
    prNumber: number,
    verbose?: VerboseLevel,
  ) {
    return this.prComment.findExistingAiComments(owner, repo, prNumber, verbose);
  }

  protected async deleteExistingAiReviews(owner: string, repo: string, prNumber: number) {
    return deleteExistingAiReviewsFn(this.gitProvider, owner, repo, prNumber);
  }

  protected extractIssueKeyFromBody(body: string) {
    return extractIssueKeyFromBodyFn(body);
  }

  protected isAiGeneratedComment(body: string) {
    return isAiGeneratedCommentFn(body);
  }

  protected generateIssueKey(issue: any) {
    return generateIssueKeyFn(issue);
  }

  protected async syncRepliesToIssues(
    owner: string,
    repo: string,
    prNumber: number,
    reviewComments: any[],
    result: any,
  ) {
    return syncRepliesToIssuesFn(
      owner,
      repo,
      prNumber,
      reviewComments,
      result,
      (line: string, pos?: number) => this.prComment.lineMatchesPosition(line, pos),
    );
  }

  protected normalizeFilePaths(...args: Parameters<ReviewContextBuilder["normalizeFilePaths"]>) {
    return this.contextBuilder.normalizeFilePaths(...args);
  }

  protected resolveAnalyzeDeletions(
    ...args: Parameters<ReviewContextBuilder["resolveAnalyzeDeletions"]>
  ) {
    return this.contextBuilder.resolveAnalyzeDeletions(...args);
  }

  protected async getPrNumberFromEvent(
    ...args: Parameters<ReviewContextBuilder["getPrNumberFromEvent"]>
  ) {
    return this.contextBuilder.getPrNumberFromEvent(...args);
  }

  /**
   * 确保 Claude CLI 已安装
   */
  protected async ensureClaudeCli(ci?: boolean): Promise<void> {
    try {
      execSync("claude --version", { stdio: "ignore" });
    } catch {
      if (ci) {
        throw new Error(
          "Claude CLI 未安装。CI 环境请在 workflow 中预装: npm install -g @anthropic-ai/claude-code",
        );
      }
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
}
