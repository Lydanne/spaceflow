import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { writeFileSync } from "fs";
import { join } from "path";
import { GitProviderService, shouldLog, normalizeVerbose } from "@spaceflow/core";
import type { PullRequest, Issue, CiConfig } from "@spaceflow/core";
import type {
  PeriodSummaryOptions,
  PeriodSummaryContext,
  PeriodSummaryResult,
  PrStats,
  UserStats,
  OutputTarget,
  TimePreset,
} from "./types";

/** 分数权重配置 */
const SCORE_WEIGHTS = {
  /** 每个 PR 的基础分 */
  prBase: 10,
  /** 每 100 行新增代码的分数 */
  additionsPer100: 2,
  /** 每 100 行删除代码的分数 */
  deletionsPer100: 1,
  /** 每个变更文件的分数 */
  changedFile: 0.5,
  /** 每个未修复问题的扣分 */
  issueDeduction: 3,
  /** 每个已修复问题的加分 */
  fixedBonus: 1,
};

/**
 * 周期统计服务
 */
@Injectable()
export class PeriodSummaryService {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly configService: ConfigService,
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
      const ciConf = this.configService.get<CiConfig>("ci");
      const repository = ciConf?.repository;
      if (!repository) {
        throw new Error("缺少仓库配置，请通过 --repository 参数或环境变量 GITHUB_REPOSITORY 指定");
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
    try {
      const files = await this.gitProvider.getPullRequestFiles(owner, repo, pr.number!);
      changedFiles = files.length;
      for (const file of files) {
        additions += file.additions ?? 0;
        deletions += file.deletions ?? 0;
      }
    } catch {
      // 如果获取文件失败，使用默认值
    }
    const { issueCount, fixedCount } = await this.extractIssueStats(owner, repo, pr.number!);
    return {
      number: pr.number!,
      title: pr.title ?? "",
      author: pr.user?.login ?? "unknown",
      mergedAt: pr.merged_at ?? "",
      additions,
      deletions,
      changedFiles,
      issueCount,
      fixedCount,
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
  ): Promise<{ issueCount: number; fixedCount: number }> {
    try {
      const comments = await this.gitProvider.listIssueComments(owner, repo, prNumber);
      let issueCount = 0;
      let fixedCount = 0;
      for (const comment of comments) {
        const body = comment.body ?? "";
        const issueMatch = body.match(/发现\s*(\d+)\s*个问题/);
        if (issueMatch) {
          issueCount = Math.max(issueCount, parseInt(issueMatch[1], 10));
        }
        const fixedMatch = body.match(/已修复[：:]\s*(\d+)/);
        if (fixedMatch) {
          fixedCount = Math.max(fixedCount, parseInt(fixedMatch[1], 10));
        }
        const statsMatch = body.match(/🔴\s*(\d+).*🟡\s*(\d+)/);
        if (statsMatch) {
          const errorCount = parseInt(statsMatch[1], 10);
          const warnCount = parseInt(statsMatch[2], 10);
          issueCount = Math.max(issueCount, errorCount + warnCount);
        }
      }
      return { issueCount, fixedCount };
    } catch {
      return { issueCount: 0, fixedCount: 0 };
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
      if (pr.description) {
        userStats.features.push(pr.description);
      }
      userStats.prs.push(pr);
    }
    for (const userStats of userMap.values()) {
      userStats.score = this.calculateScore(userStats);
    }
    return userMap;
  }

  /**
   * 计算用户综合分数
   */
  protected calculateScore(stats: UserStats): number {
    const prScore = stats.prCount * SCORE_WEIGHTS.prBase;
    const additionsScore = (stats.totalAdditions / 100) * SCORE_WEIGHTS.additionsPer100;
    const deletionsScore = (stats.totalDeletions / 100) * SCORE_WEIGHTS.deletionsPer100;
    const filesScore = stats.totalChangedFiles * SCORE_WEIGHTS.changedFile;
    const unfixedIssues = stats.totalIssues - stats.totalFixed;
    const issueDeduction = unfixedIssues * SCORE_WEIGHTS.issueDeduction;
    const fixedBonus = stats.totalFixed * SCORE_WEIGHTS.fixedBonus;
    const totalScore =
      prScore + additionsScore + deletionsScore + filesScore - issueDeduction + fixedBonus;
    return Math.max(0, Math.round(totalScore * 10) / 10);
  }

  /**
   * 按分数排序用户统计
   */
  protected sortUserStats(userMap: Map<string, UserStats>): UserStats[] {
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
    const header = [
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
      const row = [
        `#${index + 1}`.padEnd(4),
        user.username.slice(0, 15).padEnd(15),
        String(user.prCount).padStart(5),
        `+${user.totalAdditions}`.padStart(8),
        `-${user.totalDeletions}`.padStart(8),
        String(user.totalIssues).padStart(5),
        user.score.toFixed(1).padStart(8),
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
    lines.push(`| 排名 | 用户 | PR数 | 新增 | 删除 | 问题 | 分数 |`);
    lines.push(`|------|------|------|------|------|------|------|`);
    result.userStats.forEach((user, index) => {
      lines.push(
        `| #${index + 1} | ${user.username} | ${user.prCount} | +${user.totalAdditions} | -${user.totalDeletions} | ${user.totalIssues} | ${user.score.toFixed(1)} |`,
      );
    });
    lines.push("");
    lines.push(`## 📋 功能摘要`);
    lines.push("");
    for (const user of result.userStats) {
      if (user.features.length > 0) {
        lines.push(`### 👤 ${user.username}`);
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
    const issue: Issue = await this.gitProvider.createIssue(context.owner, context.repo, {
      title,
      body: content,
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
