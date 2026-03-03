import { extname } from "path";
import {
  FileSummary,
  ReviewIssue,
  ReviewResult,
  ReviewStats,
  SEVERITY_EMOJI,
} from "../../review-spec/types";
import { ParsedReport, ReportOptions, ReviewReportFormatter, ReviewReportParser } from "../types";
import { DeletionImpactFormatter } from "./deletion-impact.formatter";

const REVIEW_DATA_START = "<!-- spaceflow-review-data-start -->";
const REVIEW_DATA_END = "<!-- spaceflow-review-data-end -->";

function formatDateToUTC8(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export class MarkdownFormatter implements ReviewReportFormatter, ReviewReportParser {
  static clearReviewData(content: string, replaceData: string): string {
    return content
      .replace(new RegExp(`${REVIEW_DATA_START}[\\s\\S]*?${REVIEW_DATA_END}`, "g"), replaceData)
      .trim();
  }
  private readonly deletionImpactFormatter = new DeletionImpactFormatter();

  private formatIssueList(issues: ReviewIssue[]): string {
    const lines: string[] = [];
    for (const issue of issues) {
      const severityEmoji = SEVERITY_EMOJI[issue.severity] || SEVERITY_EMOJI.error;
      lines.push(`### ${issue.fixed ? "🟢" : severityEmoji} ${issue.file}:${issue.line}\n`);
      lines.push(`- **问题**: ${issue.reason}`);
      lines.push(`- **规则**: \`${issue.ruleId}\` (来自 \`${issue.specFile}\`)`);
      if (issue.commit) {
        lines.push(`- **Commit**: ${issue.commit}`);
      }
      lines.push(`- **开发人员**: ${issue.author ? "@" + issue.author.login : "未知"}`);
      if (issue.date) {
        lines.push(`- **发现时间**: ${formatDateToUTC8(issue.date)}`);
      }
      if (issue.fixed) {
        const fixedByStr = issue.fixedBy?.login ? ` (by @${issue.fixedBy.login})` : "";
        lines.push(`- **修复时间**: ${formatDateToUTC8(issue.fixed)}${fixedByStr}`);
      }
      if (issue.resolved) {
        const resolvedByStr = issue.resolvedBy?.login ? ` (by @${issue.resolvedBy.login})` : "";
        lines.push(`- **解决时间**: ${formatDateToUTC8(issue.resolved)}${resolvedByStr}`);
      }
      if (issue.suggestion) {
        const ext = extname(issue.file).slice(1) || "";
        const cleanSuggestion = issue.suggestion.replace(/```/g, "//").trim();
        const lineCount = cleanSuggestion.split("\n").length;
        lines.push("- **建议**:");
        if (lineCount < 4) {
          lines.push(`\`\`\`${ext}`);
          lines.push(cleanSuggestion);
          lines.push("```");
        } else {
          lines.push("<details>");
          lines.push("<summary>💡 查看建议</summary>\n");
          lines.push(`\`\`\`${ext}`);
          lines.push(cleanSuggestion);
          lines.push("```");
          lines.push("\n</details>");
        }
      }
      // 渲染消息（reactions 统计 + replies 详情，合并到一个折叠块）
      const hasReactions = issue.reactions && issue.reactions.length > 0;
      const hasReplies = issue.replies && issue.replies.length > 0;
      if (hasReactions || hasReplies) {
        const reactionCount = hasReactions
          ? issue.reactions!.reduce((sum, r) => sum + r.users.length, 0)
          : 0;
        const replyCount = hasReplies ? issue.replies!.length : 0;
        const totalCount = reactionCount + replyCount;
        lines.push("<details>");
        lines.push(`<summary>💬 消息 (${totalCount} 条)</summary>\n`);
        // 先显示 reactions 统计（格式：👎(1) 👍(2)）
        if (hasReactions) {
          const reactionStats = issue.reactions!.map((r) => {
            const emoji = this.getReactionEmoji(r.content);
            return `${emoji}(${r.users.length})`;
          });
          lines.push(`> ${reactionStats.join(" ")}`);
        }
        // 再显示 replies 详情
        if (hasReplies) {
          for (const reply of issue.replies!) {
            const time = reply.createdAt ? formatDateToUTC8(reply.createdAt) : "";
            lines.push(`> @${reply.user.login} ${time ? `(${time})` : ""}:`);
            lines.push(`>     ${reply.body.split("\n").join("\n>     ")}`);
            lines.push("");
          }
        }
        lines.push("</details>");
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  /** 将 reaction content 转换为 emoji */
  private getReactionEmoji(content: string): string {
    const emojiMap: Record<string, string> = {
      "+1": "👍",
      "-1": "👎",
      laugh: "😄",
      hooray: "🎉",
      confused: "😕",
      heart: "❤️",
      rocket: "🚀",
      eyes: "👀",
    };
    return emojiMap[content] || content;
  }

  private formatFileSummaries(summaries: FileSummary[], issues: ReviewIssue[]): string {
    if (summaries.length === 0) {
      return "没有需要审查的文件";
    }

    // 🟢 已修复 | 🔴 待处理error | 🟡 待处理warn | ⚪ 已解决(非代码修复)
    const issuesByFile = new Map<
      string,
      { fixed: number; pendingErrors: number; pendingWarns: number; resolved: number }
    >();
    for (const issue of issues) {
      if (issue.valid === "false") continue;
      const stats = issuesByFile.get(issue.file) || {
        fixed: 0,
        pendingErrors: 0,
        pendingWarns: 0,
        resolved: 0,
      };
      if (issue.fixed) {
        stats.fixed++;
      } else if (issue.resolved) {
        stats.resolved++;
      } else if (issue.severity === "error") {
        stats.pendingErrors++;
      } else {
        stats.pendingWarns++;
      }
      issuesByFile.set(issue.file, stats);
    }

    const lines: string[] = [];
    lines.push("| 文件 | 总数 | 🟢 | 🔴 | 🟡 | ⚪ |");
    lines.push("|------|------|----|----|----|-----|");

    // 汇总统计
    let totalAll = 0;
    let totalFixed = 0;
    let totalPendingErrors = 0;
    let totalPendingWarns = 0;
    let totalResolved = 0;

    const fileSummaryLines: string[] = [];
    for (const fileSummary of summaries) {
      const stats = issuesByFile.get(fileSummary.file) || {
        fixed: 0,
        pendingErrors: 0,
        pendingWarns: 0,
        resolved: 0,
      };
      const fileTotal = stats.fixed + stats.pendingErrors + stats.pendingWarns + stats.resolved;
      totalAll += fileTotal;
      totalFixed += stats.fixed;
      totalPendingErrors += stats.pendingErrors;
      totalPendingWarns += stats.pendingWarns;
      totalResolved += stats.resolved;

      lines.push(
        `| \`${fileSummary.file}\` | ${fileTotal} | ${stats.fixed} | ${stats.pendingErrors} | ${stats.pendingWarns} | ${stats.resolved} |`,
      );

      // 收集问题总结用于折叠块展示
      if (fileSummary.summary.trim()) {
        fileSummaryLines.push(`### 💡 \`${fileSummary.file}\``);
        fileSummaryLines.push(`${fileSummary.summary.trim()}`);
        fileSummaryLines.push("");
      }
    }

    // 添加汇总行
    if (summaries.length > 1) {
      lines.push(
        `| **总计** | **${totalAll}** | **${totalFixed}** | **${totalPendingErrors}** | **${totalPendingWarns}** | **${totalResolved}** |`,
      );
    }

    // 问题总结放到折叠块中
    if (fileSummaryLines.length > 0) {
      lines.push("");
      lines.push("<details>");
      lines.push("<summary>📝 问题总结</summary>\n");
      lines.push(...fileSummaryLines);
      lines.push("</details>");
    }

    return lines.join("\n");
  }

  parse(content: string): ParsedReport | null {
    const startIndex = content.indexOf(REVIEW_DATA_START);
    const endIndex = content.indexOf(REVIEW_DATA_END);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      return null;
    }

    const dataStart = startIndex + REVIEW_DATA_START.length;
    const encodedContent = content.slice(dataStart, endIndex).trim();

    try {
      // 尝试 Base64 解码，如果失败则尝试直接解析 JSON（兼容旧格式）
      let jsonContent: string;
      try {
        jsonContent = Buffer.from(encodedContent, "base64").toString("utf-8");
        // 验证解码后是否为有效 JSON
        JSON.parse(jsonContent);
      } catch {
        // Base64 解码失败或解码后不是有效 JSON，尝试直接解析（旧格式）
        jsonContent = encodedContent;
      }
      const parsed = JSON.parse(jsonContent);
      const hasReanalysisRequest = content.includes("- [x]");

      // 新格式：完整的 ReviewResult
      return {
        result: parsed as ReviewResult,
        hasReanalysisRequest,
      };
    } catch {
      return null;
    }
  }

  format(result: ReviewResult, options: ReportOptions = {}): string {
    const {
      prNumber,
      includeReanalysisCheckbox = true,
      includeJsonData = true,
      reviewCommentMarker,
    } = options;

    const lines: string[] = [];

    if (reviewCommentMarker) {
      lines.push(reviewCommentMarker);
    }

    const validIssues = result.issues.filter((issue) => issue.valid !== "false");
    const invalidIssues = result.issues.filter((issue) => issue.valid === "false");

    lines.push("# 🤖 AI 代码审查报告\n");

    // 输出统计信息（如果有）
    if (result.stats) {
      lines.push(this.formatStats(result.stats));
      lines.push("");
    }

    // 输出 PR 功能描述
    if (result.description) {
      lines.push("## 📋 功能概述\n");
      // 将 description 中的标题级别降低（h1->h3, h2->h4, h3->h5 等）
      const adjustedDescription = result.description.replace(/^(#{1,4})\s/gm, "$1##  ");
      lines.push(adjustedDescription);
      lines.push("");
    }

    lines.push("## 📝 新增代码分析\n");
    lines.push("### 📊 审查概览\n");
    lines.push(this.formatFileSummaries(result.summary, validIssues));
    lines.push("<details>");
    lines.push("<summary>📋 点击查看详情</summary>\n");
    lines.push("### 🐛 详细问题\n");
    if (validIssues.length === 0 && invalidIssues.length === 0) {
      lines.push("✅ **未发现问题**\n");
    } else {
      if (validIssues.length === 0) {
        lines.push("✅ **未发现有效问题**\n");
      } else {
        lines.push(`⚠️ **发现 ${validIssues.length} 个问题**\n`);
        lines.push(this.formatIssueList(validIssues));
      }

      if (invalidIssues.length > 0) {
        lines.push("\n<details>");
        lines.push(`<summary>🚫 无效问题 (${invalidIssues.length} 个)</summary>\n`);
        lines.push(this.formatIssueList(invalidIssues));
        lines.push("\n</details>");
      }
    }
    lines.push("\n</details>");

    // if (includeReanalysisCheckbox) {
    //   lines.push("\n---");
    //   lines.push("<details>");
    //   lines.push("<summary>🔄 重新分析</summary>\n");
    //   if (prNumber) {
    //     lines.push("- [ ] 勾选此复选框后保存评论，将触发重新分析");
    //   }
    //   lines.push("\n</details>");
    // }

    // 输出删除代码影响分析报告
    if (result.deletionImpact) {
      lines.push("\n---\n");
      lines.push(this.deletionImpactFormatter.format(result.deletionImpact, { includeJsonData }));
    }

    if (includeJsonData) {
      lines.push("");
      lines.push("<details>");
      lines.push("<summary>📊 审查数据 (JSON)</summary>\n");
      lines.push(REVIEW_DATA_START);
      lines.push(Buffer.from(JSON.stringify(result)).toString("base64"));
      lines.push(REVIEW_DATA_END);
      lines.push("\n</details>");
    }

    return lines.join("\n");
  }

  formatStats(stats: ReviewStats, prNumber?: number): string {
    const title = prNumber ? `PR #${prNumber} Review 状态统计` : "Review 状态统计";
    const lines = [`## 📊 ${title}\n`, `| 指标 | 数量 |`, `|------|------|`];
    lines.push(`| 总问题数 | ${stats.total} |`);
    lines.push(`| 🟢 已修复 | ${stats.fixed} |`);
    lines.push(`| ⚪ 已解决 | ${stats.resolved} |`);
    lines.push(`| ❌ 无效 | ${stats.invalid} |`);
    lines.push(`| ⚠️ 待处理 | ${stats.pending} |`);
    lines.push(`| 修复率 | ${stats.fixRate}% |`);
    lines.push(`| 解决率 | ${stats.resolveRate}% |`);
    return lines.join("\n");
  }
}
