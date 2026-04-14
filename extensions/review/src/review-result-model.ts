import {
  GitProviderService,
  CreatePullReviewComment,
  REVIEW_STATE,
  type VerboseLevel,
  shouldLog,
  parseDiffText,
} from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { PullRequestModel } from "./pull-request-model";
import { type ReviewConfig } from "./review.config";
import {
  ReviewSpecService,
  ReviewIssue,
  ReviewResult,
  ReviewStats,
  FileContentsMap,
} from "./review-spec";
import { ReviewReportService, type ReportFormat } from "./review-report";
import { extname } from "path";
import {
  extractIssueKeyFromBody,
  generateIssueKey,
  syncRepliesToIssues,
  calculateIssueStats,
  REVIEW_COMMENT_MARKER,
  REVIEW_LINE_COMMENTS_MARKER,
} from "./utils/review-pr-comment";

export interface ReviewResultSaveOptions {
  verbose?: VerboseLevel;
  autoApprove?: boolean;
  skipSync?: boolean;
}

export interface ReviewResultModelDeps {
  gitProvider: GitProviderService;
  config: IConfigReader;
  reviewSpecService: ReviewSpecService;
  reviewReportService: ReviewReportService;
}

/**
 * ReviewResult 的活跃对象模型，封装 PR ↔ ReviewResult 的双向映射。
 *
 * - 持有 PullRequestModel 引用和 ReviewResult 数据
 * - 提供从 PR 读取/同步状态的方法
 * - 提供将结果写回 PR 的方法
 * - 提供格式化输出的方法
 */
export class ReviewResultModel {
  constructor(
    readonly pr: PullRequestModel,
    private _result: ReviewResult,
    private readonly deps: ReviewResultModelDeps,
  ) {}

  // ─── 工厂方法 ───────────────────────────────────────────

  /**
   * 从 PR 的已有 AI 评论中加载 ReviewResult。
   * 如果没有找到 AI 评论，返回 null。
   */
  static async loadFromPr(
    pr: PullRequestModel,
    deps: ReviewResultModelDeps,
  ): Promise<ReviewResultModel | null> {
    try {
      const comments = await pr.getComments();
      const existingComment = comments.findLast((c) => c.body?.includes(REVIEW_COMMENT_MARKER));
      if (existingComment?.body) {
        const parsed = deps.reviewReportService.parseMarkdown(existingComment.body);
        if (parsed?.result) {
          return new ReviewResultModel(pr, parsed.result, deps);
        }
      }
    } catch (error) {
      console.warn("⚠️ 获取已有评论失败:", error);
    }
    return null;
  }

  /**
   * 用已有的 ReviewResult 数据创建模型（例如 LLM 审查结果）。
   */
  static create(
    pr: PullRequestModel,
    result: ReviewResult,
    deps: ReviewResultModelDeps,
  ): ReviewResultModel {
    return new ReviewResultModel(pr, result, deps);
  }

  /**
   * 非 PR 模式：用假的 PullRequestModel 创建模型（仅用于格式化输出等纯数据操作）。
   * PR I/O 方法（save/syncResolved 等）不可用。
   */
  static createLocal(result: ReviewResult, deps: ReviewResultModelDeps): ReviewResultModel {
    const stubPr = new PullRequestModel(deps.gitProvider, "", "", 0);
    return new ReviewResultModel(stubPr, result, deps);
  }

  /**
   * 创建一个空的 ReviewResult 模型。
   */
  static empty(pr: PullRequestModel, deps: ReviewResultModelDeps): ReviewResultModel {
    return new ReviewResultModel(
      pr,
      { success: true, description: "", issues: [], summary: [], round: 0 },
      deps,
    );
  }

  // ─── 读取器 ─────────────────────────────────────────────

  get result(): ReviewResult {
    return this._result;
  }

  get issues(): ReviewIssue[] {
    return this._result.issues;
  }

  set issues(value: ReviewIssue[]) {
    this._result.issues = value;
  }

  get round(): number {
    return this._result.round;
  }

  get stats(): ReviewStats {
    return calculateIssueStats(this._result.issues);
  }

  // ─── 轮次推进 ─────────────────────────────────────────────

  /**
   * 构建 Round 标题字符串，供 buildLineReviewBody 和 cleanupDuplicateRoundReviews 共用。
   */
  static buildRoundTitle(round: number): string {
    return `### 🚀 Spaceflow Review · Round ${round}`;
  }

