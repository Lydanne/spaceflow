// 统一导出所有提示词

// 类型定义
export type { PromptFn, PromptContext, PromptResult } from "./types";

// JSON Schemas
export { REVIEW_SCHEMA, DELETION_IMPACT_SCHEMA, VERIFY_SCHEMA } from "./schemas";

// 代码审查提示词
export {
  buildCodeReviewSystemPrompt,
  buildFileReviewPrompt,
  type CodeReviewSystemContext,
  type FileReviewContext,
} from "./code-review";

// PR 描述生成提示词
export {
  buildPrDescriptionPrompt,
  buildPrTitlePrompt,
  type PrDescriptionContext,
  type PrTitleContext,
} from "./pr-description";

// 删除影响分析提示词
export {
  buildDeletionImpactPrompt,
  buildDeletionImpactAgentPrompt,
  buildDeletionImpactSystemPrompt,
  buildDeletionImpactUserPrompt,
  buildDeletionImpactAgentSystemPrompt,
  buildDeletionImpactAgentUserPrompt,
  type DeletionImpactContext,
} from "./deletion-impact";

// 问题验证提示词
export { buildIssueVerifyPrompt, type IssueVerifyContext } from "./issue-verify";
