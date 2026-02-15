import { ReviewIssue, ReviewResult, ReviewStats } from "../review-spec/types";

export type ReportFormat = "markdown" | "json" | "terminal";

export interface ReportOptions {
  prNumber?: number;
  includeReanalysisCheckbox?: boolean;
  includeJsonData?: boolean;
  reviewCommentMarker?: string;
}

export interface ParsedReport {
  /** 完整的 ReviewResult 数据 */
  result: ReviewResult;
  /** 是否请求重新分析 */
  hasReanalysisRequest?: boolean;
}

export interface ReviewReportFormatter {
  format(result: ReviewResult, options?: ReportOptions): string;
  formatStats?(stats: ReviewStats, prNumber?: number): string;
}

export interface ReviewReportParser {
  parse(content: string): ParsedReport | null;
}
