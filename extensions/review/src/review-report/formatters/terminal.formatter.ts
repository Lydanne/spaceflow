import { extname } from "path";
import {
  FileSummary,
  ReviewIssue,
  ReviewResult,
  ReviewStats,
  Severity,
} from "../../review-spec/types";
import { ReportOptions, ReviewReportFormatter } from "../types";

const SEVERITY_COLORS: Record<Severity, string> = {
  off: "\x1b[90m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

export class TerminalFormatter implements ReviewReportFormatter {
  private formatFileSummaries(summaries: FileSummary[], issues: ReviewIssue[]): string {
    if (summaries.length === 0) {
      return "没有需要审查的文件";
    }

    const issuesByFile = new Map<string, { resolved: number; errors: number; warns: number }>();
    for (const issue of issues) {
      const stats = issuesByFile.get(issue.file) || { resolved: 0, errors: 0, warns: 0 };
      if (issue.fixed) {
        stats.resolved++;
      } else if (issue.severity === "error") {
        stats.errors++;
      } else {
        stats.warns++;
      }
      issuesByFile.set(issue.file, stats);
    }

    const lines: string[] = [];
    for (const fileSummary of summaries) {
      const stats = issuesByFile.get(fileSummary.file) || { resolved: 0, errors: 0, warns: 0 };
      const resolvedText = stats.resolved > 0 ? `${GREEN}✅ ${stats.resolved} 已解决${RESET}` : "";
      const errorText = stats.errors > 0 ? `${RED}🔴 ${stats.errors} error${RESET}` : "";
      const warnText = stats.warns > 0 ? `${YELLOW}🟡 ${stats.warns} warn${RESET}` : "";
      const statsText = [resolvedText, errorText, warnText].filter(Boolean).join(" / ");

      if (statsText) {
        lines.push(`${BOLD}${fileSummary.file}${RESET} (${statsText}): ${fileSummary.summary}`);
      } else {
        lines.push(`${BOLD}${fileSummary.file}${RESET}: ${fileSummary.summary}`);
      }
    }

    return lines.join("\n");
  }

  format(result: ReviewResult, _options: ReportOptions = {}): string {
    const lines: string[] = [];

    lines.push("");
    lines.push(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    lines.push(
      `${BOLD}${CYAN}                    🤖 AI 代码审查报告                      ${RESET}`,
    );
    lines.push(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    lines.push("");

    const issues = result.issues;

    if (issues.length === 0) {
      lines.push(`${GREEN}✅ 未发现问题${RESET}`);
      lines.push("");
      lines.push(this.formatFileSummaries(result.summary, []));
    } else {
      lines.push(`${YELLOW}⚠️  发现 ${issues.length} 个问题${RESET}`);
      lines.push("");

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const color = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.error;
        const severityLabel = issue.severity.toUpperCase();

        lines.push(`${DIM}───────────────────────────────────────────────────────────${RESET}`);
        lines.push(`${BOLD}[${i + 1}/${issues.length}]${RESET} ${color}${severityLabel}${RESET}`);
        lines.push(`${BOLD}📍 位置:${RESET} ${issue.file}:${issue.line}`);
        lines.push(`${BOLD}📋 规则:${RESET} ${issue.ruleId} ${DIM}(${issue.specFile})${RESET}`);
        lines.push(`${BOLD}❓ 问题:${RESET} ${issue.reason}`);

        if (issue.commit) {
          lines.push(`${BOLD}📝 Commit:${RESET} ${issue.commit}`);
        }

        if (issue.suggestion) {
          const ext = extname(issue.file).slice(1) || "";
          lines.push(`${BOLD}💡 建议:${RESET}`);
          lines.push(`${DIM}--- ${ext} ---${RESET}`);
          lines.push(issue.suggestion);
          lines.push(`${DIM}------------${RESET}`);
        }

        lines.push("");
      }

      lines.push(`${DIM}───────────────────────────────────────────────────────────${RESET}`);
      lines.push("");
      lines.push(`${BOLD}📝 总结${RESET}`);
      lines.push(this.formatFileSummaries(result.summary, issues));
    }

    lines.push("");
    lines.push(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    lines.push("");

    return lines.join("\n");
  }

  formatStats(stats: ReviewStats, prNumber?: number): string {
    const title = prNumber ? `PR #${prNumber} Review 状态统计` : "Review 状态统计";
    const lines = [`\n${BOLD}${CYAN}📊 ${title}:${RESET}`];
    lines.push(`   总问题数: ${stats.total}`);
    lines.push(`   ${GREEN}✅ 已修复: ${stats.fixed}${RESET}`);
    lines.push(`   ${GREEN}🟢 已解决: ${stats.resolved}${RESET}`);
    lines.push(`   ${RED}❌ 无效: ${stats.invalid}${RESET}`);
    lines.push(`   ${YELLOW}⚠️  待处理: ${stats.pending}${RESET}`);
    lines.push(`   修复率: ${stats.fixRate}%`);
    lines.push(`   解决率: ${stats.resolveRate}%`);
    return lines.join("\n");
  }
}