  /**
   * 基于当前模型创建下一轮审查模型。
   * - 自动递增 round
   * - 为 newIssues 打上 round 标签
   * - 合并历史 issues（this.issues）+ newIssues
   * - 复制 newResult 的元信息（title/description/deletionImpact 等）
   *
   * 调用方应在调用前完成对历史 issues 的预处理（syncResolved、invalidateChangedFiles、verifyFixes 等）。
   */
  nextRound(newResult: ReviewResult): ReviewResultModel {
    const nextRoundNum = this._result.round + 1;

    // 去重：过滤掉已存在于历史 issues 中的新问题（含 valid:false 的都参与去重）
    const existingKeys = new Set(this._result.issues.map((i) => generateIssueKey(i)));
    const dedupedNewIssues = newResult.issues.filter((i) => !existingKeys.has(generateIssueKey(i)));

    const taggedNewIssues = dedupedNewIssues.map((issue) => ({ ...issue, round: nextRoundNum }));
    const mergedResult: ReviewResult = {
      ...newResult,
      round: nextRoundNum,
      issues: [...this._result.issues, ...taggedNewIssues],
    };
    return new ReviewResultModel(this.pr, mergedResult, this.deps);
  }

  // ─── 数据操作 ───────────────────────────────────────────

  /**
   * 替换整个 result 对象
   */
  setResult(result: ReviewResult): void {
    this._result = result;
  }

  /**
   * 更新 result 的部分字段
   */
  update(partial: Partial<ReviewResult>): void {
    Object.assign(this._result, partial);
  }

  /**
   * 计算问题统计并设置到 result.stats
   */
  updateStats(): ReviewStats {
    const stats = this.stats;
    this._result.stats = stats;
    return stats;
  }

  // ─── 同步（读 PR → 修改 result）─────────────────────────

  /**
   * 从 PR 的所有 resolved review threads 中同步 resolved 状态到 result.issues。
   * 用户手动点击 resolve 的记录写入 resolved/resolvedBy 字段（区别于 AI 验证的 fixed/fixedBy）。
   * 优先通过评论 body 中的 issue key 精确匹配，回退到 path+line 匹配。
   */
  async syncResolved(): Promise<void> {
    try {
      const resolvedThreads = await this.pr.getResolvedThreads();
      if (resolvedThreads.length === 0) {
        return;
      }
      // 构建 issue key → issue 的映射，用于精确匹配
      const issueByKey = new Map<string, ReviewIssue>();
      for (const issue of this._result.issues) {
        issueByKey.set(generateIssueKey(issue), issue);
      }
      const now = new Date().toISOString();
      for (const thread of resolvedThreads) {
        if (!thread.path) continue;
        // 优先通过 issue key 精确匹配
        let matchedIssue: ReviewIssue | undefined;
        if (thread.body) {
          const issueKey = extractIssueKeyFromBody(thread.body);
          if (issueKey) {
            matchedIssue = issueByKey.get(issueKey);
          }
        }
        // 回退：path:line 匹配
        if (!matchedIssue) {
          matchedIssue = this._result.issues.find(
            (issue) =>
              issue.file === thread.path && this.lineMatchesPosition(issue.line, thread.line),
          );
        }
        if (matchedIssue && !matchedIssue.resolved) {
          matchedIssue.resolved = now;
          if (thread.resolvedBy) {
            matchedIssue.resolvedBy = {
              id: thread.resolvedBy.id?.toString(),
              login: thread.resolvedBy.login,
            };
          }
          console.log(
            `🟢 问题已标记为已解决: ${matchedIssue.file}:${matchedIssue.line}` +
              (thread.resolvedBy?.login ? ` (by @${thread.resolvedBy.login})` : ""),
          );
        }
      }
    } catch (error) {
      console.warn("⚠️ 同步已解决评论失败:", error);
    }
  }

