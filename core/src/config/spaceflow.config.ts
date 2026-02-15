import { registerAs } from "@nestjs/config";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import stringify from "json-stringify-pretty-compact";
import { z } from "zod";
import type { LLMMode } from "../shared/llm-proxy";
import { registerPluginSchema } from "./schema-generator.service";

/** 默认编辑器 */
export const DEFAULT_SUPPORT_EDITOR = "claudeCode";

/** 配置文件名 */
export const CONFIG_FILE_NAME = "spaceflow.json";

/** RC 配置文件名（位于 .spaceflow 同级目录） */
export const RC_FILE_NAME = ".spaceflowrc";

/** Spaceflow 核心配置 Schema */
const SpaceflowCoreConfigSchema = z.object({
  /** 界面语言，如 zh-CN、en */
  lang: z.string().optional().describe("界面语言，如 zh-CN、en"),
  /** 已安装的技能包注册表 */
  dependencies: z.record(z.string(), z.string()).optional().describe("已安装的技能包注册表"),
  /** 支持的编辑器列表，用于安装 skills 和 commands 时关联目录 */
  support: z.array(z.string()).default([DEFAULT_SUPPORT_EDITOR]).describe("支持的编辑器列表"),
});

// 注册 spaceflow 核心配置 schema
registerPluginSchema({
  configKey: "spaceflow",
  schemaFactory: () => SpaceflowCoreConfigSchema,
  description: "Spaceflow 核心配置",
});

/**
 * SpaceflowConfig - 通用配置
 * 子命令的配置由各自模块定义和管理
 */
export type SpaceflowConfig = z.infer<typeof SpaceflowCoreConfigSchema> & {
  /** 子命令配置，由各子命令模块自行定义类型 */
  [key: string]: unknown;
};

// ============ 配置文件操作工具函数 ============

// 不应该被深度合并的字段，这些字段应该直接覆盖而非合并
const NO_MERGE_FIELDS = ["dependencies"];

/**
 * 深度合并对象
 * 后面的对象会覆盖前面的对象，数组会被替换而非合并
 * NO_MERGE_FIELDS 中的字段不会被深度合并，而是直接覆盖
 */
