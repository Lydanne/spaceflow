import type {
  LlmMessage,
  LlmRequestOptions,
  LlmResponse,
  LlmStreamEvent,
} from "./message.interface";
import type { VerboseLevel } from "../../verbose";

export interface SessionOptions {
  systemPrompt?: string;
  model?: string;
  verbose?: VerboseLevel;
}

export interface LlmSession {
  readonly id: string;
  readonly adapterName: string;

  send(content: string, options?: LlmRequestOptions): Promise<LlmResponse>;

  sendStream(content: string, options?: LlmRequestOptions): AsyncIterable<LlmStreamEvent>;

  getHistory(): LlmMessage[];

  clearHistory(): void;

  setSystemPrompt(prompt: string): void;
}
