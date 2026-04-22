import {
  GitProviderService,
  PullRequestCommit,
  type LLMMode,
  LlmProxyService,
  shouldLog,
  GitSdkService,
} from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { type ReviewConfig } from "./review.config";
import {
  ReviewSpecService,
  ReviewResult,
  FileSummary,
  ReviewSpec,
  FileContentsMap,
} from "./review-spec";
import { ChangedFileCollection } from "./changed-file-collection";
import { MarkdownFormatter, ReviewReportService } from "./review-report";
import { ReviewOptions } from "./review.config";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { ReviewContextBuilder, type ReviewContext } from "./review-context";
import { ReviewIssueFilter } from "./review-issue-filter";
import { filterFilesByIncludes } from "./review-includes-filter";
import { ReviewLlmProcessor } from "./review-llm";
import { PullRequestModel } from "./pull-request-model";
import { ReviewResultModel, type ReviewResultModelDeps } from "./review-result-model";
import { ReviewSourceResolver, type SourceData } from "./review-source-resolver";
import { applyStaticRules } from "./system-rules";
import { ReviewFastModeService } from "./review-fast-mode.service";

export type { ReviewContext } from "./review-context";
export type { FileReviewPrompt, ReviewPrompt, LLMReviewOptions } from "./review-llm";
export type { SourceData } from "./review-source-resolver";

