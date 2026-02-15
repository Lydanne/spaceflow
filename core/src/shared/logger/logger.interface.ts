import type { LogLevel } from "../verbose";
import { LOG_LEVEL_PRIORITY } from "../verbose";

export type { LogLevel };
export { LOG_LEVEL_PRIORITY };

/** 渲染模式 */
export type RenderMode = "plain" | "tui" | "auto";

/** Logger 配置 */
export interface LoggerOptions {
  /** 日志所属命名空间（通常为命令名） */
  readonly name: string;
  /** 输出模式，默认 "auto"（TTY=tui，CI/管道=plain） */
  readonly mode?: RenderMode;
  /** 日志级别，默认 "info" */
  readonly level?: LogLevel;
}

/** Spinner 控制接口 */
export interface Spinner {
  /** 更新 spinner 文本 */
  update(message: string): void;
  /** 成功结束 */
  succeed(message?: string): void;
  /** 失败结束 */
  fail(message?: string): void;
  /** 静默停止 */
  stop(): void;
}

/** 进度条控制接口 */
export interface ProgressBar {
  /** 更新进度 */
  update(current: number, message?: string): void;
  /** 完成 */
  finish(message?: string): void;
}

/** 进度条配置 */
export interface ProgressBarOptions {
  /** 总数 */
  readonly total: number;
  /** 标签 */
  readonly label?: string;
  /** 进度条宽度（字符数），默认 30 */
  readonly width?: number;
}

/** 任务控制接口 */
export interface TaskControl {
  /** 更新任务状态文本 */
  update(message: string): void;
  /** 跳过任务 */
  skip(reason?: string): void;
}

/** 任务项定义 */
export interface TaskItem<T = void> {
  /** 任务标题 */
  readonly title: string;
  /** 任务执行函数 */
  readonly task: (ctx: T, control: TaskControl) => Promise<T>;
  /** 是否启用，默认 true */
  readonly enabled?: boolean;
}

/** 任务执行结果 */
export type TaskStatus = "pending" | "running" | "success" | "failed" | "skipped";

/** 渲染器接口（策略模式） */
export interface LogRenderer {
  /** 输出 info 级别日志 */
  info(prefix: string, message: string): void;
  /** 输出 success 级别日志 */
  success(prefix: string, message: string): void;
  /** 输出 warn 级别日志 */
  warn(prefix: string, message: string): void;
  /** 输出 error 级别日志 */
  error(prefix: string, message: string): void;
  /** 输出 debug 级别日志 */
  debug(prefix: string, message: string): void;
  /** 输出 verbose 级别日志 */
  verbose(prefix: string, message: string): void;
  /** 创建 Spinner */
  createSpinner(prefix: string, message: string): Spinner;
  /** 创建进度条 */
  createProgressBar(prefix: string, options: ProgressBarOptions): ProgressBar;
  /** 执行任务列表 */
  runTasks<T>(prefix: string, items: TaskItem<T>[]): Promise<T[]>;
  /** 输出表格 */
  table(prefix: string, data: Record<string, unknown>[]): void;
}
