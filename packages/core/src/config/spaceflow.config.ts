import { z } from "zod";
import type { LLMMode } from "../shared/llm-proxy";
import { registerPluginSchema } from "./schema-generator.service";
import { detectProvider } from "../shared/git-provider/detect-provider";

// 从 @spaceflow/shared 重导出配置工具函数
export {
  DEFAULT_SUPPORT_EDITOR,
  CONFIG_FILE_NAME,
  RC_FILE_NAME,
  deepMerge,
  getConfigPath,
  getConfigPaths,
  getEnvFilePaths,
  readConfigSync,
  writeConfigSync,
  getSupportedEditors,
  getDependencies,
  findConfigFileWithField,
  updateDependency,
  removeDependency,
} from "@spaceflow/shared";

import { DEFAULT_SUPPORT_EDITOR, readConfigSync } from "@spaceflow/shared";

// ============ 子模块配置 Schema ============

/** 从环境自动检测的默认值 */
const detected = detectProvider();

/** Git Provider 配置 Schema */
const GitProviderConfigSchema = z.object({
  provider: z
    .enum(["gitea", "github", "gitlab"])
    .default(detected.provider)
    .describe("Git Provider 类型 (github | gitea | gitlab)，未指定时自动检测"),
  serverUrl: z.string().default(detected.serverUrl).describe("Git Provider 服务器 URL"),
  token: z.string().default(detected.token).describe("Git Provider API Token"),
});

/** CI 配置 Schema */
const CiConfigSchema = z.object({
  repository: z
    .string()
    .default(process.env.GITHUB_REPOSITORY || "")
    .describe("仓库名称 (owner/repo 格式)"),
  refName: z
    .string()
    .default(process.env.GITHUB_REF_NAME || "")
    .describe("当前分支名称"),
  actor: z
    .string()
    .default(process.env.GITHUB_ACTOR || "")
    .describe("当前操作者"),
});

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

/** 飞书配置 Schema */
const FeishuConfigSchema = z.object({
  appId: z
    .string()
    .default(process.env.FEISHU_APP_ID || "")
    .describe("飞书应用 ID"),
  appSecret: z
    .string()
    .default(process.env.FEISHU_APP_SECRET || "")
    .describe("飞书应用密钥"),
  appType: z
    .enum(["self_build", "store"])
    .default((process.env.FEISHU_APP_TYPE as "self_build" | "store") || "self_build")
    .describe("应用类型"),
  domain: z
    .enum(["feishu", "lark"])
    .default((process.env.FEISHU_DOMAIN as "feishu" | "lark") || "feishu")
    .describe("域名"),
});

/** Storage 配置 Schema */
const StorageConfigSchema = z.object({
  adapter: z
    .enum(["memory", "file"])
    .default((process.env.STORAGE_ADAPTER as "memory" | "file") || "memory")
    .describe("适配器类型"),
  filePath: z.string().optional().describe("文件存储路径"),
  defaultTtl: z
    .number()
    .default(process.env.STORAGE_DEFAULT_TTL ? parseInt(process.env.STORAGE_DEFAULT_TTL, 10) : 0)
    .describe("默认过期时间（毫秒）"),
  maxKeys: z
    .number()
    .default(process.env.STORAGE_MAX_KEYS ? parseInt(process.env.STORAGE_MAX_KEYS, 10) : 0)
    .describe("最大 key 数量"),
});

// ============ 统一配置 Schema ============

/** Spaceflow 完整配置 Schema */
const SpaceflowConfigSchema = z.object({
  /** 界面语言，如 zh-CN、en */
  lang: z.string().optional().describe("界面语言，如 zh-CN、en"),
  /** 已安装的技能包注册表 */
  dependencies: z.record(z.string(), z.string()).optional().describe("已安装的技能包注册表"),
  /** 支持的编辑器列表 */
  support: z.array(z.string()).default([DEFAULT_SUPPORT_EDITOR]).describe("支持的编辑器列表"),
  /** Git Provider 配置 */
  gitProvider: z
    .preprocess((v) => v ?? {}, GitProviderConfigSchema)
    .describe("Git Provider 服务配置"),
  /** CI 配置 */
  ci: z.preprocess((v) => v ?? {}, CiConfigSchema).describe("CI 环境配置"),
  /** LLM 配置 */
  llm: z.preprocess((v) => v ?? {}, LlmConfigSchema).describe("LLM 服务配置"),
  /** 飞书配置 */
  feishu: z.preprocess((v) => v ?? {}, FeishuConfigSchema).describe("飞书 SDK 配置"),
  /** Storage 配置 */
  storage: z.preprocess((v) => v ?? {}, StorageConfigSchema).describe("存储服务配置"),
});

// 注册完整 schema（供 JSON Schema 生成使用）
registerPluginSchema({
  configKey: "spaceflow",
  schemaFactory: () => SpaceflowConfigSchema,
  description: "Spaceflow 配置",
});

// ============ 类型导出 ============

/** Spaceflow 完整配置类型 */
export type SpaceflowConfig = z.infer<typeof SpaceflowConfigSchema> & {
  /** 扩展插件配置，由各插件自行定义类型 */
  [key: string]: unknown;
};

/** Git Provider 配置类型 */
export type GitProviderConfig = z.infer<typeof GitProviderConfigSchema>;

/** CI 配置类型 */
export type CiConfig = z.infer<typeof CiConfigSchema>;

/** LLM 系统配置类型 */
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

/** Claude Code 适配器配置类型 */
export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>;

/** OpenAI 适配器配置类型 */
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

/** OpenCode 适配器配置类型 */
export type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>;

/** Gemini 适配器配置类型 */
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

/** 飞书配置类型 */
export type FeishuConfig = z.infer<typeof FeishuConfigSchema>;

/** Storage 配置类型 */
export type StorageConfig = z.infer<typeof StorageConfigSchema>;

// ============ 配置加载 ============

/**
 * 加载 spaceflow.json 配置
 * 从多级配置文件读取并合并，使用 zod 验证和填充默认值
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function loadSpaceflowConfig(cwd?: string): SpaceflowConfig {
  const fileConfig = readConfigSync(cwd);

  const result = SpaceflowConfigSchema.safeParse(fileConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Spaceflow 配置验证失败:\n${errors}`);
  }

  return {
    ...fileConfig,
    ...result.data,
  } as SpaceflowConfig;
}

/**
 * 获取 spaceflow 配置（兼容旧 API）
 * @deprecated 请使用 loadSpaceflowConfig()
 */
export function spaceflowConfig(): SpaceflowConfig {
  return loadSpaceflowConfig();
}

export type { LLMMode };
