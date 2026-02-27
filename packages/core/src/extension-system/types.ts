import type { ZodSchema } from "zod";

/**
 * 命令选项定义
 */
export interface OptionDefinition {
  /** 选项标志，如 "-d, --dry-run" */
  flags: string;
  /** 选项描述 */
  description: string;
  /** 默认值 */
  default?: unknown;
  /** 是否为计数选项（如 -vvv 表示 verbose 级别 3） */
  isCount?: boolean;
}

/**
 * Spaceflow 统一上下文接口
 * 命令和 MCP 工具共用此上下文
 */
export interface SpaceflowContext {
  /** 当前工作目录（优先 SPACEFLOW_CWD 环境变量） */
  readonly cwd: string;
  /** 配置读取器 */
  readonly config: IConfigReader;
  /** 输出服务 */
  readonly output: IOutputService;
  /** 存储服务 */
  readonly storage: IStorageService;
  /**
   * 获取服务实例
   * @param key 服务标识符（字符串 key，非 class 引用）
   */
  getService<T = unknown>(key: string): T;
  /**
   * 检查服务是否存在
   * @param key 服务标识符
   */
  hasService(key: string): boolean;
  /**
   * 注册服务实例
   * @param key 服务标识符
   * @param service 服务实例
   */
  registerService(key: string, service: unknown): void;
}

/**
 * 配置读取器接口
 */
export interface IConfigReader {
  /**
   * 获取配置值
   * @param key 配置路径
   */
  get<T>(key: string): T | undefined;
  /**
   * 获取插件配置
   * @param key 插件配置 key
   */
  getPluginConfig<T>(key: string): T | undefined;
  /**
   * 注册配置 schema
   * @param key 配置 key
   * @param schema Zod schema
   */
  registerSchema(key: string, schema: ZodSchema): void;
}

/**
 * 输出服务接口
 */
export interface IOutputService {
  /** 输出信息 */
  info(message: string): void;
  /** 输出成功信息 */
  success(message: string): void;
  /** 输出警告 */
  warn(message: string): void;
  /** 输出错误 */
  error(message: string): void;
  /** 输出调试信息 */
  debug(message: string): void;
}

/**
 * 存储服务接口
 */
export interface IStorageService {
  /** 获取存储值 */
  get<T>(key: string): Promise<T | undefined>;
  /** 设置存储值 */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /** 删除存储值 */
  del(key: string): Promise<boolean>;
}

/**
 * 命令定义
 */
export interface CommandDefinition {
  /** 命令名称 */
  name: string;
  /** 命令描述 */
  description: string;
  /** 命令别名 */
  aliases?: string[];
  /** 位置参数，如 "<script>" 或 "[file]" */
  arguments?: string;
  /** 参数描述 */
  argsDescription?: Record<string, string>;
  /** 命令选项 */
  options?: OptionDefinition[];
  /** 子命令 */
  subcommands?: CommandDefinition[];
  /**
   * 命令执行函数
   * @param args 位置参数
   * @param options 选项
   * @param ctx Spaceflow 上下文
   */
  run: (args: string[], options: Record<string, unknown>, ctx: SpaceflowContext) => Promise<void>;
}

/**
 * 服务定义
 * 扩展通过此接口声明其提供的服务
 */
export interface ServiceDefinition {
  /** 服务标识符（建议格式：extName.serviceName） */
  key: string;
  /**
   * 服务工厂函数
   * @param ctx Spaceflow 上下文，可从中获取依赖
   */
  factory: (ctx: SpaceflowContext) => unknown;
}

/**
 * MCP 资源定义
 */
export interface McpResourceDefinition {
  /** 资源名称（唯一标识符） */
  name: string;
  /** 资源 URI（固定 URI，如 "config://spaceflow"） */
  uri: string;
  /** 资源标题（人类可读） */
  title?: string;
  /** 资源描述 */
  description?: string;
  /** MIME 类型（默认 application/json） */
  mimeType?: string;
  /**
   * 资源读取处理函数
   * @param uri 请求的 URI
   * @param ctx Spaceflow 上下文
   * @returns 资源内容（字符串）
   */
  handler: (uri: string, ctx: SpaceflowContext) => Promise<string>;
}

/**
 * MCP 工具定义
 */
export interface McpToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数 schema（Zod） */
  inputSchema?: ZodSchema;
  /**
   * 工具处理函数
   * @param input 输入参数
   * @param ctx Spaceflow 上下文
   */
  handler: (input: unknown, ctx: SpaceflowContext) => Promise<unknown>;
}

/**
 * 扩展定义
 */
export interface ExtensionDefinition {
  /** 扩展名称（建议使用 npm 包名） */
  name: string;
  /** 扩展版本 */
  version?: string;
  /** 扩展描述 */
  description?: string;
  /** 配置 key（对应 spaceflow.json 中的配置路径） */
  configKey?: string;
  /** 配置 schema 工厂函数 */
  configSchema?: () => ZodSchema;
  /** 依赖的其他扩展配置 key 列表 */
  configDependencies?: string[];
  /** 命令列表 */
  commands: CommandDefinition[];
  /** MCP 工具列表 */
  tools?: McpToolDefinition[];
  /** MCP 资源列表 */
  resources?: McpResourceDefinition[];
  /** 服务定义列表 */
  services?: ServiceDefinition[];
  /**
   * 扩展初始化钩子
   * 在所有服务注册完毕后调用
   */
  onInit?: (ctx: SpaceflowContext) => Promise<void>;
  /**
   * 扩展销毁钩子
   * 在 CLI 退出前调用
   */
  onDestroy?: (ctx: SpaceflowContext) => Promise<void>;
}
