import type { VerboseLevel } from "@spaceflow/core";

export interface FileReviewPrompt {
  filename: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface ReviewPrompt {
  filePrompts: FileReviewPrompt[];
  /** 静态规则检查产生的系统问题，不经过 LLM 过滤管道，直接写入结果 */
  staticIssues?: import("../review-spec").ReviewIssue[];
}

export interface LLMReviewOptions {
  verbose?: VerboseLevel;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}
