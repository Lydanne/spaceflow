import { Injectable } from "@nestjs/common";
import { ReviewResult, ReviewStats } from "../review-spec/types";
import { JsonFormatter, MarkdownFormatter, TerminalFormatter } from "./formatters";
import { ParsedReport, ReportFormat, ReportOptions, ReviewReportFormatter } from "./types";

@Injectable()
export class ReviewReportService {
  private readonly markdownFormatter = new MarkdownFormatter();
  private readonly terminalFormatter = new TerminalFormatter();

  private formatters: Map<ReportFormat, ReviewReportFormatter> = new Map([
    ["markdown", this.markdownFormatter],
    ["json", new JsonFormatter()],
    ["terminal", this.terminalFormatter],
  ]);

  format(result: ReviewResult, format: ReportFormat = "markdown", options?: ReportOptions): string {
    const formatter = this.formatters.get(format);
    if (!formatter) {
      throw new Error(`Unsupported format: ${format}`);
    }
    return formatter.format(result, options);
  }

  formatMarkdown(result: ReviewResult, options?: ReportOptions): string {
    return this.format(result, "markdown", options);
  }

  formatJson(result: ReviewResult, options?: ReportOptions): string {
    return this.format(result, "json", options);
  }

  formatTerminal(result: ReviewResult, options?: ReportOptions): string {
    return this.format(result, "terminal", options);
  }

  parseMarkdown(content: string): ParsedReport | null {
    return this.markdownFormatter.parse(content);
  }

  registerFormatter(format: ReportFormat, formatter: ReviewReportFormatter): void {
    this.formatters.set(format, formatter);
  }

  /**
   * 格式化统计信息为终端输出
   */
  formatStatsTerminal(stats: ReviewStats, prNumber?: number): string {
    return this.terminalFormatter.formatStats(stats, prNumber);
  }

  /**
   * 格式化统计信息为 Markdown
   */
  formatStatsMarkdown(stats: ReviewStats, prNumber?: number): string {
    return this.markdownFormatter.formatStats(stats, prNumber);
  }
}
