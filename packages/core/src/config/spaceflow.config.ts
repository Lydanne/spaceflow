import { z } from "zod";
import type { LLMMode } from "../shared/llm-proxy";
import { registerPluginSchema } from "./schema-generator.service";

// 从 @spaceflow/shared 重导出配置工具函数
export {
  DEFAULT_SUPPORT_EDITOR,
  CONFIG_FILE_NAME,
  RC_FILE_NAME,
  deepMerge,
  getConfigPath,
  getConfigPaths,
  getEnvFilePaths,
  readConfigSync,
  writeConfigSync,
  getSupportedEditors,
  getDependencies,
  findConfigFileWithField,
  updateDependency,
  removeDependency,
} from "@spaceflow/shared";

import { DEFAULT_SUPPORT_EDITOR, readConfigSync } from "@spaceflow/shared";

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

/**
 * 获取 spaceflow 配置（兼容旧 API）
 * @deprecated 请使用 loadSpaceflowConfig()
 */
export function spaceflowConfig(): SpaceflowConfig {
  return loadSpaceflowConfig();
}

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
