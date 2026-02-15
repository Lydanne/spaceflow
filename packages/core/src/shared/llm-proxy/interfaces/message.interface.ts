import type { LlmJsonPut } from "../../llm-jsonput";
import type { VerboseLevel } from "../../verbose";

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmRequestOptions {
  model?: string;
  jsonSchema?: LlmJsonPut;
  stream?: boolean;
  verbose?: VerboseLevel;
  allowedTools?: string[];
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content: string;
  structuredOutput?: unknown;
  usage?: LlmUsage;
}

export type LlmStreamEvent =
  | { type: "text"; content: string }
  | {
      type: "tool_use";
      name: string;
      input: unknown;
      status?: string;
      output?: string;
      title?: string;
    }
  | { type: "thought"; content: string }
  | { type: "result"; response: LlmResponse }
  | { type: "error"; message: string }
  | { type: "agent"; name: string; source?: string }
  | { type: "subtask"; agent: string; prompt: string; description: string }
  | { type: "step_start"; snapshot?: string }
  | { type: "step_finish"; reason: string; tokens?: unknown; cost?: number }
  | { type: "reasoning"; content: string };
