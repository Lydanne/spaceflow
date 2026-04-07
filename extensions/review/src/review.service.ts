import {
  GitProviderService,
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
import { ReviewSpecService, ReviewResult, FileSummary } from "./review-spec";
import { MarkdownFormatter, ReviewReportService } from "./review-report";
import micromatch from "micromatch";
import { ReviewOptions } from "./review.config";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { execSync } from "child_process";
import { ReviewContextBuilder, type ReviewContext } from "./review-context";
import { ReviewIssueFilter } from "./review-issue-filter";
import { filterFilesByIncludes, extractGlobsFromIncludes } from "./review-includes-filter";
import { ReviewLlmProcessor } from "./review-llm";
import { PullRequestModel } from "./pull-request-model";
import { ReviewResultModel, type ReviewResultModelDeps } from "./review-result-model";
import { REVIEW_COMMENT_MARKER, REVIEW_LINE_COMMENTS_MARKER } from "./utils/review-pr-comment";

export type { ReviewContext } from "./review-context";
export type { FileReviewPrompt, ReviewPrompt, LLMReviewOptions } from "./review-llm";

export class ReviewService {
  protected readonly contextBuilder: ReviewContextBuilder;
  protected readonly issueFilter: ReviewIssueFilter;
  protected readonly llmProcessor: ReviewLlmProcessor;
  protected readonly resultModelDeps: ReviewResultModelDeps;

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
    this.resultModelDeps = {
      gitProvider,
      config,
      reviewSpecService,
      reviewReportService,
    };
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
    const { specSources, verbose, llmMode, deletionOnly } = context;

    if (shouldLog(verbose, 1)) {
      console.log(`🔍 Review 启动`);
      console.log(`   DRY-RUN mode: ${context.dryRun ? "enabled" : "disabled"}`);
      console.log(`   CI mode: ${context.ci ? "enabled" : "disabled"}`);
      if (context.localMode) console.log(`   Local mode: ${context.localMode}`);
      console.log(`   Verbose: ${verbose}`);
    }

    // 早期分流
    if (deletionOnly) return this.executeDeletionOnly(context);
    if (context.eventAction === "closed" || context.flush) return this.executeCollectOnly(context);

    // 1. 解析输入数据（本地/PR/分支模式 + 前置过滤）
    const source = await this.resolveSourceData(context);
    if (source.earlyReturn) return source.earlyReturn;

    const { prModel, commits, changedFiles, headSha, isDirectFileMode } = source;

    // 2. 规则匹配
    const specs = await this.issueFilter.loadSpecs(specSources, verbose);
    const applicableSpecs = this.reviewSpecService.filterApplicableSpecs(specs, changedFiles);
    if (shouldLog(verbose, 2)) {
      console.log(
        `[execute] loadSpecs: loaded ${specs.length} specs from sources: ${JSON.stringify(specSources)}`,
      );
      console.log(
        `[execute] filterApplicableSpecs: ${applicableSpecs.length} applicable out of ${specs.length}, changedFiles=${JSON.stringify(changedFiles.map((f) => f.filename))}`,
      );
    }
    if (shouldLog(verbose, 1)) {
      console.log(`   适用的规则文件: ${applicableSpecs.length}`);
    }
    if (applicableSpecs.length === 0 || changedFiles.length === 0) {
      return this.handleNoApplicableSpecs(context, applicableSpecs, changedFiles, commits);
    }

    // 3. 获取文件内容 + LLM 审查
    const fileContents = await this.getFileContents(
      context.owner,
      context.repo,
      changedFiles,
      commits,
      headSha,
      context.prNumber,
      verbose,
      source.isLocalMode,
    );
    if (!llmMode) throw new Error("必须指定 LLM 类型");

    // 获取上一次的审查结果（用于提示词优化和轮次推进）
    let existingResultModel: ReviewResultModel | null = null;
    if (context.ci && prModel) {
      existingResultModel = await ReviewResultModel.loadFromPr(prModel, this.resultModelDeps);
      if (existingResultModel && shouldLog(verbose, 1)) {
        console.log(`📋 获取到上一次审查结果，包含 ${existingResultModel.issues.length} 个问题`);
      }
    }
    if (shouldLog(verbose, 1)) {
      console.log(`🔄 当前审查轮次: ${(existingResultModel?.round ?? 0) + 1}`);
    }

    const reviewPrompt = await this.buildReviewPrompt(
      specs,
      changedFiles,
      fileContents,
      commits,
      existingResultModel?.result ?? null,
      context.whenModifiedCode,
      verbose,
      context.systemRules,
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
    if (shouldLog(verbose, 1)) {
      console.log(`📝 LLM 审查完成，发现 ${result.issues.length} 个问题`);
    }

    // 4. 过滤新 issues
    result.issues = await this.fillIssueCode(result.issues, fileContents);
    result.issues = this.filterNewIssues(result.issues, specs, applicableSpecs, {
      commits,
      fileContents,
      changedFiles,
      isDirectFileMode,
      context,
    });

    // 静态规则产生的系统问题直接合并，不经过过滤管道
    if (reviewPrompt.staticIssues?.length) {
      result.issues = [...reviewPrompt.staticIssues, ...result.issues];
      if (shouldLog(verbose, 1)) {
        console.log(`⚙️  追加 ${reviewPrompt.staticIssues.length} 个静态规则系统问题`);
      }
    }
    if (shouldLog(verbose, 1)) {
      console.log(`📝 最终发现 ${result.issues.length} 个问题`);
    }

    // 5. 构建最终的 ReviewResultModel
    const finalModel = await this.buildFinalModel(
      context,
      result,
      { prModel, commits, headSha, specs, fileContents },
      existingResultModel,
    );

    // 6. 保存 + 输出
    await this.saveAndOutput(context, finalModel, commits);
    return finalModel.result;
  }

  // ─── 提取的子方法 ──────────────────────────────────────

  /**
   * 解析输入数据：根据模式（本地/PR/分支比较）获取 commits、changedFiles 等。
   * 包含前置过滤（merge commit、files、commits、includes）。
   * 如果需要提前返回（如同分支、重复 workflow），通过 earlyReturn 字段传递。
   */
  protected async resolveSourceData(context: ReviewContext): Promise<{
    prModel?: PullRequestModel;
    commits: PullRequestCommit[];
    changedFiles: ChangedFile[];
    headSha: string;
    isLocalMode: boolean;
    isDirectFileMode: boolean;
    earlyReturn?: ReviewResult;
  }> {
    const {
      owner,
      repo,
      prNumber,
      baseRef,
      headRef,
      verbose,
      ci,
      includes,
      files,
      commits: filterCommits,
      localMode,
      duplicateWorkflowResolved,
    } = context;

    const isDirectFileMode = !!(files && files.length > 0 && baseRef === headRef);
    let isLocalMode = !!localMode;
    let effectiveBaseRef = baseRef;
    let effectiveHeadRef = headRef;

    let prModel: PullRequestModel | undefined;
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
            commits: [],
            changedFiles: [],
            headSha: "HEAD",
            isLocalMode: false,
            isDirectFileMode: false,
            earlyReturn: { success: true, description: "", issues: [], summary: [], round: 1 },
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
      prModel = new PullRequestModel(this.gitProvider, owner, repo, prNumber);
      const prInfo = await prModel.getInfo();
      commits = await prModel.getCommits();
      changedFiles = await prModel.getFiles();
      if (shouldLog(verbose, 1)) {
        console.log(`   PR: ${prInfo?.title}`);
        console.log(`   Commits: ${commits.length}`);
        console.log(`   Changed files: ${changedFiles.length}`);
      }

      // 检查是否有其他同名 review workflow 正在运行中
      if (duplicateWorkflowResolved !== "off" && ci && prInfo?.head?.sha) {
        const duplicateResult = await this.checkDuplicateWorkflow(
          prModel,
          prInfo.head.sha,
          duplicateWorkflowResolved,
          verbose,
        );
        if (duplicateResult) {
          return {
            prModel,
            commits,
            changedFiles,
            headSha: prInfo.head.sha,
            isLocalMode,
            isDirectFileMode,
            earlyReturn: duplicateResult,
          };
        }
      }
    } else if (effectiveBaseRef && effectiveHeadRef) {
      if (files && files.length > 0 && effectiveBaseRef === effectiveHeadRef) {
        if (shouldLog(verbose, 1)) {
          console.log(`📥 直接审查指定文件模式 (${files.length} 个文件)`);
        }
        changedFiles = files.map((f) => ({ filename: f, status: "modified" as const }));
      } else if (changedFiles.length === 0) {
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
      if (shouldLog(verbose, 1)) {
        console.log(`❌ 错误: 缺少 prNumber 或 baseRef/headRef`, { prNumber, baseRef, headRef });
      }
      throw new Error("必须指定 PR 编号或者 base/head 分支");
    }

    // ── 前置过滤 ──────────────────────────────────────────

    // 0. 过滤掉 merge commit
    {
      const before = commits.length;
      commits = commits.filter((c) => {
        const message = c.commit?.message || "";
        return !message.startsWith("Merge ");
      });
      if (before !== commits.length && shouldLog(verbose, 1)) {
        console.log(`   跳过 Merge Commits: ${before} -> ${commits.length} 个`);
      }
    }

    // 1. 按指定的 files 过滤
    if (files && files.length > 0) {
      const before = changedFiles.length;
      changedFiles = changedFiles.filter((f) => files.includes(f.filename || ""));
      if (shouldLog(verbose, 1)) {
        console.log(`   Files 过滤文件: ${before} -> ${changedFiles.length} 个文件`);
      }
    }

    // 2. 按指定的 commits 过滤
    if (filterCommits && filterCommits.length > 0) {
      const beforeCommits = commits.length;
      commits = commits.filter((c) => filterCommits.some((fc) => fc && c.sha?.startsWith(fc)));
      if (shouldLog(verbose, 1)) {
        console.log(`   Commits 过滤: ${beforeCommits} -> ${commits.length} 个`);
      }

      const beforeFiles = changedFiles.length;
      const commitFilenames = new Set<string>();
      for (const commit of commits) {
        if (!commit.sha) continue;
        const commitFiles = await this.getFilesForCommit(owner, repo, commit.sha, prNumber);
        commitFiles.forEach((f) => commitFilenames.add(f));
      }
      changedFiles = changedFiles.filter((f) => commitFilenames.has(f.filename || ""));
      if (shouldLog(verbose, 1)) {
        console.log(`   按 Commits 过滤文件: ${beforeFiles} -> ${changedFiles.length} 个文件`);
      }
    }

    // 3. 使用 includes 过滤文件和 commits（支持 added|/modified|/deleted| 前缀语法）
    if (includes && includes.length > 0) {
      const beforeFiles = changedFiles.length;
      if (shouldLog(verbose, 2)) {
        console.log(
          `[resolveSourceData] filterFilesByIncludes: before=${JSON.stringify(changedFiles.map((f) => ({ filename: f.filename, status: f.status })))}, includes=${JSON.stringify(includes)}`,
        );
      }
      changedFiles = filterFilesByIncludes(changedFiles, includes);
      if (shouldLog(verbose, 1)) {
        console.log(`   Includes 过滤文件: ${beforeFiles} -> ${changedFiles.length} 个文件`);
      }
      if (shouldLog(verbose, 2)) {
        console.log(
          `[resolveSourceData] filterFilesByIncludes: after=${JSON.stringify(changedFiles.map((f) => f.filename))}`,
        );
      }

      const globs = extractGlobsFromIncludes(includes);
      const beforeCommits = commits.length;
      const filteredCommits: PullRequestCommit[] = [];
      for (const commit of commits) {
        if (!commit.sha) continue;
        const commitFiles = await this.getFilesForCommit(owner, repo, commit.sha, prNumber);
        if (micromatch.some(commitFiles, globs)) {
          filteredCommits.push(commit);
        }
      }
      commits = filteredCommits;
      if (shouldLog(verbose, 1)) {
        console.log(`   Includes 过滤 Commits: ${beforeCommits} -> ${commits.length} 个`);
      }
    }

    const headSha = prModel ? await prModel.getHeadSha() : headRef || "HEAD";
    return { prModel, commits, changedFiles, headSha, isLocalMode, isDirectFileMode };
  }

  /**
   * LLM 审查后的 issue 过滤管道：
   * includes → 规则存在性 → overrides → 变更行过滤 → 格式化
   */
  protected filterNewIssues(
    issues: ReviewResult["issues"],
    specs: any[],
    applicableSpecs: any[],
    opts: {
      commits: PullRequestCommit[];
      fileContents: any;
      changedFiles: ChangedFile[];
      isDirectFileMode: boolean;
      context: ReviewContext;
    },
  ): ReviewResult["issues"] {
    const { commits, fileContents, changedFiles, isDirectFileMode, context } = opts;
    const { verbose } = context;

    let filtered = this.reviewSpecService.filterIssuesByIncludes(issues, applicableSpecs);
    if (shouldLog(verbose, 1)) {
      console.log(`   应用 includes 过滤后: ${filtered.length} 个问题`);
    }

    filtered = this.reviewSpecService.filterIssuesByRuleExistence(filtered, specs);
    if (shouldLog(verbose, 1)) {
      console.log(`   应用规则存在性过滤后: ${filtered.length} 个问题`);
    }

    filtered = this.reviewSpecService.filterIssuesByOverrides(filtered, applicableSpecs, verbose);

    // 变更行过滤
    if (shouldLog(verbose, 3)) {
      console.log(`   🔍 变更行过滤条件检查:`);
      console.log(
        `      showAll=${context.showAll}, isDirectFileMode=${isDirectFileMode}, commits.length=${commits.length}`,
      );
    }
    if (!context.showAll && !isDirectFileMode && commits.length > 0) {
      if (shouldLog(verbose, 2)) {
        console.log(`   🔍 开始变更行过滤，当前 ${filtered.length} 个问题`);
      }
      filtered = this.filterIssuesByValidCommits(filtered, commits, fileContents, verbose);
      if (shouldLog(verbose, 2)) {
        console.log(`   🔍 变更行过滤完成，剩余 ${filtered.length} 个问题`);
      }
    } else if (shouldLog(verbose, 1)) {
      console.log(
        `   跳过变更行过滤 (${context.showAll ? "showAll=true" : isDirectFileMode ? "直接审查文件模式" : "commits.length=0"})`,
      );
    }

    filtered = this.reviewSpecService.formatIssues(filtered, { specs, changedFiles });
    if (shouldLog(verbose, 1)) {
      console.log(`   应用格式化后: ${filtered.length} 个问题`);
    }

    return filtered;
  }

  /**
   * 构建最终的 ReviewResultModel：处理历史 issue 合并或首次创建
   */
  protected async buildFinalModel(
    context: ReviewContext,
    result: ReviewResult,
    source: {
      prModel?: PullRequestModel;
      commits: PullRequestCommit[];
      headSha: string;
      specs: any[];
      fileContents: any;
    },
    existingResultModel: ReviewResultModel | null,
  ): Promise<ReviewResultModel> {
    const { prModel, commits, headSha, specs, fileContents } = source;
    const { verbose, ci } = context;

    if (ci && prModel && existingResultModel && existingResultModel.issues.length > 0) {
      if (shouldLog(verbose, 1)) {
        console.log(`📋 已有评论中存在 ${existingResultModel.issues.length} 个问题`);
      }

      // 预处理历史 issues：同步 resolved 状态
      await existingResultModel.syncResolved();

      // 如果文件有变更，将该文件的历史问题标记为无效
      const reviewConf = this.config.getPluginConfig<ReviewConfig>("review");
      if (
        reviewConf.invalidateChangedFiles !== "off" &&
        reviewConf.invalidateChangedFiles !== "keep"
      ) {
        await existingResultModel.invalidateChangedFiles(headSha, verbose);
      }

      // 验证历史问题是否已修复
      if (context.verifyFixes) {
        existingResultModel.issues = await this.issueFilter.verifyAndUpdateIssues(
          context,
          existingResultModel.issues,
          commits,
          { specs, fileContents },
          prModel,
        );
      } else {
        if (shouldLog(verbose, 1)) {
          console.log(`   ⏭️  跳过历史问题验证 (verifyFixes=false)`);
        }
      }

      // 去重：与所有历史 issues 去重
      const { filteredIssues: newIssues, skippedCount } = this.filterDuplicateIssues(
        result.issues,
        existingResultModel.issues,
      );
      if (skippedCount > 0 && shouldLog(verbose, 1)) {
        console.log(`   跳过 ${skippedCount} 个重复问题，新增 ${newIssues.length} 个问题`);
      }
      result.issues = newIssues;
      result.headSha = headSha;

      // 自动 round 递增 + issues 合并
      return existingResultModel.nextRound(result);
    }

    // 首次审查或无历史结果
    result.round = 1;
    result.headSha = headSha;
    result.issues = result.issues.map((issue) => ({ ...issue, round: 1 }));
    return prModel
      ? ReviewResultModel.create(prModel, result, this.resultModelDeps)
      : ReviewResultModel.createLocal(result, this.resultModelDeps);
  }

  /**
   * 统一的保存 + 输出逻辑
   */
  protected async saveAndOutput(
    context: ReviewContext,
    finalModel: ReviewResultModel,
    commits: PullRequestCommit[],
  ): Promise<void> {
    const {
      owner,
      repo,
      prNumber,
      baseRef,
      headRef,
      verbose,
      ci,
      dryRun,
      llmMode,
      includes,
      autoApprove,
    } = context;
    const prModel = finalModel.pr.number > 0 ? finalModel.pr : undefined;

    // 填充 author 信息
    if (commits.length > 0) {
      finalModel.issues = await this.fillIssueAuthors(
        finalModel.issues,
        commits,
        owner,
        repo,
        verbose,
      );
    }

    // 删除代码影响分析（在 save 之前完成，避免多次 save 产生重复的 Round 评论）
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
      finalModel.update({ deletionImpact });
    }

    // 统一提交报告（只调用一次 save，避免重复创建 PR Review）
    if (prModel && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 提交 PR 评论...`);
      }
      await finalModel.save({ verbose, autoApprove, skipSync: true });
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已提交`);
      }
    }

    // 终端输出
    const reviewComment = finalModel.formatComment({
      prNumber,
      outputFormat: context.outputFormat,
      ci,
    });
    console.log(MarkdownFormatter.clearReviewData(reviewComment, "<hidden>"));
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

    const prModel = new PullRequestModel(this.gitProvider, owner, repo, prNumber);

    // 1. 从现有的 AI review 评论中读取问题
    const resultModel = await ReviewResultModel.loadFromPr(prModel, this.resultModelDeps);
    if (!resultModel) {
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
      console.log(`📋 找到 ${resultModel.issues.length} 个历史问题`);
    }

    // 2. 获取 commits 并填充 author 信息
    const commits = await prModel.getCommits();
    resultModel.issues = await this.fillIssueAuthors(
      resultModel.issues,
      commits,
      owner,
      repo,
      verbose,
    );

    // 3. 同步已解决的评论状态
    await resultModel.syncResolved();

    // 4. 同步评论 reactions（👍/👎/☹️）
    await resultModel.syncReactions(verbose);

    // 5. LLM 验证历史问题是否已修复
    try {
      resultModel.issues = await this.issueFilter.verifyAndUpdateIssues(
        context,
        resultModel.issues,
        commits,
        undefined,
        prModel,
      );
    } catch (error) {
      console.warn("⚠️ LLM 验证修复状态失败，跳过:", error);
    }

    // 6. 统计问题状态并设置到 result
    const stats = resultModel.updateStats();

    // 7. 输出统计信息
    console.log(this.reviewReportService.formatStatsTerminal(stats, prNumber));

    // 8. 更新 PR 评论（如果不是 dry-run）
    if (ci && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 更新 PR 评论...`);
      }
      await resultModel.save({ verbose, autoApprove });
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已更新`);
      }
    }

    return resultModel.result;
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
    let prModel: PullRequestModel | undefined;
    let commits: PullRequestCommit[] = [];
    let changedFiles: ChangedFile[] = [];
    if (prNumber) {
      prModel = new PullRequestModel(this.gitProvider, owner, repo, prNumber);
      commits = await prModel.getCommits();
      changedFiles = await prModel.getFiles();
    } else if (baseRef && headRef) {
      changedFiles = await this.getChangedFilesBetweenRefs(owner, repo, baseRef, headRef);
      commits = await this.getCommitsBetweenRefs(baseRef, headRef);
    }

    // 使用 includes 过滤文件（支持 added|/modified|/deleted| 前缀语法）
    if (context.includes && context.includes.length > 0) {
      changedFiles = filterFilesByIncludes(changedFiles, context.includes);
    }

    const prDesc = context.generateDescription
      ? await this.generatePrDescription(commits, changedFiles, llmMode, undefined, verbose)
      : await this.buildBasicDescription(commits, changedFiles);
    const result: ReviewResult = {
      success: true,
      title: prDesc.title,
      description: prDesc.description,
      issues: [],
      summary: [],
      deletionImpact,
      round: 1,
    };

    const resultModel = prModel
      ? ReviewResultModel.create(prModel, result, this.resultModelDeps)
      : ReviewResultModel.createLocal(result, this.resultModelDeps);
    const reviewComment = resultModel.formatComment({
      prNumber,
      outputFormat: context.outputFormat,
      ci,
    });

    if (ci && prModel && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 提交 PR 评论...`);
      }
      await resultModel.save({ verbose, autoApprove });
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
  ): Promise<ReviewResult> {
    const { ci, prNumber, verbose, dryRun, llmMode, autoApprove } = context;

    if (shouldLog(verbose, 1)) {
      console.log("✅ 没有需要审查的文件或规则");
    }

    // 获取上一次的审查结果以计算正确的轮次
    let existingResultModel: ReviewResultModel | null = null;
    let prModel: PullRequestModel | undefined;
    if (ci && prNumber) {
      prModel = new PullRequestModel(this.gitProvider, context.owner, context.repo, prNumber);
      existingResultModel = await ReviewResultModel.loadFromPr(prModel, this.resultModelDeps);
    }
    const currentRound = (existingResultModel?.round ?? 0) + 1;

    // 即使没有适用的规则，也为每个变更文件生成摘要
    const summary: FileSummary[] = changedFiles
      .filter((f) => f.filename && f.status !== "deleted")
      .map((f) => ({
        file: f.filename!,
        resolved: 0,
        unresolved: 0,
        summary: applicableSpecs.length === 0 ? "无适用的审查规则" : "已跳过",
      }));
    const prDesc =
      context.generateDescription && llmMode
        ? await this.generatePrDescription(commits, changedFiles, llmMode, undefined, verbose)
        : await this.buildBasicDescription(commits, changedFiles);
    const result: ReviewResult = {
      success: true,
      title: prDesc.title,
      description: prDesc.description,
      issues: [],
      summary,
      round: currentRound,
    };

    // CI 模式下也需要发送 review 评论
    if (ci && prModel && !dryRun) {
      if (shouldLog(verbose, 1)) {
        console.log(`💬 提交 PR 评论...`);
      }
      const resultModel = ReviewResultModel.create(prModel, result, this.resultModelDeps);
      await resultModel.save({ verbose, autoApprove });
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 评论已提交`);
      }
    }

    return result;
  }

  /**
   * 检查是否有其他同名 review workflow 正在运行中
   * 根据 duplicateWorkflowResolved 配置决定是跳过还是删除旧评论
   */
  private async checkDuplicateWorkflow(
    prModel: PullRequestModel,
    headSha: string,
    mode: "skip" | "delete",
    verbose?: VerboseLevel,
  ): Promise<ReviewResult | null> {
    const ref = process.env.GITHUB_REF || process.env.GITEA_REF || "";
    const prMatch = ref.match(/refs\/pull\/(\d+)/);
    const currentPrNumber = prMatch ? parseInt(prMatch[1], 10) : prModel.number;

    try {
      const runningWorkflows = await prModel.listWorkflowRuns({
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
        if (mode === "delete") {
          // 删除模式：清理旧的 AI Review 评论和 PR Review
          if (shouldLog(verbose, 1)) {
            console.log(
              `🗑️ 检测到 ${duplicateReviewRuns.length} 个同名 workflow，清理旧的 AI Review 评论...`,
            );
          }
          await this.cleanupDuplicateAiReviews(prModel, verbose);
          // 清理后继续执行当前审查
          return null;
        }

        // 跳过模式（默认）
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

  /**
   * 清理重复的 AI Review 评论（Issue Comments 和 PR Reviews）
   */
  private async cleanupDuplicateAiReviews(
    prModel: PullRequestModel,
    verbose?: VerboseLevel,
  ): Promise<void> {
    try {
      // 删除 Issue Comments（主评论）
      const comments = await prModel.getComments();
      const aiComments = comments.filter((c) => c.body?.includes(REVIEW_COMMENT_MARKER));
      let deletedComments = 0;
      for (const comment of aiComments) {
        if (comment.id) {
          try {
            await prModel.deleteComment(comment.id);
            deletedComments++;
          } catch {
            // 忽略删除失败
          }
        }
      }
      if (deletedComments > 0 && shouldLog(verbose, 1)) {
        console.log(`   已删除 ${deletedComments} 个重复的 AI Review 主评论`);
      }

      // 删除 PR Reviews（行级评论）
      const reviews = await prModel.getReviews();
      const aiReviews = reviews.filter((r) => r.body?.includes(REVIEW_LINE_COMMENTS_MARKER));
      let deletedReviews = 0;
      for (const review of aiReviews) {
        if (review.id) {
          try {
            await prModel.deleteReview(review.id);
            deletedReviews++;
          } catch {
            // 已提交的 review 无法删除，忽略
          }
        }
      }
      if (deletedReviews > 0 && shouldLog(verbose, 1)) {
        console.log(`   已删除 ${deletedReviews} 个重复的 AI Review PR Review`);
      }
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn(`⚠️ 清理旧评论失败:`, error instanceof Error ? error.message : error);
      }
    }
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

  protected async runLLMReview(...args: Parameters<ReviewLlmProcessor["runLLMReview"]>) {
    return this.llmProcessor.runLLMReview(...args);
  }

  protected async buildReviewPrompt(...args: Parameters<ReviewLlmProcessor["buildReviewPrompt"]>) {
    return this.llmProcessor.buildReviewPrompt(...args);
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
