import type { ChangedFile, VerboseLevel } from "@spaceflow/core";
import type { ReviewIssue, FileContentsMap } from "../review-spec";
import type { SystemRules } from "../review.config";
import { checkMaxLinesPerFile } from "./max-lines-per-file";

export {
  RULE_ID as SYSTEM_RULE_MAX_LINES,
  SPEC_FILE as SYSTEM_SPEC_FILE,
} from "./max-lines-per-file";

export interface ApplyStaticRulesResult {
  staticIssues: ReviewIssue[];
  /** 被静态规则排除的文件名集合，不应再进入 LLM 审查 */
  skippedFiles: Set<string>;
}

/**
 * 对变更文件执行所有已启用的静态规则检查。
 * 返回系统问题列表和需要跳过 LLM 审查的文件集合。
 */
export function applyStaticRules(
  changedFiles: ChangedFile[],
  fileContents: FileContentsMap,
  staticRules: SystemRules | undefined,
  round: number,
  verbose?: VerboseLevel,
): ApplyStaticRulesResult {
  const staticIssues: ReviewIssue[] = [];
  const skippedFiles = new Set<string>();

  if (!staticRules) {
    return { staticIssues, skippedFiles };
  }

  if (staticRules.maxLinesPerFile) {
    const result = checkMaxLinesPerFile(
      changedFiles,
      fileContents,
      staticRules.maxLinesPerFile,
      round,
      verbose,
    );
    staticIssues.push(...result.staticIssues);
    result.skippedFiles.forEach((f) => skippedFiles.add(f));
  }

  return { staticIssues, skippedFiles };
}
