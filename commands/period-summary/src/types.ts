/**
 * 周期统计命令类型定义
 */

import type { VerboseLevel } from "@spaceflow/core";

/** 输出目标类型 */
export type OutputTarget = "console" | "issue" | "file";

/** 时间预设类型 */
export type TimePreset =
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "last-7-days"
  | "last-15-days"
  | "last-30-days";

/** 命令选项 */
export interface PeriodSummaryOptions {
  /** 开始日期 (YYYY-MM-DD) */
  since?: string;
  /** 结束日期 (YYYY-MM-DD)，默认为今天 */
  until?: string;
  /** 时间预设，优先级高于 since/until */
  preset?: TimePreset;
  /** 仓库路径 owner/repo，默认从环境变量获取 */
  repository?: string;
  /** 是否在 CI 环境中运行 */
  ci?: boolean;
  /** 输出格式 */
  format?: "table" | "json" | "markdown";
  /** 输出目标：console（控制台）、issue（创建 GitHub Issue）、file（Markdown 文件） */
  output?: OutputTarget;
  /** 输出文件路径（当 output 为 file 时使用） */
  outputFile?: string;
  /** 详细日志级别 (0: 静默, 1: 过程日志, 2: 详细日志) */
  verbose?: VerboseLevel;
}

/** 命令执行上下文 */
export interface PeriodSummaryContext {
  owner: string;
  repo: string;
  since: Date;
  until: Date;
  format: "table" | "json" | "markdown";
  output: OutputTarget;
  outputFile?: string;
  verbose: VerboseLevel;
}

/** 单个 PR 的统计数据 */
export interface PrStats {
  /** PR 编号 */
  number: number;
  /** PR 标题 */
  title: string;
  /** 作者用户名 */
  author: string;
  /** 合并时间 */
  mergedAt: string;
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 变更文件数 */
  changedFiles: number;
  /** 扫描发现的问题数 */
  issueCount: number;
  /** 已修复的问题数 */
  fixedCount: number;
  /** PR 描述/功能摘要 */
  description: string;
}

/** 单个用户的统计数据 */
export interface UserStats {
  /** 用户名 */
  username: string;
  /** PR 数量 */
  prCount: number;
  /** 总新增行数 */
  totalAdditions: number;
  /** 总删除行数 */
  totalDeletions: number;
  /** 总变更文件数 */
  totalChangedFiles: number;
  /** 总问题数 */
  totalIssues: number;
  /** 总已修复问题数 */
  totalFixed: number;
  /** 综合分数 */
  score: number;
  /** 功能摘要列表 */
  features: string[];
  /** 该用户的 PR 列表 */
  prs: PrStats[];
}

/** 周期统计结果 */
export interface PeriodSummaryResult {
  /** 统计周期 */
  period: {
    since: string;
    until: string;
  };
  /** 仓库信息 */
  repository: string;
  /** 总 PR 数 */
  totalPrs: number;
  /** 按用户统计（已排序） */
  userStats: UserStats[];
}
