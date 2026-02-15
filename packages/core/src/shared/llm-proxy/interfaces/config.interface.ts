export interface ClaudeAdapterConfig {
  model?: string;
  baseUrl?: string;
  authToken?: string;
}

export interface OpenAIAdapterConfig {
  model: string;
  baseUrl?: string;
  apiKey: string;
}

export interface OpenCodeAdapterConfig {
  model?: string;
  /** OpenCode 服务地址，默认 http://localhost:4096 */
  serverUrl?: string;
  /** 云厂商 API 地址（会动态写入 opencode.json 配置） */
  baseUrl?: string;
  apiKey?: string;
  providerID?: string;
}

export type LLMMode = "claude-code" | "openai" | "gemini" | "open-code";

export interface LlmProxyConfig {
  defaultAdapter?: LLMMode;
  claudeCode?: ClaudeAdapterConfig;
  openai?: OpenAIAdapterConfig;
  openCode?: OpenCodeAdapterConfig;
}

export const LLM_PROXY_CONFIG = Symbol("LLM_PROXY_CONFIG");
