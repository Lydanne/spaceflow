import { ReviewIssue, ReviewResult, ReviewStats } from "./review-spec";
import { PullRequestModel } from "./pull-request-model";

export const REVIEW_COMMENT_MARKER = "<!-- spaceflow-review -->";
export const REVIEW_LINE_COMMENTS_MARKER = "<!-- spaceflow-review-lines -->";

/**
 * 从评论 body 中提取 issue key（AI 行级评论末尾的 HTML 注释标记）
 * 格式：`<!-- issue-key: file:line:ruleId -->`
 * 返回 null 表示非 AI 评论（即用户真实回复）
 */
export function extractIssueKeyFromBody(body: string): string | null {
  const match = body.match(/<!-- issue-key: (.+?) -->/);
  return match ? match[1] : null;
}

/**
 * 判断评论是否为 AI 生成的评论（非用户真实回复）
 * 除 issue-key 标记外，还通过结构化格式特征识别
 */
export function isAiGeneratedComment(body: string): boolean {
  if (!body) return false;
  // 含 issue-key 标记
  if (body.includes("<!-- issue-key:")) return true;
  // 含 AI 评论的结构化格式特征（同时包含「规则」和「文件」字段）
  if (body.includes("- **规则**:") && body.includes("- **文件**:")) return true;
  return false;
}

export function generateIssueKey(issue: ReviewIssue): string {
  return `${issue.file}:${issue.line}:${issue.ruleId}`;
}

/**
 * 同步评论回复到对应的 issues
 * review 评论回复是通过同一个 review 下的后续评论实现的
 *
 * 通过 AI 评论 body 中嵌入的 issue key 精确匹配 issue：
 * - 含 issue key 的评论是 AI 自身评论，过滤掉不作为回复
 * - 不含 issue key 但匹配 AI 格式特征的评论也视为 AI 评论，过滤掉
 * - 其余评论是用户真实回复，归到其前面最近的 AI 评论对应的 issue
 */
export async function syncRepliesToIssues(
  reviewComments: {
    id?: number;
    path?: string;
    position?: number;
    body?: string;
    user?: { id?: number; login?: string };
    created_at?: string;
  }[],
  result: ReviewResult,
  lineMatchesPosition: (issueLine: string, position?: number) => boolean,
): Promise<void> {
  try {
    // 构建 issue key → issue 的映射，用于快速查找
    const issueByKey = new Map<string, ReviewResult["issues"][0]>();
    for (const issue of result.issues) {
      issueByKey.set(generateIssueKey(issue), issue);
    }
    // 按文件路径和行号分组评论
    const commentsByLocation = new Map<string, typeof reviewComments>();
    for (const comment of reviewComments) {
      if (!comment.path || !comment.position) continue;
      const key = `${comment.path}:${comment.position}`;
      const comments = commentsByLocation.get(key) || [];
      comments.push(comment);
      commentsByLocation.set(key, comments);
    }
    // 遍历每个位置的评论
    for (const [, comments] of commentsByLocation) {
      if (comments.length <= 1) continue;
      // 按创建时间排序
      comments.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });
      // 遍历评论，用 issue key 精确匹配
      let lastIssueKey: string | null = null;
      for (const comment of comments) {
        const commentBody = comment.body || "";
        const issueKey = extractIssueKeyFromBody(commentBody);
        if (issueKey) {
          // AI 自身评论（含 issue-key），记录 issue key 但不作为回复
          lastIssueKey = issueKey;
          continue;
        }
        // 跳过不含 issue-key 但匹配 AI 格式特征的评论（如其他轮次的 bot 评论）
        if (isAiGeneratedComment(commentBody)) {
          continue;
        }
        // 用户真实回复，通过前面最近的 AI 评论的 issue key 精确匹配
        let matchedIssue = lastIssueKey ? (issueByKey.get(lastIssueKey) ?? null) : null;
        // 回退：如果 issue key 匹配失败，使用 path:position 匹配
        if (!matchedIssue) {
          matchedIssue =
            result.issues.find(
              (issue) =>
                issue.file === comment.path && lineMatchesPosition(issue.line, comment.position),
            ) ?? null;
        }
        if (!matchedIssue) continue;
        // 追加回复（而非覆盖，同一 issue 可能有多条用户回复）
        if (!matchedIssue.replies) {
          matchedIssue.replies = [];
        }
        matchedIssue.replies.push({
          user: {
            id: comment.user?.id?.toString(),
            login: comment.user?.login || "unknown",
          },
          body: comment.body || "",
          createdAt: comment.created_at || "",
        });
      }
    }
  } catch (error) {
    console.warn("⚠️ 同步评论回复失败:", error);
  }
}

/**
 * 删除已有的 AI review（通过 marker 识别）
 * - 删除行级评论的 PR Review（带 REVIEW_LINE_COMMENTS_MARKER）
 * - 删除主评论的 Issue Comment（带 REVIEW_COMMENT_MARKER）
 */
export async function deleteExistingAiReviews(pr: PullRequestModel): Promise<void> {
  let deletedCount = 0;
  // 删除行级评论的 PR Review
  try {
    const reviews = await pr.getReviews();
    const aiReviews = reviews.filter(
      (r) =>
        r.body?.includes(REVIEW_LINE_COMMENTS_MARKER) || r.body?.includes(REVIEW_COMMENT_MARKER),
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
  if (deletedCount > 0) {
    console.log(`🗑️ 已删除 ${deletedCount} 个旧的 AI review`);
  }
}

/**
 * 计算问题状态统计
 */
export function calculateIssueStats(issues: ReviewIssue[]): ReviewStats {
  const total = issues.length;
  const validIssue = issues.filter((i) => i.valid !== "false");
  const validTotal = validIssue.length;
  const fixed = validIssue.filter((i) => i.fixed).length;
  const resolved = validIssue.filter((i) => i.resolved && !i.fixed).length;
  const invalid = total - validTotal;
  const pending = validTotal - fixed - resolved;
  const fixRate = validTotal > 0 ? Math.round((fixed / validTotal) * 100 * 10) / 10 : 0;
  const resolveRate = validTotal > 0 ? Math.round((resolved / validTotal) * 100 * 10) / 10 : 0;
  return { total, validTotal, fixed, resolved, invalid, pending, fixRate, resolveRate };
}