export class ReviewService {
  protected readonly contextBuilder: ReviewContextBuilder;
  protected readonly issueFilter: ReviewIssueFilter;
  protected readonly llmProcessor: ReviewLlmProcessor;
  protected readonly resultModelDeps: ReviewResultModelDeps;
  protected readonly sourceResolver: ReviewSourceResolver;
  protected readonly fastModeService: ReviewFastModeService;

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
    this.sourceResolver = new ReviewSourceResolver(gitProvider, gitSdk, this.issueFilter);
    this.fastModeService = new ReviewFastModeService();
    this.resultModelDeps = {
      gitProvider,
      config,
      reviewSpecService,
      reviewReportService,
    };
  }

  protected ensureLlmProxyAvailable(scene: string): void {
    const llmProxy = this.llmProxyService as unknown as {
      chat?: unknown;
      chatStream?: unknown;
    };
    if (typeof llmProxy?.chat !== "function" || typeof llmProxy?.chatStream !== "function") {
      throw new Error(`当前流程需要 LLM 服务（${scene}），请在 spaceflow.json 中配置 llm`);
    }
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

    // 获取上一次的审查结果（用于轮次推进、快速模式判断）
    const existingResultModel =
      context.ci && source.prModel
        ? await ReviewResultModel.loadFromPr(source.prModel, this.resultModelDeps)
        : null;
    if (existingResultModel && shouldLog(verbose, 1)) {
      console.log(`📋 获取到上一次审查结果，包含 ${existingResultModel.issues.length} 个问题`);
    }
    const currentRound = (existingResultModel?.round ?? 0) + 1;
    if (shouldLog(verbose, 1)) {
      console.log(`🔄 当前审查轮次: ${currentRound}`);
    }

    // 快速模式：首轮仅静态检查，后续轮次仅 flush
    const fastDecision = this.fastModeService.resolveDecision(
      context,
      source.changedFiles,
      currentRound,
    );
    if (fastDecision.enabled) {
      if (shouldLog(verbose, 1)) {
        const reason = fastDecision.reason ? ` (${fastDecision.reason})` : "";
        console.log(`⚡ 已启用快速模式${reason}`);
      }

      if (currentRound > 1) {
        if (shouldLog(verbose, 1)) {
          console.log(`⏭️  快速模式第 ${currentRound} 轮：仅执行 flush，同步状态后退出`);
        }
        return this.executeCollectOnly({
          ...context,
          flush: true,
          verifyFixes: false,
          collectOnlyRound: currentRound,
        });
      }

      return this.executeFastFirstRound(context, source, existingResultModel, fastDecision);
    }

    const effectiveWhenModifiedCode = source.isDirectFileMode
      ? undefined
      : context.whenModifiedCode;
    if (source.isDirectFileMode && context.whenModifiedCode?.length && shouldLog(verbose, 1)) {
      console.log(`ℹ️  直接文件模式下忽略 whenModifiedCode 过滤`);
    }

    // 2. 规则匹配
    const allSpecs = await this.issueFilter.loadSpecs(specSources, verbose);
    const specs = this.reviewSpecService.filterApplicableSpecs(allSpecs, source.changedFiles);
    if (shouldLog(verbose, 2)) {
      console.log(
        `[execute] loadSpecs: loaded ${specs.length} specs from sources: ${JSON.stringify(specSources)}`,
      );
      console.log(
        `[execute] filterApplicableSpecs: ${specs.length} applicable out of ${allSpecs.length}, changedFiles=${JSON.stringify(source.changedFiles.filenames())}`,
      );
    }
    if (shouldLog(verbose, 1)) {
      console.log(`   适用的规则文件: ${specs.length}`);
    }
    if (specs.length === 0 || source.changedFiles.length === 0) {
      return this.handleNoApplicableSpecs(context, specs, source.changedFiles, source.commits);
    }

    // 3. LLM 审查
    const { fileContents } = source;
    if (!llmMode) throw new Error("必须指定 LLM 类型");

    const reviewPrompt = await this.llmProcessor.buildReviewPrompt(
      specs,
      source.changedFiles,
      fileContents,
      source.commits,
      existingResultModel?.result ?? null,
      effectiveWhenModifiedCode,
      verbose,
      context.systemRules,
    );
    // 4. 运行 LLM 审查 + 过滤新 issues
    const result = await this.buildReviewResult(context, reviewPrompt, llmMode, {
      specs,
      fileContents,
      changedFiles: source.changedFiles,
      commits: source.commits,
      isDirectFileMode: source.isDirectFileMode,
    });

    // 5. 构建最终的 ReviewResultModel
    const finalModel = await this.buildFinalModel(
      context,
      result,
      {
        prModel: source.prModel,
        commits: source.commits,
        headSha: source.headSha,
        specs,
        fileContents,
      },
      existingResultModel,
    );

    // 6. 保存 + 输出
    await this.saveAndOutput(context, finalModel, source.commits);
    return finalModel.result;
  }

  /**
   * 运行 LLM 审查并构建过滤后的 ReviewResult：
   * - 调用 LLM 生成问题列表
   * - 填充 PR 标题/描述
   * - 过滤新 issues（去重、commit 范围等）
   * - 合并静态规则问题
   */
  protected async buildReviewResult(
    context: ReviewContext,
    reviewPrompt: Awaited<ReturnType<typeof this.llmProcessor.buildReviewPrompt>>,
    llmMode: LLMMode,
    source: {
      specs: ReviewSpec[];
      fileContents: FileContentsMap;
      changedFiles: ChangedFileCollection;
      commits: PullRequestCommit[];
      isDirectFileMode: boolean;
    },
  ): Promise<ReviewResult> {
    const { verbose } = context;
    const { specs, fileContents, changedFiles, commits, isDirectFileMode } = source;
    this.ensureLlmProxyAvailable("LLM 审查");

    const result = await this.llmProcessor.runLLMReview(llmMode, reviewPrompt, {
      verbose,
      concurrency: context.concurrency,
      timeout: context.timeout,
      retries: context.retries,
      retryDelay: context.retryDelay,
      model: context.llmModel,
    });

    // 填充 PR 功能描述和标题
    const prInfo = context.generateDescription
      ? await this.llmProcessor.generatePrDescription(
          commits,
          changedFiles,
          llmMode,
          fileContents,
          verbose,
        )
      : await this.llmProcessor.buildBasicDescription(commits, changedFiles);
    result.title = prInfo.title;
    result.description = prInfo.description;
    if (shouldLog(verbose, 1)) {
      console.log(`📝 LLM 审查完成，发现 ${result.issues.length} 个问题`);
    }

    result.issues = await this.issueFilter.fillIssueCode(result.issues, fileContents);
    result.issues = this.filterNewIssues(result.issues, specs, {
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

    return result;
  }

  /**
   * 解析输入数据：委托给 ReviewSourceResolver。
   * @see ReviewSourceResolver#resolve
   */
  protected async resolveSourceData(context: ReviewContext): Promise<SourceData> {
    return this.sourceResolver.resolve(context);
  }

  /**
   * 快速模式首轮：仅执行静态规则，不调用 LLM。
   */
  protected async executeFastFirstRound(
    context: ReviewContext,
    source: SourceData,
    existingResultModel: ReviewResultModel | null,
    decision: ReturnType<ReviewFastModeService["resolveDecision"]>,
  ): Promise<ReviewResult> {
    const { staticIssues } = applyStaticRules(
      source.changedFiles.toArray(),
      source.fileContents,
      context.systemRules,
      1,
      context.verbose,
    );

    const title = this.fastModeService.buildTitle(source.commits);
    const description = this.fastModeService.buildDescription(
      source.commits,
      source.changedFiles,
      decision.descriptionMode,
    );
    const summary: FileSummary[] = source.changedFiles.nonDeletedFiles().map((file) => {
      const filename = file.filename ?? "";
      const unresolved = staticIssues.filter((issue) => issue.file === filename).length;
      return {
        file: filename,
        resolved: 0,
        unresolved,
        summary: unresolved > 0 ? "命中静态规则" : "快速模式静态检查通过",
      };
    });

    if (shouldLog(context.verbose, 1)) {
      console.log(`⚙️  快速模式首轮静态检查完成，发现 ${staticIssues.length} 个系统问题`);
    }

    const result: ReviewResult = {
      success: true,
      title,
      description,
      issues: staticIssues,
      summary,
      round: 1,
    };

    const finalModel = await this.buildFinalModel(
      context,
      result,
      {
        prModel: source.prModel,
        commits: source.commits,
        headSha: source.headSha,
        specs: [],
        fileContents: source.fileContents,
      },
      existingResultModel,
    );
    await this.saveAndOutput(context, finalModel, source.commits);
    return finalModel.result;
  }

  /**
   * LLM 审查后的 issue 过滤管道：
   * includes → 规则存在性 → overrides → 变更行过滤 → 格式化
   */
  protected filterNewIssues(
    issues: ReviewResult["issues"],
    specs: any[],
    opts: {
      commits: PullRequestCommit[];
      fileContents: any;
      changedFiles: ChangedFileCollection;
      isDirectFileMode: boolean;
      context: ReviewContext;
    },
  ): ReviewResult["issues"] {
    const { commits, fileContents, changedFiles, isDirectFileMode, context } = opts;
    const { verbose } = context;

    let filtered = this.reviewSpecService.filterIssuesByIncludes(issues, specs, changedFiles);
    if (shouldLog(verbose, 1)) {
      console.log(`   应用 includes 过滤后: ${filtered.length} 个问题`);
    }

    filtered = this.reviewSpecService.filterIssuesByRuleExistence(filtered, specs);
    if (shouldLog(verbose, 1)) {
      console.log(`   应用规则存在性过滤后: ${filtered.length} 个问题`);
    }

    filtered = this.reviewSpecService.filterIssuesByOverrides(
      filtered,
      specs,
      changedFiles,
      verbose,
    );

    // 变更行过滤
    if (shouldLog(verbose, 3)) {
      console.log(`   🔍 变更行过滤条件检查:`);
      console.log(
        `      showAll=${context.showAll}, isDirectFileMode=${isDirectFileMode}, commits.length=${commits.length}`,
      );
    }
    if (!context.showAll && !isDirectFileMode) {
      if (shouldLog(verbose, 2)) {
        console.log(`   🔍 开始变更行过滤，当前 ${filtered.length} 个问题`);
      }
      filtered = this.issueFilter.filterIssuesByValidCommits(
        filtered,
        commits,
        fileContents,
        verbose,
      );
      if (shouldLog(verbose, 2)) {
        console.log(`   🔍 变更行过滤完成，剩余 ${filtered.length} 个问题`);
      }
    } else if (shouldLog(verbose, 1)) {
      console.log(`   跳过变更行过滤 (${context.showAll ? "showAll=true" : "直接审查文件模式"})`);
    }

    filtered = this.reviewSpecService.formatIssues(filtered, {
      specs,
      changedFiles: changedFiles.toArray(),
    });
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
    result.headSha = headSha;

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
        await existingResultModel.invalidateChangedFiles(headSha, fileContents, verbose);
      }

      // 验证历史问题是否已修复
      if (context.verifyFixes) {
        this.ensureLlmProxyAvailable("历史问题修复验证");
        existingResultModel.issues = await this.issueFilter.verifyAndUpdateIssues(
          context,
          existingResultModel.issues,
          commits,
          { specs, fileContents },
        );
      } else {
        if (shouldLog(verbose, 1)) {
          console.log(`   ⏭️  跳过历史问题验证 (verifyFixes=false)`);
        }
      }

      // 自动 round 递增 + 去重 + issues 合并
      return existingResultModel.nextRound(result);
    }

    // 首次审查或无历史结果
    result.round = 1;
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
      finalModel.issues = await this.contextBuilder.fillIssueAuthors(
        finalModel.issues,
        commits,
        owner,
        repo,
        verbose,
      );
    }

    // 删除代码影响分析（在 save 之前完成，避免多次 save 产生重复的 Round 评论）
    if (context.analyzeDeletions && llmMode) {
      this.ensureLlmProxyAvailable("删除代码影响分析");
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
    const { owner, repo, prNumber, verbose, ci, dryRun, autoApprove, collectOnlyRound } = context;

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
    const allCommits = await prModel.getCommits();
    const commits = context.showAll
      ? allCommits
      : allCommits.filter((c) => !/^merge\b/i.test(c.commit?.message || ""));
    if (allCommits.length !== commits.length && shouldLog(verbose, 1)) {
      console.log(`   跳过 Merge Commits: ${allCommits.length} -> ${commits.length} 个`);
    }
    resultModel.issues = await this.contextBuilder.fillIssueAuthors(
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
    if (context.verifyFixes && context.specSources?.length) {
      try {
        this.ensureLlmProxyAvailable("flush/closed 模式的历史问题修复验证");
        const changedFiles = await prModel.getFiles();
        const headSha = await prModel.getHeadSha();
        const verifySpecs = await this.issueFilter.loadSpecs(context.specSources, verbose);
        const verifyFileContents = await this.sourceResolver.getFileContents(
          owner,
          repo,
          changedFiles,
          commits,
          headSha,
          prNumber,
          false,
          context.showAll,
          verbose,
        );
        resultModel.issues = await this.issueFilter.verifyAndUpdateIssues(
          context,
          resultModel.issues,
          commits,
          { specs: verifySpecs, fileContents: verifyFileContents },
        );
      } catch (error) {
        console.warn("⚠️ LLM 验证修复状态失败，跳过:", error);
      }
    } else if (!context.verifyFixes && shouldLog(verbose, 1)) {
      console.log(`   ⏭️  跳过历史问题验证 (verifyFixes=false)`);
    }

    // 快速模式后续轮次回退到 collect-only 时，显式推进 round
    if (typeof collectOnlyRound === "number" && collectOnlyRound > resultModel.round) {
      if (shouldLog(verbose, 1)) {
        console.log(`🔄 collect-only 轮次推进: ${resultModel.round} -> ${collectOnlyRound}`);
      }
      resultModel.update({ round: collectOnlyRound });
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
    this.ensureLlmProxyAvailable("删除代码分析模式");

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
    let changedFiles: ChangedFileCollection = ChangedFileCollection.empty();
    if (prNumber) {
      prModel = new PullRequestModel(this.gitProvider, owner, repo, prNumber);
      commits = await prModel.getCommits();
      changedFiles = ChangedFileCollection.from(await prModel.getFiles());
    } else if (baseRef && headRef) {
      changedFiles = ChangedFileCollection.from(
        await this.issueFilter.getChangedFilesBetweenRefs(owner, repo, baseRef, headRef),
      );
      commits = await this.issueFilter.getCommitsBetweenRefs(baseRef, headRef);
    }

    // 使用 includes 过滤文件（支持 added|/modified|/deleted| 前缀语法）
    if (context.includes && context.includes.length > 0) {
      changedFiles = ChangedFileCollection.from(
        filterFilesByIncludes(changedFiles.toArray(), context.includes),
      );
    }

    const prDesc = context.generateDescription
      ? await this.llmProcessor.generatePrDescription(
          commits,
          changedFiles,
          llmMode,
          undefined,
          verbose,
        )
      : await this.llmProcessor.buildBasicDescription(commits, changedFiles);
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
    changedFiles: ChangedFileCollection,
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
    const summary: FileSummary[] = changedFiles.nonDeletedFiles().map((f) => ({
      file: f.filename!,
      resolved: 0,
      unresolved: 0,
      summary: applicableSpecs.length === 0 ? "无适用的审查规则" : "已跳过",
    }));
    const prDesc =
      context.generateDescription && llmMode
        ? await this.llmProcessor.generatePrDescription(
            commits,
            changedFiles,
            llmMode,
            undefined,
            verbose,
          )
        : await this.llmProcessor.buildBasicDescription(commits, changedFiles);
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
}
