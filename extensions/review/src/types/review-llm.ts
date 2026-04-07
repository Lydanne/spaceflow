import type { VerboseLevel } from "@spaceflow/core";

export interface FileReviewPrompt {
  filename: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface ReviewPrompt {
  filePrompts: FileReviewPrompt[];
}

export interface LLMReviewOptions {
  verbose?: VerboseLevel;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}
