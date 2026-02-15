import { z } from "@spaceflow/core";

/** LLM 模式 schema（与 core 中的 LLMMode 保持一致） */
const llmModeSchema = z.enum(["claude-code", "openai", "gemini", "open-code"]);

/** 删除代码分析模式 schema */
const analyzeDeletionsModeSchema = z.union([z.boolean(), z.enum(["ci", "pr", "terminal"])]);

/** 审查规则严重级别 schema */
const severitySchema = z.enum(["off", "warn", "error"]);

/** 变更文件处理策略 schema */
const invalidateChangedFilesSchema = z.enum(["invalidate", "keep", "off"]);

/** review 命令配置 schema（LLM 敏感配置由系统 llm.config.ts 管理） */
export const reviewSchema = () =>
  z.object({
    references: z.array(z.string()).optional(),
    llmMode: llmModeSchema.default("openai").optional(),
    includes: z.array(z.string()).optional(),
    rules: z.record(z.string(), severitySchema).optional(),
    verifyFixes: z.boolean().default(false),
    verifyFixesConcurrency: z.number().default(10).optional(),
    analyzeDeletions: analyzeDeletionsModeSchema.default(false),
    deletionAnalysisMode: llmModeSchema.default("openai").optional(),
    lineComments: z.boolean().default(false),
    generateDescription: z.boolean().default(false).optional(),
    autoUpdatePrTitle: z.boolean().default(false).optional(),
    concurrency: z.number().default(5).optional(),
    timeout: z.number().optional(),
    retries: z.number().default(0).optional(),
    retryDelay: z.number().default(1000).optional(),
    invalidateChangedFiles: invalidateChangedFilesSchema.default("invalidate").optional(),
  });

/**
 * 变更文件处理策略
 * - 'invalidate': 将变更文件的历史问题标记为无效（默认）
 * - 'keep': 保留历史问题，不做处理
 * - 'off': 关闭此功能
 */
export type InvalidateChangedFilesMode = z.infer<typeof invalidateChangedFilesSchema>;

/** review 配置类型（从 schema 推导） */
export type ReviewConfig = z.infer<ReturnType<typeof reviewSchema>>;

/**
 * 删除代码分析模式
 * - true: 始终启用
 * - false: 始终禁用
 * - 'ci': 仅在 CI 环境中启用
 * - 'pr': 仅在 PR 环境中启用
 * - 'terminal': 仅在终端环境中启用
 */
export type AnalyzeDeletionsMode = z.infer<typeof analyzeDeletionsModeSchema>;

/** 审查规则严重级别 */
export type Severity = z.infer<typeof severitySchema>;
