import type { LlmMessage, LlmRequestOptions, LlmResponse, LlmStreamEvent } from "../interfaces";
import type { VerboseLevel } from "../../verbose";

export interface LlmAdapterConfig {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  verbose?: VerboseLevel;
}

export interface LlmAdapter {
  readonly name: string;

  chat(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse>;

  chatStream(messages: LlmMessage[], options?: LlmRequestOptions): AsyncIterable<LlmStreamEvent>;

  isConfigured(): boolean;

  isSupportJsonSchema(): boolean;
}

export const LLM_ADAPTER = Symbol("LLM_ADAPTER");
