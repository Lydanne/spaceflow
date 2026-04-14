import { z } from "@spaceflow/core";
import type { LLMMode, VerboseLevel, LocalReviewMode } from "@spaceflow/core";
import type { ReportFormat } from "./review-report";

/** LLM 模式 schema（与 core 中的 LLMMode 保持一致） */
const llmModeSchema = z.enum(["openai", "gemini", "open-code"]);

/** 删除代码分析模式 schema */
const analyzeDeletionsModeSchema = z.union([z.boolean(), z.enum(["ci", "pr", "terminal"])]);

/** 审查规则严重级别 schema */
const severitySchema = z.enum(["off", "warn", "error"]);

/** 变更文件处理策略 schema */
const invalidateChangedFilesSchema = z.enum(["invalidate", "keep", "off"]);

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

/**
 * 系统规则配置，不依赖 LLM，在构建 prompt 前直接检查并生成系统问题。
 * 格式为 [阈值, severity]
 */
export interface SystemRules {
  /** 单文件最大审查行数，超过时跳过 LLM 并生成系统问题。格式: [maxLine, severity] */
  maxLinesPerFile?: [number, Severity];
}

/**
 * 变更文件处理策略
 * - 'invalidate': 将变更文件的历史问题标记为无效（默认）
 * - 'keep': 保留历史问题，不做处理
 * - 'off': 关闭此功能
 */
export type InvalidateChangedFilesMode = z.infer<typeof invalidateChangedFilesSchema>;

/**
 * Review 命令选项
 */
export interface ReviewOptions {
  dryRun: boolean;
  ci: boolean;
  prNumber?: number;
  base?: string;
  head?: string;
  references?: string[];
  verbose?: VerboseLevel;
  includes?: string[];
  /**
   * 代码结构过滤配置，指定在代码审查时要关注的代码结构类型
   * 支持格式："function"、"class"、"interface"、"type"、"method"
   */
  whenModifiedCode?: string[];
  llmMode?: LLMMode;
  files?: string[];
  commits?: string[];
  verifyFixes?: boolean;
  verifyConcurrency?: number;
  analyzeDeletions?: AnalyzeDeletionsMode;
  /** 仅执行删除代码分析，跳过常规代码审查 */
  deletionOnly?: boolean;
  /** 删除代码分析模式：openai 使用标准模式，open-code 使用 Agent 模式 */
  deletionAnalysisMode?: LLMMode;
  /** 输出格式：markdown, terminal, json。不指定则智能选择 */
  outputFormat?: ReportFormat;
  /** 是否使用 AI 生成 PR 功能描述 */
  generateDescription?: boolean;
  /** 显示所有问题，不过滤非变更行的问题 */
  showAll?: boolean;
  /** 仅刷新状态（同步 reactions、resolved 等），不执行 LLM 审查 */
  flush?: boolean;
  /** PR 事件类型（opened, synchronize, closed 等） */
  eventAction?: string;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  /**
   * 本地代码审查模式
   * - 'uncommitted': 审查所有未提交的代码（暂存区 + 工作区）
   * - 'staged': 仅审查暂存区的代码
   * - false: 禁用本地模式
   * 在非 CI 和非 PR 模式下默认为 'uncommitted'
   */
  local?: LocalReviewMode;
  /**
   * 处理重复 workflow 的策略
   * - 'off': 禁用检查
   * - 'skip': 检测到同名 workflow 正在运行时跳过审查
   * - 'delete': 检测到同名 workflow 时删除旧的 AI Review 评论和 PR Review（默认）
   */
  duplicateWorkflowResolved?: "off" | "skip" | "delete";
  /**
   * 自动批准合并
   * - true: 当所有问题都已解决时，自动提交 APPROVE review
   * - false: 不自动批准（默认）
   */
  autoApprove?: boolean;
  /**
   * 存在未解决问题时以非零退出码退出（工作流抛出异常）
   * - 'off': 禁用（默认），即使有问题也正常退出
   * - 'warn': 有未解决的 warn 级别问题时抛出异常
   * - 'error': 有未解决的 error 级别问题时抛出异常
   * - 'warn+error': 有未解决的 warn 或 error 级别问题时抛出异常
   */
  failOnIssues?: "off" | "warn" | "error" | "warn+error";
  /** 系统规则配置，不依赖 LLM，直接在检查阶段生成系统问题 */
  systemRules?: SystemRules;
}

/** review 命令配置 schema（LLM 敏感配置由系统 llm.config.ts 管理） */
export const reviewSchema = () =>
  z.object({
    references: z.array(z.string()).optional(),
    llmMode: llmModeSchema.default("openai").optional(),
    includes: z.array(z.string()).optional(),
    whenModifiedCode: z.array(z.string()).optional(),
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
    duplicateWorkflowResolved: z.enum(["off", "skip", "delete"]).default("delete").optional(),
    autoApprove: z.boolean().default(false).optional(),
    failOnIssues: z.enum(["off", "warn", "error", "warn+error"]).default("off").optional(),
    systemRules: z
      .object({
        maxLinesPerFile: z
          .tuple([z.number(), severitySchema])
          .transform((v): [number, Severity] => [v[0], v[1]])
          .optional(),
      })
      .optional(),
  });

/** review 配置类型（从 schema 推导） */
export type ReviewConfig = z.infer<ReturnType<typeof reviewSchema>>;
