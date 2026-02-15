import { Type, DynamicModule } from "@nestjs/common";

/** .spaceflow 目录名 */
export const SPACEFLOW_DIR = ".spaceflow";

/** package.json 文件名 */
export const PACKAGE_JSON = "package.json";

/**
 * Extension 元数据
 */
export interface SpaceflowExtensionMetadata {
  /** Extension 名称 */
  name: string;
  /** 提供的命令列表 */
  commands: string[];
  /** 对应 spaceflow.json 中的配置 key（可选） */
  configKey?: string;
  /** 依赖的其他 Extension 配置 key 列表，读取其他 Extension 配置前必须在此声明 */
  configDependencies?: string[];
  /** 配置 schema 工厂函数，返回 zod schema，用于验证配置和生成 JSON Schema */
  configSchema?: () => unknown;
  /** Extension 版本 */
  version?: string;
  /** Extension 描述 */
  description?: string;
}

/**
 * Extension 模块类型，支持静态模块或动态模块
 */
export type ExtensionModuleType = Type<any> | DynamicModule;

/**
 * Extension 接口
 */
export interface SpaceflowExtension {
  /** 获取 Extension 元数据 */
  getMetadata(): SpaceflowExtensionMetadata;
  /**
   * 获取 NestJS Module
   * 可以返回静态 Module 类或 DynamicModule
   * 如果需要动态配置，推荐返回 DynamicModule
   */
  getModule(): ExtensionModuleType;
}

/**
 * Extension 类静态接口
 */
export interface SpaceflowExtensionConstructor {
  new (): SpaceflowExtension;
}

/**
 * Extension 入口导出格式
 */
export type SpaceflowExtensionExport =
  | SpaceflowExtensionConstructor
  | {
      default: SpaceflowExtensionConstructor;
    };

/**
 * 已加载的 Extension 信息
 */
export interface LoadedExtension {
  /** Extension 名称 */
  name: string;
  /** Extension 来源（npm 包名） */
  source: string;
  /** NestJS 模块（静态或动态） */
  module: ExtensionModuleType;
  /** 包的完整导出（用于 MCP 服务发现） */
  exports?: Record<string, unknown>;
  /** 提供的命令列表 */
  commands: string[];
  /** 配置 key */
  configKey?: string;
  /** 依赖的其他 Extension 配置 key 列表 */
  configDependencies?: string[];
  /** 配置 schema 工厂函数 */
  configSchema?: () => unknown;
  /** Extension 版本 */
  version?: string;
  /** Extension 描述 */
  description?: string;
}

/**
 * .spaceflow/package.json 中的 dependencies
 */
export type ExtensionDependencies = Record<string, string>;

/**
 * Spaceflow 导出类型
 * - flow: 子命令（默认），需要构建，注册为 CLI 子命令
 * - command: 编辑器命令，复制到 .claude/commands/ 等目录
 * - skill: 技能包，复制到 .claude/skills/ 等目录
 * - mcp: MCP Server，注册到编辑器的 mcp.json 配置
 */
export type SpaceflowExportType = "flow" | "command" | "skill" | "mcp";

/**
 * MCP Server 配置
 */
export interface McpServerConfig {
  /** 启动命令，如 "node", "python" */
  command: string;
  /** 启动参数，如 ["dist/index.js"] */
  args?: string[];
  /** 需要的环境变量名列表，安装时会提示用户配置 */
  env?: string[];
}

/**
 * 单个导出项配置
 */
export interface SpaceflowExportConfig {
  /** 导出类型，默认为 flow */
  type?: SpaceflowExportType;
  /** 入口路径，相对于包根目录 */
  entry: string;
  /** 描述（可选） */
  description?: string;
  /** MCP Server 配置（仅 type 为 mcp 时有效） */
  mcp?: McpServerConfig;
}

/**
 * package.json 中的 spaceflow 配置
 *
 * 完整格式：
 * ```json
 * "spaceflow": {
 *   "exports": {
 *     "review": { "type": "flow", "entry": "." },
 *     "review-rules": { "type": "skill", "entry": "./skills" },
 *     "my-mcp": { "type": "mcp", "entry": ".", "mcp": { "command": "node", "args": ["dist/index.js"] } }
 *   }
 * }
 * ```
 *
 * 简化格式（单导出）：
 * ```json
 * "spaceflow": {
 *   "type": "mcp",
 *   "entry": ".",
 *   "mcp": { "command": "node", "args": ["dist/index.js"] }
 * }
 * ```
 */
export interface SpaceflowPackageConfig {
  /** 多导出配置 */
  exports?: Record<string, SpaceflowExportConfig>;
  /** 简化格式：导出类型 */
  type?: SpaceflowExportType;
  /** 简化格式：入口路径 */
  entry?: string;
  /** 简化格式：描述 */
  description?: string;
  /** 简化格式：MCP 配置 */
  mcp?: McpServerConfig;
}

/**
 * 解析后的导出项
 */
export interface ResolvedSpaceflowExport {
  /** 导出名称 */
  name: string;
  /** 导出类型 */
  type: SpaceflowExportType;
  /** 入口路径（绝对路径） */
  entry: string;
  /** 描述 */
  description?: string;
  /** MCP 配置（仅 type 为 mcp 时有效） */
  mcp?: McpServerConfig;
}

/**
 * 解析 spaceflow 配置，返回所有导出项
 */
export function resolveSpaceflowConfig(
  config: SpaceflowPackageConfig | undefined,
  packageName: string,
  packagePath: string,
): ResolvedSpaceflowExport[] {
  const { join } = require("path");

  if (!config) {
    return [];
  }

  // 完整格式：有 exports 字段
  if (config.exports) {
    return Object.entries(config.exports).map(([name, exportConfig]) => ({
      name,
      type: exportConfig.type || "flow",
      entry: join(packagePath, exportConfig.entry),
      description: exportConfig.description,
      mcp: exportConfig.mcp,
    }));
  }

  // 简化格式：直接有 type/entry 字段
  if (config.entry) {
    return [
      {
        name: packageName,
        type: config.type || "flow",
        entry: join(packagePath, config.entry),
        description: config.description,
        mcp: config.mcp,
      },
    ];
  }

  return [];
}
