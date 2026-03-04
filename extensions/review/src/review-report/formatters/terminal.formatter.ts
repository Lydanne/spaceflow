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

    // 🟢 已修复 | 🔴 待处理error | 🟡 待处理warn | ⚪ 已解决(非代码修复)
    const issuesByFile = new Map<
      string,
      {
        fixed: number;
        errorCount: number;
        warnCount: number;
        resolved: number;
        total: number;
      }
    >();
    for (const issue of issues) {
      if (issue.valid === "false") continue;
      const stats = issuesByFile.get(issue.file) || {
        total: 0,
        fixed: 0,
        errorCount: 0,
        warnCount: 0,
        resolved: 0,
      };
      stats.total++;
      if (issue.fixed) {
        stats.fixed++;
      }
      if (issue.resolved) {
        stats.resolved++;
      }
      if (issue.severity === "error") {
        stats.errorCount++;
      } else {
        stats.warnCount++;
      }
      issuesByFile.set(issue.file, stats);
    }

    // 汇总统计
    let totalAll = 0;
    let totalFixed = 0;
    let totalPendingErrors = 0;
    let totalPendingWarns = 0;
    let totalResolved = 0;

    const lines: string[] = [];
    for (const fileSummary of summaries) {
      const stats = issuesByFile.get(fileSummary.file) || {
        total: 0,
        fixed: 0,
        errorCount: 0,
        warnCount: 0,
        resolved: 0,
      };
      totalAll += stats.total;
      totalFixed += stats.fixed;
      totalPendingErrors += stats.errorCount;
      totalPendingWarns += stats.warnCount;
      totalResolved += stats.resolved;

      const totalText = stats.total > 0 ? `${BOLD}${stats.total} 问题${RESET}` : "";
      const fixedText = stats.fixed > 0 ? `${GREEN}🟢 ${stats.fixed} 已修复${RESET}` : "";
      const errorText = stats.errorCount > 0 ? `${RED}🔴 ${stats.errorCount} error${RESET}` : "";
      const warnText = stats.warnCount > 0 ? `${YELLOW}🟡 ${stats.warnCount} warn${RESET}` : "";
      const resolvedText = stats.resolved > 0 ? `⚪ ${stats.resolved} 已解决` : "";
      const statsText = [totalText, fixedText, errorText, warnText, resolvedText]
        .filter(Boolean)
        .join(" / ");

      if (statsText) {
        lines.push(`${BOLD}${fileSummary.file}${RESET} (${statsText}): ${fileSummary.summary}`);
      } else {
        lines.push(`${BOLD}${fileSummary.file}${RESET}: ${fileSummary.summary}`);
      }
    }

    // 添加汇总行
    if (summaries.length > 1) {
      lines.push("");
      const summaryParts = [`${BOLD}总计: ${totalAll} 问题${RESET}`];
      if (totalFixed > 0) summaryParts.push(`${GREEN}🟢 ${totalFixed} 已修复${RESET}`);
      if (totalPendingErrors > 0) summaryParts.push(`${RED}🔴 ${totalPendingErrors} error${RESET}`);
      if (totalPendingWarns > 0) summaryParts.push(`${YELLOW}🟡 ${totalPendingWarns} warn${RESET}`);
      if (totalResolved > 0) summaryParts.push(`⚪ ${totalResolved} 已解决`);
      lines.push(summaryParts.join(" / "));
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
    lines.push(`   ${GREEN}🟢 已修复: ${stats.fixed}${RESET}`);
    lines.push(`   ⚪ 已解决: ${stats.resolved}`);
    lines.push(`   ${RED}❌ 无效: ${stats.invalid}${RESET}`);
    lines.push(`   ${YELLOW}⚠️  待处理: ${stats.pending}${RESET}`);
    lines.push(`   修复率: ${stats.fixRate}%`);
    lines.push(`   解决率: ${stats.resolveRate}%`);
    return lines.join("\n");
  }
}
