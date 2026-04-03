import {
  GitProviderService,
  CreatePullReviewComment,
  REVIEW_STATE,
  type VerboseLevel,
  shouldLog,
} from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { type ReviewConfig } from "./review.config";
import { ReviewSpecService, ReviewIssue, ReviewResult, ReviewStats } from "./review-spec";
import { ReviewReportService, type ReportFormat } from "./review-report";
import { extname } from "path";
import {
  extractIssueKeyFromBody,
  generateIssueKey,
  syncRepliesToIssues,
  calculateIssueStats,
} from "./review-pr-comment-utils";
export { deleteExistingAiReviews, isAiGeneratedComment } from "./review-pr-comment-utils";

const REVIEW_COMMENT_MARKER = "<!-- spaceflow-review -->";
const REVIEW_LINE_COMMENTS_MARKER = "<!-- spaceflow-review-lines -->";

export { REVIEW_COMMENT_MARKER, REVIEW_LINE_COMMENTS_MARKER };

export class ReviewPrComment {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
    protected readonly reviewSpecService: ReviewSpecService,
    protected readonly reviewReportService: ReviewReportService,
  ) {}

  formatReviewComment(
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

  async postOrUpdateReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    result: ReviewResult,
    verbose?: VerboseLevel,
    autoApprove?: boolean,
    skipSync?: boolean,
  ): Promise<void> {
    // 获取配置
    const reviewConf = this.config.getPluginConfig<ReviewConfig>("review");

    // 如果配置启用且有 AI 生成的标题，只在第一轮审查时更新 PR 标题
    if (reviewConf.autoUpdatePrTitle && result.title && result.round === 1) {
      try {
        await this.gitProvider.editPullRequest(owner, repo, prNumber, { title: result.title });
        console.log(`📝 已更新 PR 标题: ${result.title}`);
      } catch (error) {
        console.warn("⚠️ 更新 PR 标题失败:", error);
      }
    }

    // 获取已解决的评论，同步 resolve 状态（在更新 review 之前）
    // 如果调用方已经同步过，skipSync=true 跳过冗余的 API 调用
    if (!skipSync) {
      await this.syncResolvedComments(owner, repo, prNumber, result);
      await this.syncReactionsToIssues(owner, repo, prNumber, result, verbose);
    }

    // 查找已有的 AI 评论（Issue Comment），可能存在多个重复评论
    if (shouldLog(verbose, 2)) {
      console.log(`[postOrUpdateReviewComment] owner=${owner}, repo=${repo}, prNumber=${prNumber}`);
    }
    const existingComments = await this.findExistingAiComments(owner, repo, prNumber, verbose);
    if (shouldLog(verbose, 2)) {
      console.log(
        `[postOrUpdateReviewComment] found ${existingComments.length} existing AI comments`,
      );
    }

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

    // 1. 发布或更新主评论（使用 Issue Comment API，支持删除和更新）
    try {
      if (existingComments.length > 0) {
        // 更新第一个 AI 评论
        await this.gitProvider.updateIssueComment(owner, repo, existingComments[0].id, reviewBody);
        console.log(`✅ 已更新 AI Review 评论`);
        // 删除多余的重复 AI 评论
        for (const duplicate of existingComments.slice(1)) {
          try {
            await this.gitProvider.deleteIssueComment(owner, repo, duplicate.id);
            console.log(`🗑️ 已删除重复的 AI Review 评论 (id: ${duplicate.id})`);
          } catch {
            console.warn(`⚠️ 删除重复评论失败 (id: ${duplicate.id})`);
          }
        }
      } else {
        await this.gitProvider.createIssueComment(owner, repo, prNumber, { body: reviewBody });
        console.log(`✅ 已发布 AI Review 评论`);
      }
    } catch (error) {
      console.warn("⚠️ 发布/更新 AI Review 评论失败:", error);
    }

    // 2. 发布本轮新发现的行级评论（使用 PR Review API，不删除旧的 review，保留历史）
    // 如果启用 autoApprove 且所有问题已解决，使用 APPROVE event 合并发布
    let lineIssues: ReviewIssue[] = [];
    let comments: CreatePullReviewComment[] = [];
    if (reviewConf.lineComments) {
      lineIssues = result.issues.filter(
        (issue) =>
          issue.round === result.round &&
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
    const stats = this.calculateIssueStats(result.issues);
    const shouldAutoApprove = autoApprove && stats.pending === 0;

    if (reviewConf.lineComments) {
      const lineReviewBody = this.buildLineReviewBody(lineIssues, result.round, result.issues);

      // 如果需要自动批准，追加批准信息到 body
      const finalReviewBody = shouldAutoApprove
        ? lineReviewBody +
          `\n\n---\n\n✅ **自动批准合并**\n\n${
            stats.validTotal > 0
              ? `所有问题都已解决 (${stats.fixed} 已修复, ${stats.resolved} 已解决)，`
              : "代码审查通过，未发现问题，"
          }自动批准此 PR。`
        : lineReviewBody;

      const reviewEvent = shouldAutoApprove ? REVIEW_STATE.APPROVE : REVIEW_STATE.COMMENT;

      if (comments.length > 0) {
        try {
          await this.gitProvider.createPullReview(owner, repo, prNumber, {
            event: reviewEvent,
            body: finalReviewBody,
            comments,
            commit_id: commitId,
          });
          if (shouldAutoApprove) {
            console.log(`✅ 已自动批准 PR #${prNumber}（所有问题已解决）`);
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
              await this.gitProvider.createPullReview(owner, repo, prNumber, {
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
                await this.gitProvider.createPullReview(owner, repo, prNumber, {
                  event: REVIEW_STATE.APPROVE,
                  body: `✅ **自动批准合并**\n\n${
                    stats.validTotal > 0
                      ? `所有问题都已解决 (${stats.fixed} 已修复, ${stats.resolved} 已解决)，`
                      : "代码审查通过，未发现问题，"
                  }自动批准此 PR。`,
                  commit_id: commitId,
                });
                console.log(`✅ 已自动批准 PR #${prNumber}（所有问题已解决）`);
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
          await this.gitProvider.createPullReview(owner, repo, prNumber, {
            event: reviewEvent,
            body: finalReviewBody,
            comments: [],
            commit_id: commitId,
          });
          if (shouldAutoApprove) {
            console.log(`✅ 已自动批准 PR #${prNumber}（Round ${result.round}，所有问题已解决）`);
          } else {
            console.log(`✅ 已发布 Round ${result.round} 审查状态（无新问题）`);
          }
        } catch (error) {
          console.warn("⚠️ 发布审查状态失败:", error);
        }
      }
    } else if (shouldAutoApprove) {
      // 未启用 lineComments 但需要自动批准
      try {
        await this.gitProvider.createPullReview(owner, repo, prNumber, {
          event: REVIEW_STATE.APPROVE,
          body: `✅ **自动批准合并**\n\n${
            stats.validTotal > 0
              ? `所有问题都已解决 (${stats.fixed} 已修复, ${stats.resolved} 已解决)，`
              : "代码审查通过，未发现问题，"
          }自动批准此 PR。`,
          commit_id: commitId,
        });
        console.log(`✅ 已自动批准 PR #${prNumber}（所有问题已解决）`);
      } catch (error) {
        console.warn("⚠️ 自动批准失败:", error);
      }
    }
  }

  /**
   * 查找已有的所有 AI 评论（Issue Comment）
   * 返回所有包含 REVIEW_COMMENT_MARKER 的评论，用于更新第一个并清理重复项
   */
  async findExistingAiComments(
    owner: string,
    repo: string,
    prNumber: number,
    verbose?: VerboseLevel,
  ): Promise<{ id: number }[]> {
    try {
      const comments = await this.gitProvider.listIssueComments(owner, repo, prNumber);
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
   * 从 PR 的所有 resolved review threads 中同步 resolved 状态到 result.issues
   * 用户手动点击 resolve 的记录写入 resolved/resolvedBy 字段（区别于 AI 验证的 fixed/fixedBy）
   * 优先通过评论 body 中的 issue key 精确匹配，回退到 path+line 匹配
   */
  async syncResolvedComments(
    owner: string,
    repo: string,
    prNumber: number,
    result: ReviewResult,
  ): Promise<void> {
    try {
      const resolvedThreads = await this.gitProvider.listResolvedThreads(owner, repo, prNumber);
      if (resolvedThreads.length === 0) {
        return;
      }
      // 构建 issue key → issue 的映射，用于精确匹配
      const issueByKey = new Map<string, ReviewResult["issues"][0]>();
      for (const issue of result.issues) {
        issueByKey.set(generateIssueKey(issue), issue);
      }
      const now = new Date().toISOString();
      for (const thread of resolvedThreads) {
        if (!thread.path) continue;
        // 优先通过 issue key 精确匹配
        let matchedIssue: ReviewResult["issues"][0] | undefined;
        if (thread.body) {
          const issueKey = extractIssueKeyFromBody(thread.body);
          if (issueKey) {
            matchedIssue = issueByKey.get(issueKey);
          }
        }
        // 回退：path:line 匹配
        if (!matchedIssue) {
          matchedIssue = result.issues.find(
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
   * 检查 issue 的行号是否匹配评论的 position
   */
  lineMatchesPosition(issueLine: string, position?: number): boolean {
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
   * - 如果评论有 ☹️ (confused) reaction，将对应的问题标记为无效
   * - 如果评论有 👎 (-1) reaction，将对应的问题标记为未解决
   */
  async syncReactionsToIssues(
    owner: string,
    repo: string,
    prNumber: number,
    result: ReviewResult,
    verbose?: VerboseLevel,
  ): Promise<void> {
    try {
      const reviews = await this.gitProvider.listPullReviews(owner, repo, prNumber);
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
          const reactions = await this.gitProvider.getPullReviewCommentReactions(
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
      await syncRepliesToIssues(owner, repo, prNumber, reviewComments, result, (line, pos) =>
        this.lineMatchesPosition(line, pos),
      );
    } catch (error) {
      console.warn("⚠️ 同步评论 reactions 失败:", error);
    }
  }

  /**
   * 构建行级评论 Review 的 body（marker + 本轮统计 + 上轮回顾）
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
    parts.push(`### 🚀 Spaceflow Review · Round ${round}`);
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
        const prevFixed = prevIssues.filter((i) => i.fixed).length;
        const prevResolved = prevIssues.filter((i) => i.resolved && !i.fixed).length;
        const prevInvalid = prevIssues.filter(
          (i) => i.valid === "false" && !i.fixed && !i.resolved,
        ).length;
        const prevPending = prevIssues.length - prevFixed - prevResolved - prevInvalid;
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

  /**
   * 将单个 ReviewIssue 转换为 CreatePullReviewComment
   */
  issueToReviewComment(issue: ReviewIssue): CreatePullReviewComment | null {
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

  parseExistingReviewResult(commentBody: string): ReviewResult | null {
    const parsed = this.reviewReportService.parseMarkdown(commentBody);
    if (!parsed) {
      return null;
    }
    return parsed.result;
  }

  /**
   * 计算问题状态统计
   */
  protected calculateIssueStats(issues: ReviewIssue[]): ReviewStats {
    return calculateIssueStats(issues);
  }
}
