import { ReviewResult } from "../../review-spec/types";
import { ReportOptions, ReviewReportFormatter } from "../types";

export class JsonFormatter implements ReviewReportFormatter {
  format(result: ReviewResult, _options: ReportOptions = {}): string {
    return JSON.stringify(result, null, 2);
  }
}
