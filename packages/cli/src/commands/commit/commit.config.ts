import { z } from "zod";
import type { VerboseLevel } from "@spaceflow/core";

/**
 * Commit 类型定义
 */
export interface CommitType {
  type: string;
  section: string;
}

/**
 * Changelog 配置
 */
export interface CommitConfig {
  changelog?: {
    preset?: {
      type?: CommitType[];
    };
  };
}

/**
 * Scope 匹配规则 schema
 */
export const ScopeRuleSchema = z.object({
  /** glob 模式，如 "src/components/**", "docs/**" */
  pattern: z.string().describe("glob 模式，用于匹配文件路径"),
  /** 匹配后使用的 scope 名称 */
  scope: z.string().describe("匹配后使用的 scope 名称"),
});

export type ScopeRule = z.infer<typeof ScopeRuleSchema>;

/**
 * Commit scope 配置 schema
 */
export const CommitScopeConfigSchema = z.object({
  /**
   * 分组策略
   * - "package": 按最近的 package.json 目录分组（默认）
   * - "rules": 仅使用自定义规则
   * - "rules-first": 优先使用自定义规则，未匹配则回退到 package 策略
   */
  strategy: z.enum(["package", "rules", "rules-first"]).default("package").describe("文件分组策略"),
  /** 自定义匹配规则列表 */
  rules: z.array(ScopeRuleSchema).default([]).describe("自定义 scope 匹配规则"),
});

export type CommitScopeConfig = z.infer<typeof CommitScopeConfigSchema>;

/**
 * Commit 命令选项
 */
export interface CommitOptions {
  verbose?: VerboseLevel;
  dryRun?: boolean;
  noVerify?: boolean;
  split?: boolean;
}

/**
 * Commit 执行结果
 */
export interface CommitResult {
  success: boolean;
  message?: string;
  error?: string;
  commitCount?: number;
}

/**
 * Commit 分组
 */
export interface CommitGroup {
  files: string[];
  reason: string;
  packageInfo?: { name: string; description?: string };
}

/**
 * 拆分分析结果
 */
export interface SplitAnalysis {
  groups: CommitGroup[];
}

/**
 * 包信息
 */
export interface PackageInfo {
  /** 包名（package.json 中的 name） */
  name: string;
  /** 包描述 */
  description?: string;
  /** package.json 所在目录的绝对路径 */
  path: string;
}

/**
 * 结构化 Commit Message schema（仅 AI 生成的部分）
 */
export const CommitMessageContentSchema = z.object({
  /** commit 类型，如 feat, fix, refactor 等 */
  type: z.string().describe("commit 类型"),
  /** 影响范围，可选 */
  scope: z.string().optional().describe("影响范围（包名、模块名）"),
  /** 简短描述，不超过 50 个字符 */
  subject: z.string().describe("简短描述"),
  /** 详细描述，可选 */
  body: z.string().optional().describe("详细描述"),
});

export type CommitMessageContent = z.infer<typeof CommitMessageContentSchema>;

/**
 * 完整的 Commit Message，包含文件和包上下文
 */
export interface CommitMessage extends CommitMessageContent {
  /** 涉及的文件列表（相对路径） */
  files?: string[];
  /** 所属包信息 */
  packageInfo?: PackageInfo;
}

/**
 * 解析 commit message 字符串为结构化对象
 */
export function parseCommitMessage(message: string): CommitMessage {
  const lines = message.trim().split("\n");
  const firstLine = lines[0] || "";

  // 匹配 type(scope): subject 或 type: subject
  const headerRegex = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/;
  const match = firstLine.match(headerRegex);

  if (!match) {
    // 无法解析，将整个内容作为 subject
    return {
      type: "chore",
      subject: firstLine || message.trim(),
      body: lines.slice(1).join("\n").trim() || undefined,
    };
  }

  const [, type, scope, subject] = match;
  const body = lines.slice(1).join("\n").trim() || undefined;

  return {
    type,
    scope: scope || undefined,
    subject,
    body,
  };
}

/**
 * 格式化结构化 commit message 为字符串
 */
export function formatCommitMessage(commit: CommitMessage): string {
  const { type, scope, subject, body } = commit;
  const header = scope ? `${type}(${scope}): ${subject}` : `${type}: ${subject}`;

  if (body) {
    return `${header}\n\n${body}`;
  }
  return header;
}
