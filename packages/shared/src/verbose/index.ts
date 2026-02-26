/**
 * 日志级别（字符串模式）
 * - "silent": 静默模式，不输出任何日志
 * - "info": 显示过程日志（如 "开始审查"、"完成审查"）
 * - "verbose": 显示详细日志
 * - "debug": 显示调试日志（包括大模型的输入提示词和输出过程）
 */
export type LogLevel = "silent" | "info" | "verbose" | "debug";

/**
 * Verbose 日志级别（数字模式，向后兼容）
 * - 0 / false: 静默模式，只返回结果
 * - 1 / true: 显示过程日志
 * - 2: 显示详细日志
 * - 3: 显示调试日志
 */
export type VerboseLevel = 0 | 1 | 2 | 3 | false | true;

/** 日志级别优先级映射 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  info: 1,
  verbose: 2,
  debug: 3,
} as const;

/** VerboseLevel 数字到 LogLevel 字符串的映射 */
const VERBOSE_TO_LOG_LEVEL: Record<number, LogLevel> = {
  0: "silent",
  1: "info",
  2: "verbose",
  3: "debug",
} as const;

/**
 * 将任意级别值统一转为 LogLevel 字符串
 * @param level 日志级别（字符串、数字、布尔值）
 * @returns LogLevel 字符串
 */
export const toLogLevel = (level: LogLevel | VerboseLevel | undefined): LogLevel => {
  if (level === undefined) return "info";
  if (typeof level === "string") return level;
  if (level === true) return "info";
  if (level === false) return "silent";
  return VERBOSE_TO_LOG_LEVEL[level] ?? "info";
};

/**
 * 将 verbose 值规范化为数字
 * @param verbose verbose 值（支持字符串、数字、布尔值）
 * @returns 规范化后的数字 (0, 1, 2, 3)
 */
export function normalizeVerbose(
  verbose: LogLevel | VerboseLevel | boolean | undefined,
): 0 | 1 | 2 | 3 {
  if (verbose === undefined || verbose === false || verbose === 0 || verbose === "silent") return 0;
  if (verbose === true || verbose === 1 || verbose === "info") return 1;
  if (verbose === 2 || verbose === "verbose") return 2;
  return 3;
}

/**
 * 判断是否应该打印指定级别的日志
 * @param verbose 当前 verbose 级别（支持字符串或数字）
 * @param requiredLevel 需要的最低级别 (1, 2, 3)
 * @returns 是否应该打印
 */
export function shouldLog(
  verbose: LogLevel | VerboseLevel | undefined,
  requiredLevel: 1 | 2 | 3,
): boolean {
  return normalizeVerbose(verbose) >= requiredLevel;
}

/**
 * 解析命令行 verbose 参数
 * 支持: -v, -v 2, -v 3, --verbose, --verbose 2, -vvv (计数模式)
 * @param val 命令行参数值（字符串、布尔值、数字或 undefined）
 * @returns 规范化后的 VerboseLevel
 */
export function parseVerbose(val: string | boolean | number | undefined): 0 | 1 | 2 | 3 {
  if (val === undefined || val === 0) return 1;
  if (val === true || val === "") return 1;
  if (typeof val === "number") return normalizeVerbose(val as VerboseLevel);
  const level = parseInt(val as string, 10);
  if (isNaN(level)) return 1;
  return normalizeVerbose(level as VerboseLevel);
}
