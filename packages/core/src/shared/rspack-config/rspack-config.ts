import { resolve } from "path";
import type { Configuration, RuleSetRule } from "@rspack/core";

/**
 * 插件构建配置选项
 */
export interface PluginBuildOptions {
  /** 插件名称 */
  name: string;
  /** 插件根目录路径 */
  path: string;
  /** 入口文件路径，默认 ./src/index.ts */
  entry?: string;
  /** 输出目录，默认 dist */
  outDir?: string;
  /** 是否压缩，默认 false */
  minimize?: boolean;
  /** 额外的外部依赖 */
  externals?: Configuration["externals"];
  /** 额外的 resolve alias */
  alias?: Record<string, string>;
  /** 自定义 module rules */
  rules?: RuleSetRule[];
}

/**
 * 核心框架路径配置
 */
export interface CorePathOptions {
  /** core 包根目录 */
  coreRoot: string;
}

/**
 * 默认的外部依赖列表
 */
export const DEFAULT_EXTERNALS: Configuration["externals"] = [
  // Spaceflow 核心 - 运行时从 core 加载
  { "@spaceflow/core": "module @spaceflow/core" },
  // NestJS 相关 - 这些由 core 提供
  { "@nestjs/common": "module @nestjs/common" },
  { "@nestjs/config": "module @nestjs/config" },
  { "@nestjs/core": "module @nestjs/core" },
  { "nest-commander": "module nest-commander" },
  { "reflect-metadata": "module reflect-metadata" },
  // 排除所有 node_modules（除了相对路径和 src/ 别名）
  /^(?!\.\/|\.\.\/|src\/)[^./]/,
];

/**
 * 默认的 TypeScript 编译规则
 */
export const DEFAULT_TS_RULE: RuleSetRule = {
  test: /\.ts$/,
  exclude: /node_modules/,
  loader: "builtin:swc-loader",
  options: {
    jsc: {
      parser: {
        syntax: "typescript",
        decorators: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
      },
      target: "es2022",
    },
  },
};

/**
 * 创建插件构建的 rspack 配置
 */
export function createPluginConfig(
  options: PluginBuildOptions,
  coreOptions: CorePathOptions,
): Configuration {
  const {
    name,
    path: pluginPath,
    entry = "./src/index.ts",
    outDir = "dist",
    minimize = false,
    externals: customExternals = [],
    alias: customAlias = {},
    rules: customRules = [],
  } = options;

  const { coreRoot } = coreOptions;

  // 合并外部依赖
  const mergedExternals = Array.isArray(customExternals)
    ? [...(DEFAULT_EXTERNALS as any[]), ...customExternals]
    : [...(DEFAULT_EXTERNALS as any[]), customExternals];

  // 合并 alias
  const alias = {
    "@spaceflow/core": resolve(coreRoot, "src", "index.ts"),
    ...customAlias,
  };

  // 合并 rules
  const rules = [DEFAULT_TS_RULE, ...customRules];

  return {
    name,
    context: pluginPath,
    optimization: {
      minimize,
    },
    entry: {
      index: entry,
    },
    target: "node",
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    output: {
      filename: "[name].js",
      path: resolve(pluginPath, outDir),
      library: { type: "module" },
      chunkFormat: "module",
      clean: true,
    },
    experiments: {
      outputModule: true,
    },
    externalsType: "module-import",
    externals: mergedExternals,
    resolve: {
      extensions: [".ts", ".js"],
      extensionAlias: {
        ".js": [".ts", ".js"],
      },
      alias,
    },
    module: {
      rules,
    },
  };
}

/**
 * 创建多入口插件配置
 */
export function createMultiEntryPluginConfig(
  options: Omit<PluginBuildOptions, "entry"> & {
    entries: Record<string, string>;
  },
  coreOptions: CorePathOptions,
): Configuration {
  const config = createPluginConfig({ ...options, entry: "./src/index.ts" }, coreOptions);

  return {
    ...config,
    entry: options.entries,
  };
}
