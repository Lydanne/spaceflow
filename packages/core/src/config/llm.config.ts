import { z } from "zod";
import { createConfigLoader } from "./config-loader";

const schemaFactory = () => {
  /** Claude Code 适配器配置 Schema */
  const ClaudeCodeConfigSchema = z.object({
    baseUrl: z
      .string()
      .default(process.env.CLAUDE_CODE_BASE_URL || "")
      .describe("API 基础 URL"),
    authToken: z
      .string()
      .default(process.env.CLAUDE_CODE_AUTH_TOKEN || "")
      .describe("认证令牌"),
    model: z
      .string()
      .default(process.env.CLAUDE_CODE_MODEL || "claude-sonnet-4-5")
      .describe("模型名称"),
    hasCompletedOnboarding: z.boolean().optional().describe("是否已完成 Claude Code 引导流程"),
  });

  /** OpenAI 适配器配置 Schema */
  const OpenAIConfigSchema = z.object({
    baseUrl: z
      .string()
      .default(process.env.OPENAI_BASE_URL || "")
      .describe("API 基础 URL"),
    apiKey: z
      .string()
      .default(process.env.OPENAI_API_KEY || "")
      .describe("API Key"),
    model: z
      .string()
      .default(process.env.OPENAI_MODEL || "gpt-4o")
      .describe("模型名称"),
  });

  /** OpenCode 适配器配置 Schema */
  const OpenCodeConfigSchema = z.object({
    serverUrl: z
      .string()
      .default(process.env.OPENCODE_SERVER_URL || "http://localhost:4096")
      .describe("服务器 URL"),
    baseUrl: z
      .string()
      .default(process.env.OPENCODE_BASE_URL || "")
      .describe("API 基础 URL"),
    apiKey: z
      .string()
      .default(process.env.OPENCODE_API_KEY || "")
      .describe("API Key"),
    providerID: z
      .string()
      .default(process.env.OPENCODE_PROVIDER_ID || "openai")
      .describe("Provider ID"),
    model: z
      .string()
      .default(process.env.OPENCODE_MODEL || "")
      .describe("模型名称"),
  });

  /** Gemini 适配器配置 Schema */
  const GeminiConfigSchema = z.object({
    baseUrl: z
      .string()
      .default(process.env.GEMINI_BASE_URL || "")
      .describe("API 基础 URL"),
    apiKey: z
      .string()
      .default(process.env.GEMINI_API_KEY || "")
      .describe("API Key"),
    model: z
      .string()
      .default(process.env.GEMINI_MODEL || "")
      .describe("模型名称"),
  });

  /** LLM 配置 Schema */
  const LlmConfigSchema = z.object({
    claudeCode: z
      .preprocess((v) => v ?? {}, ClaudeCodeConfigSchema)
      .describe("Claude Code 适配器配置"),
    openai: z.preprocess((v) => v ?? {}, OpenAIConfigSchema).describe("OpenAI 适配器配置"),
    openCode: z.preprocess((v) => v ?? {}, OpenCodeConfigSchema).describe("OpenCode 适配器配置"),
    gemini: z.preprocess((v) => v ?? {}, GeminiConfigSchema).describe("Gemini 适配器配置"),
  });

  return LlmConfigSchema;
};

/** LLM 系统配置类型 */
export type LlmConfig = z.infer<ReturnType<typeof schemaFactory>>;

/** Claude Code 适配器配置类型 */
export type ClaudeCodeConfig = z.infer<LlmConfig["claudeCode"]>;

/** OpenAI 适配器配置类型 */
export type OpenAIConfig = z.infer<LlmConfig["openai"]>;

/** OpenCode 适配器配置类型 */
export type OpenCodeConfig = z.infer<LlmConfig["openCode"]>;

/** Gemini 适配器配置类型 */
export type GeminiConfig = z.infer<LlmConfig["gemini"]>;

export const llmConfig = createConfigLoader({
  configKey: "llm",
  schemaFactory,
  description: "LLM 服务配置",
});
