import { GitProviderService, shouldLog, normalizeVerbose } from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import type { PullRequest, Issue, CiConfig } from "@spaceflow/core";
import { MarkdownFormatter, type ReviewResult } from "@spaceflow/review";
import micromatch from "micromatch";
import { writeFileSync } from "fs";
import { join } from "path";
import type {
  PeriodSummaryOptions,
  PeriodSummaryContext,
  PeriodSummaryResult,
  PrStats,
  UserStats,
  OutputTarget,
  TimePreset,
  WeightedScoreWeights,
  CommitBasedWeights,
  IssueBasedWeights,
  DefectRateWeights,
  ReviewSummaryConfig,
  ScoreStrategy,
} from "./types";

/** 加权模式默认权重 */
const DEFAULT_WEIGHTED_WEIGHTS: Required<WeightedScoreWeights> = {
  prBase: 10,
  additionsPer100: 2,
  deletionsPer100: 1,
  changedFile: 0.5,
  issueDeduction: 3,
  fixedBonus: 1,
};

/** 分数累计模式默认权重 */
const DEFAULT_COMMIT_BASED_WEIGHTS: Required<CommitBasedWeights> = {
  validCommit: 5,
  errorDeduction: 2,
  warnDeduction: 1,
  errorFixedBonus: 1,
  warnFixedBonus: 0.5,
  minCommitLines: 5,
};

/** issue-based 模式默认权重 */
const DEFAULT_ISSUE_BASED_WEIGHTS: Required<IssueBasedWeights> = {
  minBase: 60,
  maxBase: 100,
  capLines: 1000,
  errorDeduction: 8,
  warnDeduction: 3,
  errorFixedBonus: 5,
  warnFixedBonus: 2,
};

/** defect-rate 模式默认权重 */
const DEFAULT_DEFECT_RATE_WEIGHTS: Required<DefectRateWeights> = {
  errorPenalty: 0.3,
  warnPenalty: 0.1,
  fixedDiscount: 0.05,
};

/**
 * 周期统计服务
 */