function deepMerge<T extends Record<string, unknown>>(...objects: Partial<T>[]): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const obj of objects) {
    for (const key in obj) {
      const value = obj[key];
      const existing = result[key];

      // 对于 NO_MERGE_FIELDS 中的字段，直接覆盖而非合并
      if (NO_MERGE_FIELDS.includes(key)) {
        if (value !== undefined) {
          result[key] = value;
        }
      } else if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        existing !== null &&
        typeof existing === "object" &&
        !Array.isArray(existing)
      ) {
        result[key] = deepMerge(
          existing as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result as Partial<T>;
}

/**
 * 获取主配置文件路径（用于写入）
 * 配置文件统一存放在 .spaceflow/ 目录下
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getConfigPath(cwd?: string): string {
  return join(cwd || process.cwd(), ".spaceflow", CONFIG_FILE_NAME);
}

/**
 * 获取所有配置文件路径（按优先级从低到高排列）
 * 优先级: ~/.spaceflow/spaceflow.json < ~/.spaceflowrc < ./.spaceflow/spaceflow.json < ./.spaceflowrc
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getConfigPaths(cwd?: string): string[] {
  const workDir = cwd || process.cwd();
  return [
    join(homedir(), ".spaceflow", CONFIG_FILE_NAME),
    join(homedir(), RC_FILE_NAME),
    join(workDir, ".spaceflow", CONFIG_FILE_NAME),
    join(workDir, RC_FILE_NAME),
  ];
}

/** .env 文件名 */
const ENV_FILE_NAME = ".env";

/**
 * 获取所有 .env 文件路径（按优先级从高到低排列，供 ConfigModule.envFilePath 使用）
 *
 * NestJS ConfigModule 中 envFilePath 数组靠前的优先级更高（先读到的变量不会被后面覆盖）
 * 因此返回顺序为从高到低：
 * 1. ./.env (程序启动目录，最高优先级)
 * 2. ./.spaceflow/.env (项目配置目录)
 * 3. ~/.env (全局 home 目录)
 * 4. ~/.spaceflow/.env (全局配置目录，最低优先级)
 *
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getEnvFilePaths(cwd?: string): string[] {
  const workDir = cwd || process.cwd();
  return [
    join(workDir, ENV_FILE_NAME),
    join(workDir, ".spaceflow", ENV_FILE_NAME),
    join(homedir(), ENV_FILE_NAME),
    join(homedir(), ".spaceflow", ENV_FILE_NAME),
  ];
}

/**
 * 读取单个配置文件（同步）
 * @param configPath 配置文件路径
 */
function readSingleConfigSync(configPath: string): Partial<SpaceflowConfig> {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    console.warn(`警告: 无法解析配置文件 ${configPath}`);
    return {};
  }
}

/**
 * 读取配置文件（同步）
 * 按优先级从低到高读取并合并配置：
 * 1. ~/.spaceflow/spaceflow.json (全局配置，最低优先级)
 * 2. ~/.spaceflowrc (全局 RC 配置)
 * 3. ./.spaceflow/spaceflow.json (项目配置)
 * 4. ./.spaceflowrc (项目根目录 RC 配置，最高优先级)
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function readConfigSync(cwd?: string): Partial<SpaceflowConfig> {
  const configPaths = getConfigPaths(cwd);
  const configs = configPaths.map((p) => readSingleConfigSync(p));
  return deepMerge(...configs);
}

/**
 * 写入配置文件（同步）
 * @param config 配置对象
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function writeConfigSync(config: Partial<SpaceflowConfig>, cwd?: string): void {
  const configPath = getConfigPath(cwd);
  writeFileSync(configPath, stringify(config, { indent: 2 }) + "\n");
}

/**
 * 获取支持的编辑器列表
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getSupportedEditors(cwd?: string): string[] {
  const config = readConfigSync(cwd);
  return config.support || [DEFAULT_SUPPORT_EDITOR];
}

/**
 * 获取 dependencies
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getDependencies(cwd?: string): Record<string, string> {
  const config = readConfigSync(cwd);
  return (config.dependencies as Record<string, string>) || {};
}

/**
 * 更新单个 dependency
 * @param name 依赖名称
 * @param source 依赖来源
 * @param cwd 工作目录，默认为 process.cwd()
 * @returns 是否有更新（false 表示已存在相同配置）
 */
export function updateDependency(name: string, source: string, cwd?: string): boolean {
  const config = readConfigSync(cwd) as Record<string, unknown>;

  if (!config.dependencies) {
    config.dependencies = {};
  }

  const dependencies = config.dependencies as Record<string, string>;

  // 检查是否已存在相同配置
  if (dependencies[name] === source) {
    return false;
  }

  dependencies[name] = source;
  writeConfigSync(config, cwd);
  return true;
}

/**
 * 删除单个 dependency
 * @param name 依赖名称
 * @param cwd 工作目录，默认为 process.cwd()
 * @returns 是否有删除（false 表示不存在）
 */
export function removeDependency(name: string, cwd?: string): boolean {
  const config = readConfigSync(cwd) as Record<string, unknown>;

  if (!config.dependencies) {
    return false;
  }

  const dependencies = config.dependencies as Record<string, string>;

  if (!(name in dependencies)) {
    return false;
  }

  delete dependencies[name];
  writeConfigSync(config, cwd);
  return true;
}

export const spaceflowConfig = registerAs("spaceflow", (): SpaceflowConfig => {
  const fileConfig = readConfigSync();

  // 使用 zod 验证核心配置
  const result = SpaceflowCoreConfigSchema.safeParse(fileConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Spaceflow 配置验证失败:\n${errors}`);
  }

  // 返回验证后的核心配置 + 其他插件配置
  return {
    ...fileConfig,
    ...result.data,
  } as SpaceflowConfig;
});

/**
 * 加载 spaceflow.json 配置（用于 CLI 启动时）
 * 使用 zod 验证配置
 */
export function loadSpaceflowConfig(): SpaceflowConfig {
  const fileConfig = readConfigSync();

  // 使用 zod 验证核心配置
  const result = SpaceflowCoreConfigSchema.safeParse(fileConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Spaceflow 配置验证失败:\n${errors}`);
  }

  return {
    ...fileConfig,
    ...result.data,
  } as SpaceflowConfig;
}

export type { LLMMode };