  /**
   * 从旧的 AI review 评论中获取 reactions 和回复，同步到 result.issues。
   * - 存储所有 reactions 到 issue.reactions 字段
   * - 存储评论回复到 issue.replies 字段
   * - 如果评论有 ☹️ (confused) reaction，将对应的问题标记为无效
   * - 如果评论有 👎 (-1) reaction，将对应的问题标记为未解决
   */
  async syncReactions(verbose?: VerboseLevel): Promise<void> {
    try {
      const reviews = await this.pr.getReviews();
      const aiReview = reviews.find((r) => r.body?.includes(REVIEW_LINE_COMMENTS_MARKER));
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
        if (review.user?.login && !review.body?.includes(REVIEW_LINE_COMMENTS_MARKER)) {
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
        const prInfo = await this.pr.getInfo();
        // 添加指定的个人评审人
        for (const reviewer of prInfo.requested_reviewers || []) {
          if (reviewer.login) {
            reviewers.add(reviewer.login);
          }
        }
        if (shouldLog(verbose, 2)) {
          console.log(
            `[syncReactionsToIssues] requested_reviewers: ${(prInfo.requested_reviewers || []).map((r) => r.login).join(", ")}`,
          );
          console.log(
            `[syncReactionsToIssues] requested_reviewers_teams: ${JSON.stringify(prInfo.requested_reviewers_teams || [])}`,
          );
        }
        // 添加指定的团队成员（需要通过 API 获取团队成员列表）
        for (const team of prInfo.requested_reviewers_teams || []) {
          if (team.id) {
            try {
              const members = await this.deps.gitProvider.getTeamMembers(team.id);
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
      } catch (prError) {
        // 获取 PR 信息失败，继续使用已有的评审人列表
        if (shouldLog(verbose, 2)) {
          console.warn("[syncReactionsToIssues] 获取 PR 信息失败:", prError);
        }
      }
      if (shouldLog(verbose, 2)) {
        console.log(`[syncReactionsToIssues] final reviewers: ${Array.from(reviewers).join(", ")}`);
      }

      // 获取该 review 的所有行级评论
      const reviewComments = await this.pr.getReviewComments(aiReview.id);
      // 构建评论 ID 到 issue 的映射，用于后续匹配回复
      const commentIdToIssue = new Map<number, ReviewIssue>();
      // 遍历每个评论，获取其 reactions
      for (const comment of reviewComments) {
        if (!comment.id) continue;
        // 找到对应的 issue：优先通过 issue-key 精确匹配，回退到 path+line 匹配
        let matchedIssue: ReviewIssue | undefined;
        if (comment.body) {
          const issueKey = extractIssueKeyFromBody(comment.body);
          if (issueKey) {
            matchedIssue = this._result.issues.find(
              (issue) => generateIssueKey(issue) === issueKey,
            );
            if (shouldLog(verbose, 3)) {
              console.log(
                `[syncReactionsToIssues] comment ${comment.id}: issue-key=${issueKey}, matched=${matchedIssue ? "yes" : "no"}`,
              );
            }
          }
        }
        // 如果 issue-key 匹配失败，使用 path+position 回退匹配
        if (!matchedIssue) {
          matchedIssue = this._result.issues.find(
            (issue) =>
              issue.file === comment.path && this.lineMatchesPosition(issue.line, comment.position),
          );
          if (shouldLog(verbose, 3)) {
            console.log(
              `[syncReactionsToIssues] comment ${comment.id}: fallback matching path=${comment.path}, position=${comment.position}, matched=${matchedIssue ? "yes" : "no"}`,
            );
          }
        }
        if (matchedIssue) {
          commentIdToIssue.set(comment.id, matchedIssue);
        }
        try {
          const reactions = await this.pr.getReviewCommentReactions(comment.id);
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
          // 检查是否有评审人的 ☹️ (confused) reaction，标记为无效
          const confusedUsers = reactionMap.get("confused") || [];
          const reviewerConfused = confusedUsers.filter((u) => reviewers.has(u));
          if (reviewerConfused.length > 0 && matchedIssue.valid !== "false") {
            matchedIssue.valid = "false";
            console.log(
              `☹️ 问题已标记为无效: ${matchedIssue.file}:${matchedIssue.line} (by 评审人: ${reviewerConfused.join(", ")})`,
            );
          }
          // 检查是否有评审人的 👎 (-1) reaction，标记为未解决
          const thumbsDownUsers = reactionMap.get("-1") || [];
          const reviewerThumbsDown = thumbsDownUsers.filter((u) => reviewers.has(u));
          if (reviewerThumbsDown.length > 0 && (matchedIssue.resolved || matchedIssue.fixed)) {
            matchedIssue.resolved = undefined;
            matchedIssue.resolvedBy = undefined;
            matchedIssue.fixed = undefined;
            matchedIssue.fixedBy = undefined;
            console.log(
              `👎 问题已标记为未解决: ${matchedIssue.file}:${matchedIssue.line} (by 评审人: ${reviewerThumbsDown.join(", ")})`,
            );
          }
        } catch (reactionError) {
          // 单个评论获取 reactions 失败，继续处理其他评论
          if (shouldLog(verbose, 2)) {
            console.warn(
              `[syncReactionsToIssues] 获取评论 ${comment.id} reactions 失败:`,
              reactionError,
            );
          }
        }
      }
      // 获取 PR 上的所有 Issue Comments（包含对 review 评论的回复）
      await syncRepliesToIssues(reviewComments, this._result, (line, pos) =>
        this.lineMatchesPosition(line, pos),
      );
    } catch (error) {
      console.warn("⚠️ 同步评论 reactions 失败:", error);
    }
  }

  /**
   * 将有变更文件的历史 issue 标记为无效。
   * 策略：如果文件在最新 commit 中有变更，则将该文件的历史问题标记为无效，但以下情况保留：
   * - issue 已被用户手动 resolved 且当前代码行内容与 issue.code 不同（说明用户 resolve 后代码已变，应保留其 resolve 状态）
   */
  async invalidateChangedFiles(
    headSha: string | undefined,
    fileContents?: FileContentsMap,
    verbose?: VerboseLevel,
  ): Promise<void> {
    if (!headSha) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⚠️ 无法获取 PR head SHA，跳过变更文件检查`);
      }
      return;
    }

    if (shouldLog(verbose, 1)) {
      console.log(`   📊 获取最新 commit 变更文件: ${headSha.slice(0, 7)}`);
    }

    try {
      // 使用 Git Provider API 获取最新一次 commit 的 diff
      const diffText = await this.pr.getCommitDiff(headSha);
      const diffFiles = parseDiffText(diffText);

      if (diffFiles.length === 0) {
        if (shouldLog(verbose, 1)) {
          console.log(`   ⏭️ 最新 commit 无文件变更`);
        }
        return;
      }

      // 构建变更文件集合
      const changedFileSet = new Set(diffFiles.map((f) => f.filename));
      if (shouldLog(verbose, 2)) {
        console.log(`   [invalidateIssues] 变更文件: ${[...changedFileSet].join(", ")}`);
      }

      // 将变更文件的历史 issue 标记为无效
      let invalidatedCount = 0;
      let preservedCount = 0;
      this._result.issues = this._result.issues.map((issue) => {
        // 如果 issue 已修复或已无效，不需要处理
        if (issue.fixed || issue.valid === "false") {
          return issue;
        }

        // 如果 issue 所在文件有变更
        if (changedFileSet.has(issue.file)) {
          // 已 resolved 的 issue：检查当前代码行是否与 issue.code 不同
          // 不同说明用户 resolve 后代码确实变了，保留其 resolve 状态
          if (issue.resolved && issue.code && fileContents) {
            const contentLines = fileContents.get(issue.file);
            if (contentLines) {
              const lineNums = issue.line
                .split("-")
                .map(Number)
                .filter((n) => !isNaN(n));
              const startLine = lineNums[0];
              const endLine = lineNums[lineNums.length - 1];
              const currentCode = contentLines
                .slice(startLine - 1, endLine)
                .map(([, line]) => line)
                .join("\n")
                .trim();
              if (currentCode !== issue.code) {
                preservedCount++;
                if (shouldLog(verbose, 1)) {
                  console.log(
                    `   ✅ Issue ${issue.file}:${issue.line} 已 resolved 且代码已变更，保留`,
                  );
                }
                return issue;
              }
            }
          }

          invalidatedCount++;
          if (shouldLog(verbose, 1)) {
            console.log(`   🗑️ Issue ${issue.file}:${issue.line} 所在文件有变更，标记为无效`);
          }
          return { ...issue, valid: "false", originalLine: issue.originalLine ?? issue.line };
        }

        return issue;
      });

      if ((invalidatedCount > 0 || preservedCount > 0) && shouldLog(verbose, 1)) {
        const parts: string[] = [];
        if (invalidatedCount > 0) parts.push(`标记 ${invalidatedCount} 个无效`);
        if (preservedCount > 0) parts.push(`保留 ${preservedCount} 个已 resolved`);
        console.log(`   📊 Issue 处理: ${parts.join("，")}`);
      }
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn(`   ⚠️ 获取最新 commit 变更文件失败: ${error}`);
      }
    }
  }

  // ─── 写（result → PR）──────────────────────────────────

  /**
   * 将 ReviewResult 写回 PR（发布/更新主评论 + 行级评论 + 自动批准）。
   */
  async save(options?: ReviewResultSaveOptions): Promise<void> {
    const { verbose, autoApprove, skipSync } = options ?? {};
    // 获取配置
    const reviewConf = this.deps.config.getPluginConfig<ReviewConfig>("review");

    // 如果配置启用且有 AI 生成的标题，只在第一轮审查时更新 PR 标题
    if (reviewConf.autoUpdatePrTitle && this._result.title && this._result.round === 1) {
      try {
        await this.pr.edit({ title: this._result.title });
        console.log(`📝 已更新 PR 标题: ${this._result.title}`);
      } catch (error) {
        console.warn("⚠️ 更新 PR 标题失败:", error);
      }
    }

    // 获取已解决的评论，同步 resolve 状态（在更新 review 之前）
    // 如果调用方已经同步过，skipSync=true 跳过冗余的 API 调用
    if (!skipSync) {
      await this.syncResolved();
      await this.syncReactions(verbose);
    }

    // 并发合并：写入前重新读取 PR 最新评论，检查是否有并发 workflow 先写入了同 round 数据
    // 场景：用户快速提交 commit A 和 B → 两个 review workflow 并发运行 → 都基于旧数据计算出 Round N
    // 先完成的已写入 Round N，后完成的需要合并而非覆盖
    await this.mergeWithLatest(verbose);

    // 查找已有的 AI 评论（Issue Comment），可能存在多个重复评论
    if (shouldLog(verbose, 2)) {
      console.log(
        `[postOrUpdateReviewComment] owner=${this.pr.owner}, repo=${this.pr.repo}, prNumber=${this.pr.number}`,
      );
    }
    const existingComments = await this.findExistingAiComments(verbose);
    if (shouldLog(verbose, 2)) {
      console.log(
        `[postOrUpdateReviewComment] found ${existingComments.length} existing AI comments`,
      );
    }

    // 调试：检查 issues 是否有 author
    if (shouldLog(verbose, 3)) {
      for (const issue of this._result.issues.slice(0, 3)) {
        console.log(
          `[postOrUpdateReviewComment] issue: file=${issue.file}, commit=${issue.commit}, author=${issue.author?.login}`,
        );
      }
    }

    const reviewBody = this.formatComment({
      prNumber: this.pr.number,
      outputFormat: "markdown",
      ci: true,
    });

    // 获取 PR 信息以获取 head commit SHA
    const commitId = await this.pr.getHeadSha();

    // 1. 发布或更新主评论（使用 Issue Comment API，支持删除和更新）
    try {
      if (existingComments.length > 0) {
        // 更新第一个 AI 评论
        await this.pr.updateComment(existingComments[0].id, reviewBody);
        console.log(`✅ 已更新 AI Review 评论`);
        // 删除多余的重复 AI 评论
        for (const duplicate of existingComments.slice(1)) {
          try {
            await this.pr.deleteComment(duplicate.id);
            console.log(`🗑️ 已删除重复的 AI Review 评论 (id: ${duplicate.id})`);
          } catch {
            console.warn(`⚠️ 删除重复评论失败 (id: ${duplicate.id})`);
          }
        }
      } else {
        await this.pr.createComment({ body: reviewBody });
        console.log(`✅ 已发布 AI Review 评论`);
      }
    } catch (error) {
      console.warn("⚠️ 发布/更新 AI Review 评论失败:", error);
    }

    // 2. 发布本轮新发现的行级评论（使用 PR Review API）
    // 保留旧轮次的 review 历史，但清理同轮次的旧 AI review（重复触发场景）
    // 如果启用 autoApprove 且所有问题已解决，使用 APPROVE event 合并发布
    await this.cleanupDuplicateRoundReviews(this._result.round, verbose);

    let lineIssues: ReviewIssue[] = [];
    let comments: CreatePullReviewComment[] = [];
    if (reviewConf.lineComments) {
      lineIssues = this._result.issues.filter(
        (issue) =>
          issue.round === this._result.round &&
          !issue.fixed &&
          !issue.resolved &&
          issue.valid !== "false",
      );
      comments = lineIssues
        .map((issue) => this.issueToReviewComment(issue))
        .filter((comment): comment is CreatePullReviewComment => comment !== null);
    }

    // 计算是否需要自动批准
    // 条件：启用 autoApprove 且没有待处理问题（包括从未发现问题的情况）
    const stats = this.stats;
    const shouldAutoApprove = autoApprove && stats.pending === 0;

    // 获取 PR 作者用户名，用于自动批准时 @ 通知
    const prAuthorLogin = shouldAutoApprove ? (await this.pr.getInfo()).user?.login : undefined;

    if (reviewConf.lineComments) {
      const lineReviewBody = this.buildLineReviewBody(
        lineIssues,
        this._result.round,
        this._result.issues,
      );

      // 如果需要自动批准，追加批准信息到 body
      const finalReviewBody = shouldAutoApprove
        ? lineReviewBody + `\n\n---\n\n` + this.buildAutoApproveBody(stats, prAuthorLogin)
        : lineReviewBody;

      const reviewEvent = shouldAutoApprove ? REVIEW_STATE.APPROVE : REVIEW_STATE.COMMENT;

      if (comments.length > 0) {
        try {
          await this.pr.createReview({
            event: reviewEvent,
            body: finalReviewBody,
            comments,
            commit_id: commitId,
          });
          if (shouldAutoApprove) {
            console.log(`✅ 已自动批准 PR #${this.pr.number}（所有问题已解决）`);
          } else {
            console.log(`✅ 已发布 ${comments.length} 条行级评论`);
          }
        } catch (batchError) {
          // 批量失败时逐条发布，跳过无法定位的评论
          console.warn("⚠️ 批量发布行级评论失败，尝试逐条发布...", batchError);
          let successCount = 0;
          for (const comment of comments) {
            try {
              // 逐条发布时只用 COMMENT event，避免重复 APPROVE
              await this.pr.createReview({
                event: REVIEW_STATE.COMMENT,
                body: successCount === 0 ? lineReviewBody : undefined,
                comments: [comment],
                commit_id: commitId,
              });
              successCount++;
            } catch (singleError) {
              console.warn(
                `⚠️ 跳过无法定位的评论: ${comment.path}:${comment.new_position}`,
                singleError,
              );
            }
          }
          if (successCount > 0) {
            console.log(`✅ 逐条发布成功 ${successCount}/${comments.length} 条行级评论`);
            // 如果需要自动批准，单独发一个 APPROVE review
            if (shouldAutoApprove) {
              try {
                await this.pr.createReview({
                  event: REVIEW_STATE.APPROVE,
                  body: this.buildAutoApproveBody(stats, prAuthorLogin),
                  commit_id: commitId,
                });
                console.log(`✅ 已自动批准 PR #${this.pr.number}（所有问题已解决）`);
              } catch (error) {
                console.warn("⚠️ 自动批准失败:", error);
              }
            }
          } else {
            console.warn("⚠️ 所有行级评论均无法定位，已跳过");
          }
        }
      } else {
        // 本轮无新问题，仍发布 Round 状态（含上轮回顾）
        try {
          await this.pr.createReview({
            event: reviewEvent,
            body: finalReviewBody,
            comments: [],
            commit_id: commitId,
          });
          if (shouldAutoApprove) {
            console.log(
              `✅ 已自动批准 PR #${this.pr.number}（Round ${this._result.round}，所有问题已解决）`,
            );
          } else {
            console.log(`✅ 已发布 Round ${this._result.round} 审查状态（无新问题）`);
          }
        } catch (error) {
          console.warn("⚠️ 发布审查状态失败:", error);
        }
      }
    } else if (shouldAutoApprove) {
      // 未启用 lineComments 但需要自动批准
      try {
        await this.pr.createReview({
          event: REVIEW_STATE.APPROVE,
          body: this.buildAutoApproveBody(stats, prAuthorLogin),
          commit_id: commitId,
        });
        console.log(`✅ 已自动批准 PR #${this.pr.number}（所有问题已解决）`);
      } catch (error) {
        console.warn("⚠️ 自动批准失败:", error);
      }
    }
  }

  /**
   * 构建自动批准消息 body，包含 @username mention
   */
  private buildAutoApproveBody(stats: ReviewStats, prAuthorLogin?: string): string {
    const mention = prAuthorLogin ? ` @${prAuthorLogin}` : "";
    const reason =
      stats.validTotal > 0
        ? `所有问题都已解决 (${stats.fixed} 已修复, ${stats.resolved} 已解决)，`
        : "代码审查通过，未发现问题，";
    return `✅ **自动批准合并**\n\n${reason}自动批准此 PR。${mention}`;
  }

  /**
   * 删除已有的 AI review（通过 marker 识别）。
   * - 删除行级评论的 PR Review（带 REVIEW_LINE_COMMENTS_MARKER）
   * - 删除主评论的 Issue Comment（带 REVIEW_COMMENT_MARKER）
   */
  async deleteOldReviews(): Promise<void> {
    let deletedCount = 0;
    // 删除行级评论的 PR Review
    try {
      const reviews = await this.pr.getReviews();
      const aiReviews = reviews.filter(
        (r) =>
          r.body?.includes(REVIEW_LINE_COMMENTS_MARKER) || r.body?.includes(REVIEW_COMMENT_MARKER),
      );
      for (const review of aiReviews) {
        if (review.id) {
          try {
            await this.pr.deleteReview(review.id);
            deletedCount++;
          } catch {
            // 已提交的 review 无法删除，忽略
          }
        }
      }
    } catch (error) {
      console.warn("⚠️ 列出 PR reviews 失败:", error);
    }
    // 删除主评论的 Issue Comment
    try {
      const comments = await this.pr.getComments();
      const aiComments = comments.filter((c) => c.body?.includes(REVIEW_COMMENT_MARKER));
      for (const comment of aiComments) {
        if (comment.id) {
          try {
            await this.pr.deleteComment(comment.id);
            deletedCount++;
          } catch (error) {
            console.warn(`⚠️ 删除评论 ${comment.id} 失败:`, error);
          }
        }
      }
    } catch (error) {
      console.warn("⚠️ 列出 issue comments 失败:", error);
    }
    if (deletedCount > 0) {
      console.log(`🗑️ 已删除 ${deletedCount} 个旧的 AI review`);
    }
  }

  // ─── 格式化 ─────────────────────────────────────────────

  /**
   * 将 ReviewResult 格式化为评论文本。
   */
  formatComment(
    options: { prNumber?: number; outputFormat?: ReportFormat; ci?: boolean } = {},
  ): string {
    const { prNumber, outputFormat, ci } = options;
    // 智能选择格式：如果未指定，PR 模式用 markdown，终端用 terminal
    const format: ReportFormat = outputFormat || (ci && prNumber ? "markdown" : "terminal");

    if (format === "markdown") {
      return this.deps.reviewReportService.formatMarkdown(this._result, {
        prNumber,
        includeReanalysisCheckbox: true,
        includeJsonData: true,
        reviewCommentMarker: REVIEW_COMMENT_MARKER,
      });
    }

    return this.deps.reviewReportService.format(this._result, format);
  }

  /**
   * 从评论 body 解析出 ReviewResult（用于测试兼容）。
   */
  parseFromComment(commentBody: string): ReviewResult | null {
    const parsed = this.deps.reviewReportService.parseMarkdown(commentBody);
    return parsed?.result ?? null;
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 写入前并发合并：重新从 PR 读取最新评论，检查是否有并发 workflow 先写入了同 round 数据。
   * 如果有，将当前结果的同 round issues 与已有的合并去重，保证 PR 上只有一份 Round N 数据。
   *
   * 场景：用户快速提交 commit A、B → 两个 workflow 并发 → 都基于旧 Round N-1 算出 Round N
   * → 先完成的写入 Round N → 后完成的需要读取最新、合并后替换。
   *
   * ⚠️ 限制：这是 best-effort 合并，存在 TOCTOU 竞态。如果两个 workflow 几乎同时到达
   * mergeWithLatest()，它们都会读到相同的旧状态并各自写入，导致后写者覆盖先写者的主评论、
   * 以及产生两个 PR Review。cleanupDuplicateRoundReviews 可以缓解重复 review 问题，
   * 但主评论仍以最后写入者为准。在没有服务端锁或乐观并发控制（如 ETag/If-Match）的前提下，
   * 这是当前能做到的最佳方案。
   */
  private async mergeWithLatest(verbose?: VerboseLevel): Promise<void> {
    try {
      // invalidate 缓存，确保读到最新数据
      this.pr.invalidate("comments");
      const latestModel = await ReviewResultModel.loadFromPr(this.pr, this.deps);
      if (!latestModel) return;

      const myRound = this._result.round;
      const latestRound = latestModel.round;

      // 场景 1: latestRound < myRound — 没有并发写入，无需合并
      if (latestRound < myRound) return;

      // 场景 2: latestRound === myRound — 并发 workflow 先写入了同 round
      // 将 latest 的同 round issues 与当前的合并去重
      if (latestRound === myRound) {
        const latestRoundIssues = latestModel.issues.filter((i) => i.round === myRound);
        if (latestRoundIssues.length === 0) return;

        const myRoundIssues = this._result.issues.filter((i) => i.round === myRound);
        const myHistoryIssues = this._result.issues.filter((i) => i.round !== myRound);

        // 以 latest 的同 round issues 为基础，追加当前独有的 issues（去重）
        const existingKeys = new Set(latestRoundIssues.map((i) => generateIssueKey(i)));
        const uniqueNewIssues = myRoundIssues.filter((i) => !existingKeys.has(generateIssueKey(i)));

        const mergedRoundIssues = [...latestRoundIssues, ...uniqueNewIssues];
        this._result = {
          ...this._result,
          issues: [...myHistoryIssues, ...mergedRoundIssues],
          // 合并 latest 的 deletionImpact（并发的那个 workflow 可能已完成删除分析）
          deletionImpact: this._result.deletionImpact ?? latestModel.result.deletionImpact,
        };

        if (shouldLog(verbose, 1)) {
          console.log(
            `🔀 检测到并发 Round ${myRound}，合并 ${latestRoundIssues.length} 个已有 + ${uniqueNewIssues.length} 个新增问题`,
          );
        }
        return;
      }

      // 场景 3: latestRound > myRound — 并发 workflow 已推进到更高轮次
      // 当前结果作为 latestRound 的补充合并进去
      // 注意：有意使用 latestModel 的元信息（title/description/headSha 等）覆盖当前结果，
      // 因为 latestModel 基于更新的 commit 生成，其元信息更准确。
      if (latestRound > myRound) {
        const myRoundIssues = this._result.issues.filter((i) => i.round === myRound);
        // 将当前 round 的 issues 标记为 latestRound
        const retaggedIssues = myRoundIssues.map((i) => ({ ...i, round: latestRound }));

        // 与 latest 的同 round issues 去重
        const latestKeys = new Set(latestModel.issues.map((i) => generateIssueKey(i)));
        const uniqueIssues = retaggedIssues.filter((i) => !latestKeys.has(generateIssueKey(i)));

        this._result = {
          ...latestModel.result,
          issues: [...latestModel.issues, ...uniqueIssues],
          // 保留当前的 deletionImpact 等元信息（如果有）
          deletionImpact: this._result.deletionImpact ?? latestModel.result.deletionImpact,
        };

        if (shouldLog(verbose, 1)) {
          console.log(
            `🔀 检测到并发更高轮次 Round ${latestRound}（当前 Round ${myRound}），合并 ${uniqueIssues.length} 个新增问题`,
          );
        }
      }
    } catch (error) {
      // 合并失败不阻塞写入，使用当前数据继续
      if (shouldLog(verbose, 2)) {
        console.warn("⚠️ 并发合并检查失败:", error);
      }
    }
  }

  /**
   * 清理同轮次的旧 AI review（PR Review），避免重复触发时产生重复的 Round 评论。
   * 保留旧轮次的 review 历史（如 Round 1 的评论在 Round 2 时保留）。
   * 只删除包含 REVIEW_LINE_COMMENTS_MARKER 且 Round 号匹配当前轮次的 review。
   */
  private async cleanupDuplicateRoundReviews(
    currentRound: number,
    verbose?: VerboseLevel,
  ): Promise<void> {
    try {
      const reviews = await this.pr.getReviews();
      const roundPattern = ReviewResultModel.buildRoundTitle(currentRound);
      const duplicateReviews = reviews.filter(
        (r) =>
          r.body?.includes(REVIEW_LINE_COMMENTS_MARKER) && r.body?.includes(roundPattern) && r.id,
      );
      for (const review of duplicateReviews) {
        try {
          await this.pr.deleteReview(review.id!);
          if (shouldLog(verbose, 1)) {
            console.log(`🗑️ 已删除同轮次的旧 AI review (id: ${review.id}, Round ${currentRound})`);
          }
        } catch {
          // 已提交的 review 无法删除，忽略
        }
      }
      // invalidate reviews 缓存以便后续操作获取最新状态
      if (duplicateReviews.length > 0) {
        this.pr.invalidate("reviews");
      }
    } catch (error) {
      if (shouldLog(verbose, 2)) {
        console.warn("⚠️ 清理同轮次旧 review 失败:", error);
      }
    }
  }

  /**
   * 查找已有的所有 AI 评论（Issue Comment）。
   * 返回所有包含 REVIEW_COMMENT_MARKER 的评论，用于更新第一个并清理重复项。
   */
  async findExistingAiComments(verbose?: VerboseLevel): Promise<{ id: number }[]> {
    try {
      const comments = await this.pr.getComments();
      if (shouldLog(verbose, 2)) {
        console.log(
          `[findExistingAiComments] listIssueComments returned ${Array.isArray(comments) ? comments.length : typeof comments} comments`,
        );
        if (Array.isArray(comments)) {
          for (const c of comments.slice(0, 5)) {
            console.log(
              `[findExistingAiComments] comment id=${c.id}, body starts with: ${c.body?.slice(0, 80) ?? "(no body)"}`,
            );
          }
        }
      }
      return comments
        .filter((c) => c.body?.includes(REVIEW_COMMENT_MARKER) && c.id)
        .map((c) => ({ id: c.id! }));
    } catch (error) {
      console.warn("[findExistingAiComments] error:", error);
      return [];
    }
  }

  /**
   * 检查 issue 的行号是否匹配评论的 position。
   */
  lineMatchesPosition(issueLine: string, position?: number): boolean {
    if (!position) return false;
    const lines = this.deps.reviewSpecService.parseLineRange(issueLine);
    if (lines.length === 0) return false;
    const startLine = lines[0];
    const endLine = lines[lines.length - 1];
    return position >= startLine && position <= endLine;
  }

  /**
   * 将单个 ReviewIssue 转换为 CreatePullReviewComment。
   */
  issueToReviewComment(issue: ReviewIssue): CreatePullReviewComment | null {
    const lineNums = this.deps.reviewSpecService.parseLineRange(issue.line);
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
    lines.push(`<!-- issue-key: ${generateIssueKey(issue)} -->`);
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

  /**
   * 构建行级评论 Review 的 body（marker + 本轮统计 + 上轮回顾）。
   */
  buildLineReviewBody(issues: ReviewIssue[], round: number, allIssues: ReviewIssue[]): string {
    // 只统计待处理的问题（未修复且未解决）
    const pendingIssues = issues.filter((i) => !i.fixed && !i.resolved && i.valid !== "false");
    const pendingErrors = pendingIssues.filter((i) => i.severity === "error").length;
    const pendingWarns = pendingIssues.filter((i) => i.severity === "warn").length;
    const fileCount = new Set(issues.map((i) => i.file)).size;

    const totalPending = pendingErrors + pendingWarns;
    const badges: string[] = [];
    if (totalPending > 0) badges.push(`⚠️ ${totalPending}`);
    if (pendingErrors > 0) badges.push(`🔴 ${pendingErrors}`);
    if (pendingWarns > 0) badges.push(`🟡 ${pendingWarns}`);

    const parts: string[] = [REVIEW_LINE_COMMENTS_MARKER];
    parts.push(ReviewResultModel.buildRoundTitle(round));
    if (issues.length === 0) {
      parts.push(`> ✅ 未发现新问题`);
    } else {
      parts.push(
        `> **${issues.length}** 个新问题 · **${fileCount}** 个文件${badges.length > 0 ? " · " + badges.join(" ") : ""}`,
      );
    }

    // 上轮回顾
    if (round > 1) {
      const prevIssues = allIssues.filter((i) => i.round === round - 1);
      if (prevIssues.length > 0) {
        const {
          fixed: prevFixed,
          resolved: prevResolved,
          invalid: prevInvalid,
          pending: prevPending,
        } = calculateIssueStats(prevIssues);
        parts.push("");
        parts.push(
          `<details><summary>📊 Round ${round - 1} 回顾 (${prevIssues.length} 个问题)</summary>\n`,
        );
        parts.push(`| 状态 | 数量 |`);
        parts.push(`|------|------|`);
        if (prevFixed > 0) parts.push(`| 🟢 已修复 | ${prevFixed} |`);
        if (prevResolved > 0) parts.push(`| ⚪ 已解决 | ${prevResolved} |`);
        if (prevInvalid > 0) parts.push(`| ❌ 无效 | ${prevInvalid} |`);
        if (prevPending > 0) parts.push(`| ⚠️ 待处理 | ${prevPending} |`);
        parts.push(`\n</details>`);
      }
    }

    return parts.join("\n");
  }
}
