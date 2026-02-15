import type {
  LoggerOptions,
  LogLevel,
  RenderMode,
  LogRenderer,
  Spinner,
  ProgressBar,
  ProgressBarOptions,
  TaskItem,
} from "./logger.interface";
import { LOG_LEVEL_PRIORITY } from "./logger.interface";
import { PlainRenderer } from "./renderers/plain.renderer";

/** 检测是否为 TUI 环境 */
const detectMode = (): RenderMode => {
  if (process.env.CI || !process.stdout.isTTY) return "plain";
  return "tui";
};

/** TUI 渲染器缓存（延迟加载，避免 ESM 兼容问题） */
let tuiRendererCache: LogRenderer | null = null;

/** 延迟加载 TUI 渲染器（chalk/ora/log-update 均为纯 ESM 包） */
const loadTuiRenderer = async (): Promise<LogRenderer> => {
  if (tuiRendererCache) return tuiRendererCache;
  const { TuiRenderer } = await import("./renderers/tui.renderer");
  tuiRendererCache = new TuiRenderer();
  return tuiRendererCache;
};

/** 解析渲染模式，返回实际模式标识 */
const resolveMode = (mode: RenderMode): "plain" | "tui" => {
  if (mode === "auto") return detectMode() === "tui" ? "tui" : "plain";
  return mode;
};

/**
 * 全局日志工具类
 *
 * 每个子命令创建独立实例，支持 plain / tui 两种输出模式。
 * TUI 模式提供 Spinner、进度条、任务列表等富交互能力，
 * plain 模式下自动降级为普通文本输出。
 *
 * @example
 * ```typescript
 * const logger = new Logger("build");
 * logger.info("开始构建");
 * const s = logger.spin("编译中...");
 * s.succeed("编译完成");
 * ```
 */
export class Logger {
  private readonly name: string;
  private readonly level: LogLevel;
  private readonly resolvedMode: "plain" | "tui";
  private readonly plainRenderer: PlainRenderer;
  private tuiRenderer: LogRenderer | null = null;

  constructor(options: LoggerOptions | string) {
    const opts = typeof options === "string" ? { name: options } : options;
    this.name = opts.name;
    this.level = opts.level ?? "info";
    this.resolvedMode = resolveMode(opts.mode ?? "auto");
    this.plainRenderer = new PlainRenderer();
  }

  /** 格式化前缀 */
  private get prefix(): string {
    return `[${this.name}]`;
  }

  /** 获取当前渲染器（TUI 未加载时降级为 plain） */
  private get renderer(): LogRenderer {
    if (this.resolvedMode === "tui" && this.tuiRenderer) return this.tuiRenderer;
    return this.plainRenderer;
  }

  /**
   * 初始化 TUI 渲染器（异步）
   * 在使用 TUI 特有功能前调用，确保渲染器已加载
   */
  async init(): Promise<void> {
    if (this.resolvedMode === "tui" && !this.tuiRenderer) {
      this.tuiRenderer = await loadTuiRenderer();
    }
  }

  /** 判断是否应输出指定级别的日志 */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level];
  }

  /** 输出 info 级别日志 */
  info(message: string): void {
    if (this.shouldLog("info")) {
      this.renderer.info(this.prefix, message);
    }
  }

  /** 输出 success 级别日志 */
  success(message: string): void {
    if (this.shouldLog("info")) {
      this.renderer.success(this.prefix, message);
    }
  }

  /** 输出 warn 级别日志 */
  warn(message: string): void {
    if (this.shouldLog("info")) {
      this.renderer.warn(this.prefix, message);
    }
  }

  /** 输出 error 级别日志 */
  error(message: string): void {
    if (this.shouldLog("info")) {
      this.renderer.error(this.prefix, message);
    }
  }

  /** 输出 verbose 级别日志（level >= verbose 才输出） */
  verbose(message: string): void {
    if (this.shouldLog("verbose")) {
      this.renderer.verbose(this.prefix, message);
    }
  }

  /** 输出 debug 级别日志（level >= debug 才输出） */
  debug(message: string): void {
    if (this.shouldLog("debug")) {
      this.renderer.debug(this.prefix, message);
    }
  }

  /**
   * 创建 Spinner
   * TUI 模式下显示动画 spinner，plain 模式下降级为普通日志
   */
  spin(message: string): Spinner {
    return this.renderer.createSpinner(this.prefix, message);
  }

  /**
   * 创建进度条
   * TUI 模式下显示实时进度条，plain 模式下降级为百分比日志
   */
  progress(options: ProgressBarOptions): ProgressBar {
    return this.renderer.createProgressBar(this.prefix, options);
  }

  /**
   * 执行任务列表
   * TUI 模式下多行实时更新，plain 模式下顺序输出
   */
  async tasks<T>(items: TaskItem<T>[]): Promise<T[]> {
    return this.renderer.runTasks<T>(this.prefix, items);
  }

  /** 输出表格 */
  table(data: Record<string, unknown>[]): void {
    this.renderer.table(this.prefix, data);
  }

  /**
   * 创建子 Logger
   * 命名空间自动拼接，如 "build" → "build:compile"
   */
  child(name: string): Logger {
    return new Logger({
      name: `${this.name}:${name}`,
      level: this.level,
      mode: this.resolvedMode,
    });
  }
}