export class PeriodSummaryService {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
  ) {}

  /**
   * 从配置和选项获取执行上下文
   */
  getContextFromOptions(options: PeriodSummaryOptions): PeriodSummaryContext {
    let owner: string;
    let repo: string;
    if (options.repository) {
      const parts = options.repository.split("/");
      if (parts.length !== 2) {
        throw new Error(`仓库格式不正确，期望 "owner/repo"，实际: "${options.repository}"`);
      }
      owner = parts[0];
      repo = parts[1];
    } else {
      const ciConf = this.config.get<CiConfig>("ci");
      const repository = ciConf?.repository;
      if (!repository) {
        throw new Error(
          "缺少仓库配置，请通过 --repository 参数或环境变量 GITHUB_REPOSITORY / GITEA_REPOSITORY 指定",
        );
      }
      const parts = repository.split("/");
      owner = parts[0];
      repo = parts[1];
    }
    if (options.ci) {
      this.gitProvider.validateConfig();
    }
    const { since, until } = this.resolveDateRange(options);
    if (since > until) {
      throw new Error("开始日期不能晚于结束日期");
    }
    const output: OutputTarget = options.output ?? "console";
    if (output === "issue" && !options.ci) {
      this.gitProvider.validateConfig();
    }
    return {
      owner,
      repo,
      since,
      until,
      format: options.format ?? (output === "console" ? "table" : "markdown"),
      output,
      outputFile: options.outputFile,
      verbose: normalizeVerbose(options.verbose),
    };
  }

  /**
   * 执行周期统计
   */
  async execute(context: PeriodSummaryContext): Promise<PeriodSummaryResult> {
    const { owner, repo, since, until, verbose } = context;
    if (shouldLog(verbose, 1)) {
      console.log(`📊 开始统计 ${owner}/${repo} 的 PR 数据...`);
      console.log(`📅 时间范围: ${this.formatDate(since)} ~ ${this.formatDate(until)}`);
    }
    const allPrs = await this.gitProvider.listAllPullRequests(owner, repo, { state: "closed" });
    const mergedPrs = allPrs.filter((pr) => {
      if (!pr.merged_at) return false;
      const mergedAt = new Date(pr.merged_at);
      return mergedAt >= since && mergedAt <= until;
    });
    if (shouldLog(verbose, 1)) {
      console.log(`📝 找到 ${mergedPrs.length} 个已合并的 PR`);
    }
    const prStatsList: PrStats[] = [];
    for (const pr of mergedPrs) {
      if (shouldLog(verbose, 1)) {
        console.log(`   处理 PR #${pr.number}: ${pr.title}`);
      }
      const stats = await this.collectPrStats(owner, repo, pr);
      prStatsList.push(stats);
    }
    const userStatsMap = this.aggregateByUser(prStatsList);
    const sortedUserStats = this.sortUserStats(userStatsMap);
    return {
      period: {
        since: this.formatDate(since),
        until: this.formatDate(until),
      },
      repository: `${owner}/${repo}`,
      totalPrs: mergedPrs.length,
      userStats: sortedUserStats,
    };
  }

  /**
   * 收集单个 PR 的统计数据
   */
  protected async collectPrStats(owner: string, repo: string, pr: PullRequest): Promise<PrStats> {
    let additions = 0;
    let deletions = 0;
    let changedFiles = 0;
    const includes = this.resolveIncludes();
    try {
      const allFiles = await this.gitProvider.getPullRequestFiles(owner, repo, pr.number!);
      const files =
        includes.length > 0
          ? allFiles.filter((f) =>
              micromatch.isMatch(f.filename ?? "", includes, { matchBase: true }),
            )
          : allFiles;
      changedFiles = files.length;
      for (const file of files) {
        additions += file.additions ?? 0;
        deletions += file.deletions ?? 0;
      }
    } catch {
      // 如果获取文件失败，使用默认值
    }
    const issueStats = await this.extractIssueStats(owner, repo, pr.number!);
    const validCommitCount = await this.countValidCommits(owner, repo, pr.number!);
    return {
      number: pr.number!,
      title: pr.title ?? "",
      author: pr.user?.login ?? "unknown",
      mergedAt: pr.merged_at ?? "",
      additions,
      deletions,
      changedFiles,
      ...issueStats,
      validCommitCount,
      description: this.extractDescription(pr),
    };
  }

  /**
   * 从 PR 评论中提取问题统计
   */
  protected async extractIssueStats(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<{
    issueCount: number;
    fixedCount: number;
    errorCount: number;
    warnCount: number;
    fixedErrors: number;
    fixedWarns: number;
  }> {
    const empty = {
      issueCount: 0,
      fixedCount: 0,
      errorCount: 0,
      warnCount: 0,
      fixedErrors: 0,
      fixedWarns: 0,
    };
    try {
      const comments = await this.gitProvider.listIssueComments(owner, repo, prNumber);
      // 优先从 review 模块嵌入的结构化数据中精确提取
      const formatter = new MarkdownFormatter();
      for (const comment of comments) {
        const body = comment.body ?? "";
        const parsed = formatter.parse(body);
        if (parsed?.result?.issues) {
          return this.computeIssueStatsFromReviewResult(parsed.result);
        }
      }
      // 回退：没有结构化数据时，从评论文本正则提取（兼容旧数据）
      return this.extractIssueStatsFromText(comments);
    } catch {
      return empty;
    }
  }

  /**
   * 从 ReviewResult 中精确计算各类问题统计
   * - 口径与 review 插件 `calculateIssueStats` 保持一致：
   *   1) 仅统计有效问题（valid !== "false"）
   *   2) 已关闭 = fixed 或 resolved 的问题数（对齐 pending = validTotal - closed）
   *   3) 若 ReviewResult 携带 stats 聚合值，则 issueCount 直接取 stats.validTotal
   */
  protected computeIssueStatsFromReviewResult(result: ReviewResult): {
    issueCount: number;
    fixedCount: number;
    errorCount: number;
    warnCount: number;
    fixedErrors: number;
    fixedWarns: number;
  } {
    const validIssues = result.issues.filter((i) => i.valid !== "false");
    const stats = result.stats;
    const issueCount = stats?.validTotal ?? validIssues.length;
    // 已关闭口径：fixed 或 resolved；stats 存在时用 validTotal - pending 避免双重计数
    const fixedCount = stats
      ? Math.max(0, stats.validTotal - stats.pending)
      : validIssues.filter((i) => i.fixed || i.resolved).length;
    const errorCount = validIssues.filter((i) => i.severity === "error").length;
    const warnCount = validIssues.filter((i) => i.severity === "warn").length;
    const fixedErrors = validIssues.filter(
      (i) => i.severity === "error" && (i.fixed || i.resolved),
    ).length;
    const fixedWarns = validIssues.filter(
      (i) => i.severity === "warn" && (i.fixed || i.resolved),
    ).length;
    return {
      issueCount,
      fixedCount,
      errorCount,
      warnCount,
      fixedErrors,
      fixedWarns,
    };
  }

  /**
   * 回退：从评论文本正则提取问题统计（兼容无结构化数据的旧评论）
   * - 优先匹配新版文案：`| 有效问题 | N (🟢已验收 X, ⚪已解决 Y, ⚠️待处理 Z) |`
   * - 退而匹配更老版本文案：`发现 N 个问题` / `🟢已修复 X` / `🔴a...🟡b`
   */
  protected extractIssueStatsFromText(comments: { body?: string }[]): {
    issueCount: number;
    fixedCount: number;
    errorCount: number;
    warnCount: number;
    fixedErrors: number;
    fixedWarns: number;
  } {
    let issueCount = 0;
    let fixedCount = 0;
    let errorCount = 0;
    let warnCount = 0;
    for (const comment of comments) {
      const body = comment.body ?? "";
      // 新版：有效问题汇总行
      const validTotalMatch = body.match(/有效问题\s*\|\s*(\d+)/);
      if (validTotalMatch) {
        issueCount = Math.max(issueCount, parseInt(validTotalMatch[1], 10));
      }
      // 新版（"已验收"）/ 过渡版（"已修复"）两种文案都匹配
      const fixedNewMatch = body.match(/🟢已(?:验收|修复)\s*(\d+)/);
      const resolvedNewMatch = body.match(/⚪已解决\s*(\d+)/);
      if (fixedNewMatch || resolvedNewMatch) {
        const fixed = fixedNewMatch ? parseInt(fixedNewMatch[1], 10) : 0;
        const resolved = resolvedNewMatch ? parseInt(resolvedNewMatch[1], 10) : 0;
        // 文本口径无法区分 fixed 与 resolved 是否作用于同一问题，近似相加
        fixedCount = Math.max(fixedCount, fixed + resolved);
      }
      // 老版本兼容
      const issueMatch = body.match(/发现\s*(\d+)\s*个问题/);
      if (issueMatch) {
        issueCount = Math.max(issueCount, parseInt(issueMatch[1], 10));
      }
      const oldFixedMatch = body.match(/已验收[：:]\s*(\d+)/);
      if (oldFixedMatch) {
        fixedCount = Math.max(fixedCount, parseInt(oldFixedMatch[1], 10));
      }
      const statsMatch = body.match(/🔴\s*(\d+).*🟡\s*(\d+)/);
      if (statsMatch) {
        errorCount = Math.max(errorCount, parseInt(statsMatch[1], 10));
        warnCount = Math.max(warnCount, parseInt(statsMatch[2], 10));
        issueCount = Math.max(issueCount, errorCount + warnCount);
      }
    }
    // 文本模式无法区分修复类型（error/warn），统一设为 0
    return { issueCount, fixedCount, errorCount, warnCount, fixedErrors: 0, fixedWarns: 0 };
  }

  /**
   * 统计 PR 中有效 commit 数量（逐 commit 获取行数判断）
   */
  protected async countValidCommits(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<number> {
    const config = this.getStrategyConfig();
    const minLines =
      config.commitBasedWeights?.minCommitLines ?? DEFAULT_COMMIT_BASED_WEIGHTS.minCommitLines;
    try {
      const commits = await this.gitProvider.getPullRequestCommits(owner, repo, prNumber);
      let validCount = 0;
      for (const commit of commits) {
        if (!commit.sha) continue;
        // 跳过 merge commit（commit message 以 "Merge" 开头）
        if (commit.commit?.message?.startsWith("Merge")) continue;
        try {
          const commitInfo = await this.gitProvider.getCommit(owner, repo, commit.sha);
          const totalLines = (commitInfo.files ?? []).reduce(
            (sum, file) => sum + (file.additions ?? 0) + (file.deletions ?? 0),
            0,
          );
          if (totalLines >= minLines) {
            validCount++;
          }
        } catch {
          // 获取单个 commit 失败，跳过
        }
      }
      return validCount;
    } catch {
      return 0;
    }
  }

  /**
   * 从 PR 提取功能描述
   */
  protected extractDescription(pr: PullRequest): string {
    if (pr.title) {
      return pr.title.replace(/^\[.*?\]\s*/, "").trim();
    }
    return "";
  }

  /**
   * 按用户聚合统计数据
   */
  protected aggregateByUser(prStatsList: PrStats[]): Map<string, UserStats> {
    const userMap = new Map<string, UserStats>();
    for (const pr of prStatsList) {
      let userStats = userMap.get(pr.author);
      if (!userStats) {
        userStats = {
          username: pr.author,
          prCount: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          totalChangedFiles: 0,
          totalIssues: 0,
          totalFixed: 0,
          totalErrors: 0,
          totalWarns: 0,
          totalFixedErrors: 0,
          totalFixedWarns: 0,
          totalValidCommits: 0,
          score: 0,
          features: [],
          prs: [],
        };
        userMap.set(pr.author, userStats);
      }
      userStats.prCount++;
      userStats.totalAdditions += pr.additions;
      userStats.totalDeletions += pr.deletions;
      userStats.totalChangedFiles += pr.changedFiles;
      userStats.totalIssues += pr.issueCount;
      userStats.totalFixed += pr.fixedCount;
      userStats.totalErrors += pr.errorCount;
      userStats.totalWarns += pr.warnCount;
      userStats.totalFixedErrors += pr.fixedErrors;
      userStats.totalFixedWarns += pr.fixedWarns;
      userStats.totalValidCommits += pr.validCommitCount;
      if (pr.description) {
        userStats.features.push(pr.description);
      }
      userStats.prs.push(pr);
    }
    this.applyScoreStrategy(userMap);
    return userMap;
  }

  /**
   * 解析文件过滤 glob 模式：优先使用 review-summary.includes，fallback 到 review.includes
   */
  protected resolveIncludes(): string[] {
    const config = this.getStrategyConfig();
    if (config.includes && config.includes.length > 0) {
      return config.includes;
    }
    try {
      const reviewConfig = this.config.get<{ includes?: string[] }>("review");
      return reviewConfig?.includes ?? [];
    } catch {
      return [];
    }
  }

  /**
   * 获取当前评分策略配置
   */
  protected getStrategyConfig(): ReviewSummaryConfig {
    try {
      return this.config.get<ReviewSummaryConfig>("review-summary") ?? {};
    } catch {
      return {};
    }
  }

  /**
   * 根据配置的策略计算所有用户的分数
   */
  protected applyScoreStrategy(userMap: Map<string, UserStats>): void {
    const config = this.getStrategyConfig();
    const strategy: ScoreStrategy = config.strategy ?? "weighted";
    for (const userStats of userMap.values()) {
      switch (strategy) {
        case "defect-rate": {
          const rate = this.calculateDefectRate(userStats, config);
          userStats.defectRate = rate;
          userStats.score = Math.round((100 - rate) * 10) / 10;
          break;
        }
        case "issue-based":
          userStats.score = this.calculateIssueBasedScore(userStats, config);
          break;
        case "commit-based":
          userStats.score = this.calculateCommitBasedScore(userStats, config);
          break;
        case "weighted":
        default:
          userStats.score = this.calculateWeightedScore(userStats, config);
          break;
      }
    }
  }

  /**
   * 加权模式：计算用户综合分数
   */
  protected calculateWeightedScore(stats: UserStats, config: ReviewSummaryConfig): number {
    const weights = { ...DEFAULT_WEIGHTED_WEIGHTS, ...config.scoreWeights };
    const prScore = stats.prCount * weights.prBase;
    const additionsScore = (stats.totalAdditions / 100) * weights.additionsPer100;
    const deletionsScore = (stats.totalDeletions / 100) * weights.deletionsPer100;
    const filesScore = stats.totalChangedFiles * weights.changedFile;
    const unfixedIssues = stats.totalIssues - stats.totalFixed;
    const issueDeduction = unfixedIssues * weights.issueDeduction;
    const fixedBonus = stats.totalFixed * weights.fixedBonus;
    const totalScore =
      prScore + additionsScore + deletionsScore + filesScore - issueDeduction + fixedBonus;
    return Math.max(0, Math.round(totalScore * 10) / 10);
  }

  /**
   * issue-based 模式：逐 PR 计算基础分(对数缩放) + 问题扣分/修复加分
   */
  protected calculateIssueBasedScore(stats: UserStats, config: ReviewSummaryConfig): number {
    const weights = { ...DEFAULT_ISSUE_BASED_WEIGHTS, ...config.issueBasedWeights };
    let totalScore = 0;
    for (const pr of stats.prs) {
      const baseScore = this.calculatePrBaseScore(
        pr.additions + pr.deletions,
        weights.minBase,
        weights.maxBase,
        weights.capLines,
      );
      const deduction =
        pr.errorCount * weights.errorDeduction + pr.warnCount * weights.warnDeduction;
      const bonus =
        pr.fixedErrors * weights.errorFixedBonus + pr.fixedWarns * weights.warnFixedBonus;
      totalScore += Math.max(0, baseScore - deduction + bonus);
    }
    return Math.round(totalScore * 10) / 10;
  }

  /**
   * 计算单个 PR 的基础分（对数缩放，映射到 [minBase, maxBase] 区间）
   */
  protected calculatePrBaseScore(
    totalLines: number,
    minBase: number,
    maxBase: number,
    capLines: number,
  ): number {
    if (totalLines <= 0) return minBase;
    const ratio = Math.min(1, Math.log2(1 + totalLines) / Math.log2(1 + capLines));
    return minBase + (maxBase - minBase) * ratio;
  }

  /**
   * defect-rate 模式：基于问题密度（每百行代码）计算缺陷率
   */
  protected calculateDefectRate(stats: UserStats, config: ReviewSummaryConfig): number {
    const weights = { ...DEFAULT_DEFECT_RATE_WEIGHTS, ...config.defectRateWeights };
    if (stats.prs.length === 0) return 0;
    let complianceSum = 0;
    let counted = 0;
    for (const pr of stats.prs) {
      // 跳过 merge PR（标题以 "Merge" 开头），合并操作不纳入缺陷率统计
      if (pr.title.startsWith("Merge")) continue;
      const totalLines = pr.additions + pr.deletions;
      const per100 = Math.max(1, totalLines / 100);
      const penalty =
        (pr.errorCount * weights.errorPenalty + pr.warnCount * weights.warnPenalty) / per100;
      const recovery = (pr.fixedErrors + pr.fixedWarns) * weights.fixedDiscount;
      const compliance = Math.min(1, Math.max(0, 1 - penalty + recovery));
      complianceSum += compliance;
      counted++;
    }
    if (counted === 0) return 0;
    const avgCompliance = complianceSum / counted;
    return Math.round((1 - avgCompliance) * 1000) / 10;
  }

  /**
   * 分数累计模式：按有效 commit 加分，按 error/warn 扣分
   */
  protected calculateCommitBasedScore(stats: UserStats, config: ReviewSummaryConfig): number {
    const weights = { ...DEFAULT_COMMIT_BASED_WEIGHTS, ...config.commitBasedWeights };
    const commitScore = stats.totalValidCommits * weights.validCommit;
    const errorDeduction = stats.totalErrors * weights.errorDeduction;
    const warnDeduction = stats.totalWarns * weights.warnDeduction;
    const fixedBonus =
      stats.totalFixedErrors * weights.errorFixedBonus +
      stats.totalFixedWarns * weights.warnFixedBonus;
    const totalScore = commitScore - errorDeduction - warnDeduction + fixedBonus;
    return Math.max(0, Math.round(totalScore * 10) / 10);
  }

  /**
   * 按分数排序用户统计
   */
  protected sortUserStats(userMap: Map<string, UserStats>): UserStats[] {
    const config = this.getStrategyConfig();
    if (config.strategy === "defect-rate") {
      return Array.from(userMap.values()).sort((a, b) => (a.defectRate ?? 0) - (b.defectRate ?? 0));
    }
    return Array.from(userMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * 解析日期字符串
   */
  protected parseDate(dateStr: string, fieldName: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`${fieldName}格式不正确: "${dateStr}"，请使用 YYYY-MM-DD 格式`);
    }
    return date;
  }

  /**
   * 根据预设或手动输入解析日期范围
   */
  protected resolveDateRange(options: PeriodSummaryOptions): { since: Date; until: Date } {
    if (options.preset) {
      return this.resolvePresetDateRange(options.preset);
    }
    if (!options.since) {
      throw new Error("请指定 --since 参数或使用 --preset 预设时间范围");
    }
    const since = this.parseDate(options.since, "开始日期");
    const until = options.until ? this.parseDate(options.until, "结束日期") : new Date();
    until.setHours(23, 59, 59, 999);
    return { since, until };
  }

  /**
   * 根据预设解析日期范围
   */
  protected resolvePresetDateRange(preset: TimePreset): { since: Date; until: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let since: Date;
    let until: Date;
    switch (preset) {
      case "this-week": {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        since = new Date(today);
        since.setDate(today.getDate() + mondayOffset);
        until = new Date(today);
        until.setHours(23, 59, 59, 999);
        break;
      }
      case "last-week": {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        until = new Date(today);
        until.setDate(today.getDate() + mondayOffset - 1);
        until.setHours(23, 59, 59, 999);
        since = new Date(until);
        since.setDate(until.getDate() - 6);
        since.setHours(0, 0, 0, 0);
        break;
      }
      case "this-month": {
        since = new Date(today.getFullYear(), today.getMonth(), 1);
        until = new Date(today);
        until.setHours(23, 59, 59, 999);
        break;
      }
      case "last-month": {
        since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        until = new Date(today.getFullYear(), today.getMonth(), 0);
        until.setHours(23, 59, 59, 999);
        break;
      }
      case "last-7-days": {
        since = new Date(today);
        since.setDate(today.getDate() - 6);
        until = new Date(today);
        until.setHours(23, 59, 59, 999);
        break;
      }
      case "last-15-days": {
        since = new Date(today);
        since.setDate(today.getDate() - 14);
        until = new Date(today);
        until.setHours(23, 59, 59, 999);
        break;
      }
      case "last-30-days": {
        since = new Date(today);
        since.setDate(today.getDate() - 29);
        until = new Date(today);
        until.setHours(23, 59, 59, 999);
        break;
      }
      default:
        throw new Error(`未知的时间预设: ${preset}`);
    }
    return { since, until };
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * 格式化输出结果
   */
  formatOutput(result: PeriodSummaryResult, format: "table" | "json" | "markdown"): string {
    switch (format) {
      case "json":
        return JSON.stringify(result, null, 2);
      case "markdown":
        return this.formatMarkdown(result);
      case "table":
      default:
        return this.formatTable(result);
    }
  }

  /**
   * 格式化为表格输出
   */
  protected formatTable(result: PeriodSummaryResult): string {
    const lines: string[] = [];
    lines.push("");
    lines.push(`📊 周期统计报告`);
    lines.push(`${"─".repeat(60)}`);
    lines.push(`📦 仓库: ${result.repository}`);
    lines.push(`📅 周期: ${result.period.since} ~ ${result.period.until}`);
    lines.push(`📝 合并 PR 数: ${result.totalPrs}`);
    lines.push("");
    lines.push(`🏆 贡献者排名`);
    lines.push(`${"─".repeat(60)}`);
    const isDefectRate = result.userStats.some((u) => u.defectRate !== undefined);
    const header = isDefectRate
      ? [
          "排名".padEnd(4),
          "用户".padEnd(15),
          "PR数".padStart(5),
          "新增".padStart(8),
          "删除".padStart(8),
          "问题".padStart(5),
          "缺陷率".padStart(8),
        ].join(" │ ")
      : [
          "排名".padEnd(4),
          "用户".padEnd(15),
          "PR数".padStart(5),
          "新增".padStart(8),
          "删除".padStart(8),
          "问题".padStart(5),
          "分数".padStart(8),
        ].join(" │ ");
    lines.push(header);
    lines.push("─".repeat(60));
    result.userStats.forEach((user, index) => {
      const lastCol = isDefectRate
        ? `${(user.defectRate ?? 0).toFixed(1)}%`.padStart(8)
        : user.score.toFixed(1).padStart(8);
      const row = [
        `#${index + 1}`.padEnd(4),
        user.username.slice(0, 15).padEnd(15),
        String(user.prCount).padStart(5),
        `+${user.totalAdditions}`.padStart(8),
        `-${user.totalDeletions}`.padStart(8),
        String(user.totalIssues).padStart(5),
        lastCol,
      ].join(" │ ");
      lines.push(row);
    });
    lines.push("─".repeat(60));
    lines.push("");
    lines.push(`📋 功能摘要`);
    lines.push(`${"─".repeat(60)}`);
    for (const user of result.userStats) {
      if (user.features.length > 0) {
        lines.push(`\n👤 ${user.username}:`);
        for (const feature of user.features) {
          lines.push(`   • ${feature}`);
        }
      }
    }
    lines.push("");
    return lines.join("\n");
  }

  /**
   * 格式化为 Markdown 输出
   */
  protected formatMarkdown(result: PeriodSummaryResult): string {
    const lines: string[] = [];
    lines.push(`# 📊 周期统计报告`);
    lines.push("");
    lines.push(`- **仓库**: ${result.repository}`);
    lines.push(`- **周期**: ${result.period.since} ~ ${result.period.until}`);
    lines.push(`- **合并 PR 数**: ${result.totalPrs}`);
    lines.push("");
    lines.push(`## 🏆 贡献者排名`);
    lines.push("");
    const isDefectRate = result.userStats.some((u) => u.defectRate !== undefined);
    if (isDefectRate) {
      lines.push(`| 排名 | 用户 | PR数 | 新增 | 删除 | 问题 | 缺陷率 |`);
      lines.push(`|------|------|------|------|------|------|--------|`);
      result.userStats.forEach((user, index) => {
        lines.push(
          `| #${index + 1} | @${user.username} | ${user.prCount} | +${user.totalAdditions} | -${user.totalDeletions} | ${user.totalIssues} | ${(user.defectRate ?? 0).toFixed(1)}% |`,
        );
      });
    } else {
      lines.push(`| 排名 | 用户 | PR数 | 新增 | 删除 | 问题 | 分数 |`);
      lines.push(`|------|------|------|------|------|------|------|`);
      result.userStats.forEach((user, index) => {
        lines.push(
          `| #${index + 1} | @${user.username} | ${user.prCount} | +${user.totalAdditions} | -${user.totalDeletions} | ${user.totalIssues} | ${user.score.toFixed(1)} |`,
        );
      });
    }
    lines.push("");
    lines.push(`## 📋 功能摘要`);
    lines.push("");
    for (const user of result.userStats) {
      if (user.features.length > 0) {
        lines.push(`### 👤 @${user.username}`);
        lines.push("");
        for (const feature of user.features) {
          lines.push(`- ${feature}`);
        }
        lines.push("");
      }
    }
    return lines.join("\n");
  }

  /**
   * 输出报告到指定目标
   */
  async outputReport(
    context: PeriodSummaryContext,
    result: PeriodSummaryResult,
  ): Promise<{ type: OutputTarget; location?: string }> {
    const content = this.formatOutput(result, context.format);
    switch (context.output) {
      case "issue":
        return this.outputToIssue(context, result, content);
      case "file":
        return this.outputToFile(context, result, content);
      case "console":
      default:
        console.log(content);
        return { type: "console" };
    }
  }

  /**
   * 输出报告到 GitHub Issue
   */
  protected async outputToIssue(
    context: PeriodSummaryContext,
    result: PeriodSummaryResult,
    content: string,
  ): Promise<{ type: OutputTarget; location: string }> {
    const title = `📊 周期统计报告: ${result.period.since} ~ ${result.period.until}`;
    const config = this.getStrategyConfig();
    const labelName = config.issueLabel ?? "report";
    const issue: Issue = await this.gitProvider.createIssue(context.owner, context.repo, {
      title,
      body: content,
      labels: [labelName],
    });
    const location = issue.html_url ?? `#${issue.number}`;
    if (shouldLog(context.verbose, 1)) {
      console.log(`✅ 已创建 Issue: ${location}`);
    }
    return { type: "issue", location };
  }

  /**
   * 输出报告到 Markdown 文件
   */
  protected outputToFile(
    context: PeriodSummaryContext,
    result: PeriodSummaryResult,
    content: string,
  ): { type: OutputTarget; location: string } {
    const filename =
      context.outputFile ?? `period-summary-${result.period.since}-${result.period.until}.md`;
    const filepath = join(process.cwd(), filename);
    writeFileSync(filepath, content, "utf-8");
    if (shouldLog(context.verbose, 1)) {
      console.log(`✅ 已保存到文件: ${filepath}`);
    }
    return { type: "file", location: filepath };
  }
}
