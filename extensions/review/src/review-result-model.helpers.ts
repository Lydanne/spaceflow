import { CreatePullReviewComment } from "@spaceflow/core";
import { extname } from "path";
import { type ReviewIssue, type ReviewStats } from "./review-spec";
import {
  calculateIssueStats,
  generateIssueKey,
  REVIEW_COMMENT_MARKER,
  REVIEW_LINE_COMMENTS_MARKER,
} from "./utils/review-pr-comment";

interface PrReviewIo {
  getReviews: () => Promise<Array<{ id?: number; body?: string }>>;
  deleteReview: (id: number) => Promise<void>;
  getComments: () => Promise<Array<{ id?: number; body?: string }>>;
  deleteComment: (id: number) => Promise<void>;
}

export function buildAutoApproveBody(stats: ReviewStats, prAuthorLogin?: string): string {
  const mention = prAuthorLogin ? ` @${prAuthorLogin}` : "";
  const reason =
    stats.validTotal > 0
      ? `所有问题都已解决 (${stats.fixed} 已修复, ${stats.resolved} 已解决)，`
      : "代码审查通过，未发现问题，";
  return `✅ **自动批准合并**\n\n${reason}自动批准此 PR。${mention}`;
}

export async function deleteOldReviews(pr: PrReviewIo): Promise<number> {
  let deletedCount = 0;
  // 删除行级评论的 PR Review
  try {
    const reviews = await pr.getReviews();
    const aiReviews = reviews.filter(
      (r) => r.body?.includes(REVIEW_LINE_COMMENTS_MARKER) || r.body?.includes(REVIEW_COMMENT_MARKER),
    );
    for (const review of aiReviews) {
      if (review.id) {
        try {
          await pr.deleteReview(review.id);
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
    const comments = await pr.getComments();
    const aiComments = comments.filter((c) => c.body?.includes(REVIEW_COMMENT_MARKER));
    for (const comment of aiComments) {
      if (comment.id) {
        try {
          await pr.deleteComment(comment.id);
          deletedCount++;
        } catch (error) {
          console.warn(`⚠️ 删除评论 ${comment.id} 失败:`, error);
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ 列出 issue comments 失败:", error);
  }
  return deletedCount;
}

export function lineMatchesPosition(
  issueLine: string,
  position: number | undefined,
  parseLineRange: (line: string) => number[],
): boolean {
  if (!position) return false;
  const lines = parseLineRange(issueLine);
  if (lines.length === 0) return false;
  const startLine = lines[0];
  const endLine = lines[lines.length - 1];
  return position >= startLine && position <= endLine;
}

export function issueToReviewComment(
  issue: ReviewIssue,
  parseLineRange: (line: string) => number[],
): CreatePullReviewComment | null {
  const lineNums = parseLineRange(issue.line);
  if (lineNums.length === 0) {
    return null;
  }
  const lineNum = lineNums[0];
  const severityEmoji = issue.severity === "error" ? "🔴" : issue.severity === "warn" ? "🟡" : "⚪";
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

export function buildLineReviewBody(
  issues: ReviewIssue[],
  round: number,
  allIssues: ReviewIssue[],
  buildRoundTitle: (round: number) => string,
): string {
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
  parts.push(buildRoundTitle(round));
  if (issues.length === 0) {
    parts.push(`> ✅ 未发现新问题`);
  } else {
    parts.push(
      `> **${issues.length}** 个新问题 · **${fileCount}** 个文件${badges.length > 0 ? " · " + badges.join(" ") : ""}`,
    );
  }

  if (round > 1) {
    const prevIssues = allIssues.filter((i) => i.round === round - 1);
    if (prevIssues.length > 0) {
      const { fixed: prevFixed, resolved: prevResolved, invalid: prevInvalid, pending: prevPending } =
        calculateIssueStats(prevIssues);
      parts.push("");
      parts.push(`<details><summary>📊 Round ${round - 1} 回顾 (${prevIssues.length} 个问题)</summary>\n`);
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
