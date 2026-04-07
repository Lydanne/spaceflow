import type { ChangedFile, VerboseLevel } from "@spaceflow/core";
import { shouldLog } from "@spaceflow/core";
import type { ReviewIssue, FileContentsMap } from "../review-spec";
import type { Severity } from "../review.config";

export const RULE_ID = "system:max-lines-per-file";
export const SPEC_FILE = "__system__";

export interface MaxLinesPerFileResult {
  staticIssues: ReviewIssue[];
  /** 超限文件名集合，需从 LLM 审查中排除 */
  skippedFiles: Set<string>;
}

export function checkMaxLinesPerFile(
  changedFiles: ChangedFile[],
  fileContents: FileContentsMap,
  rule: [number, Severity],
  round: number,
  verbose?: VerboseLevel,
): MaxLinesPerFileResult {
  const [maxLine, severity] = rule;
  const staticIssues: ReviewIssue[] = [];
  const skippedFiles = new Set<string>();

  if (maxLine <= 0) {
    return { staticIssues, skippedFiles };
  }

  for (const file of changedFiles) {
    if (file.status === "deleted" || !file.filename) continue;
    const filename = file.filename;
    const contentLines = fileContents.get(filename);
    if (!contentLines || contentLines.length <= maxLine) continue;

    if (shouldLog(verbose, 1)) {
      console.log(
        `⚠️  [system-rules/maxLinesPerFile] ${filename}: ${contentLines.length} 行超过限制 ${maxLine} 行，跳过 LLM 审查`,
      );
    }

    skippedFiles.add(filename);
    staticIssues.push({
      file: filename,
      line: "1",
      code: "",
      ruleId: RULE_ID,
      specFile: SPEC_FILE,
      reason: `文件共 ${contentLines.length} 行，超过静态规则限制 ${maxLine} 行，已跳过 LLM 审查。请考虑拆分文件或调大 staticRules.maxLinesPerFile 配置。`,
      severity,
      round,
      date: new Date().toISOString(),
    });
  }

  return { staticIssues, skippedFiles };
}
