// ============ 插件系统 ============
export * from "./extension-system";

// ============ 基础能力模块 ============
// Git Provider - 多平台 Git 托管 API 操作（GitHub、Gitea、GitLab）
export * from "./shared/git-provider";

// Git SDK - Git 命令操作
export * from "./shared/git-sdk";

// LLM Proxy - 多 LLM 适配器
export * from "./shared/llm-proxy";

// Feishu SDK - 飞书 API 操作
export * from "./shared/feishu-sdk";

// Storage - 存储服务
export * from "./shared/storage";

// Claude Setup - Claude Agent 配置
export * from "./shared/claude-setup";

// Parallel - 并行执行工具
export * from "./shared/parallel";

// Output - 输出服务
export * from "./shared/output";

// Verbose - 日志级别
export * from "./shared/verbose";

// Editor Config - 编辑器配置
export * from "./shared/editor-config";

// LLM JsonPut - JSON 结构化输出
export * from "./shared/llm-jsonput";

// Source Utils - 源类型判断工具
export * from "./shared/source-utils";

// Package Manager - 包管理器检测
export * from "./shared/package-manager";

// Spaceflow Dir - .spaceflow 目录管理
export * from "./shared/spaceflow-dir";

// Rspack Config - Rspack 配置工具
export * from "./shared/rspack-config";

// MCP - Model Context Protocol 支持
// 注意：McpServerDefinition 和 McpToolDefinition 已在 extension-system/types.ts 中定义
// 这里只导出装饰器和工具函数，避免重复导出
export {
  MCP_SERVER_METADATA,
  MCP_TOOL_METADATA,
  type JsonSchema,
  dtoToJsonSchema,
  type McpToolMetadata,
  McpServer,
  McpTool,
  isMcpServer,
  getMcpServerMetadata,
  getMcpTools,
  runMcpServer,
} from "./shared/mcp";

// I18n - 国际化
export * from "./shared/i18n";

// Logger - 全局日志工具
export * from "./shared/logger";

// ============ 配置相关 ============
export * from "./config";

// ============ CLI Runtime ============
// exec 入口、DI 容器、扩展加载器、i18n 初始化
export {
  exec,
  ServiceContainer,
  ExtensionLoader,
  initCliI18n,
  internalExtensions,
} from "./cli-runtime";

// ============ Zod 重导出 ============
export { z } from "zod";
