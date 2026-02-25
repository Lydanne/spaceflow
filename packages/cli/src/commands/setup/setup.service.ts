import { existsSync, readFileSync, writeFileSync } from "fs";
import { t } from "@spaceflow/core";
import { join } from "path";
import { homedir } from "os";
import stringify from "json-stringify-pretty-compact";
import {
  CONFIG_FILE_NAME,
  RC_FILE_NAME,
  getConfigPath,
  readConfigSync,
  type SpaceflowConfig,
  SchemaGeneratorService,
  SPACEFLOW_DIR,
  ensureSpaceflowPackageJson,
} from "@spaceflow/core";

export class SetupService {
  constructor(private readonly schemaGenerator: SchemaGeneratorService) {}
  /**
   * 本地初始化：创建 .spaceflow/ 目录和 package.json
   */
  async setupLocal(): Promise<void> {
    const cwd = process.cwd();

    // 1. 创建 .spaceflow/ 目录和 package.json
    const spaceflowDir = join(cwd, SPACEFLOW_DIR);
    ensureSpaceflowPackageJson(spaceflowDir);
    console.log(t("setup:dirCreated", { dir: spaceflowDir }));

    // 2. 创建 spaceflow.json 配置文件（运行时配置）
    const configPath = getConfigPath(cwd);
    const rcPath = join(cwd, RC_FILE_NAME);
    if (!existsSync(configPath) && !existsSync(rcPath)) {
      this.schemaGenerator.generate();
      const defaultConfig: Partial<SpaceflowConfig> = {
        $schema: "./config-schema.json",
        support: ["claudeCode"],
      };
      writeFileSync(configPath, stringify(defaultConfig, { indent: 2 }) + "\n");
      console.log(t("setup:configGenerated", { path: configPath }));
    } else {
      const existingPath = existsSync(rcPath) ? rcPath : configPath;
      console.log(t("setup:configExists", { path: existingPath }));
    }
  }

  /**
   * 全局初始化：创建 ~/.spaceflow/ 目录和 package.json，并合并配置
   */
  async setupGlobal(): Promise<void> {
    const cwd = process.cwd();
    const globalDir = join(homedir(), SPACEFLOW_DIR);
    const globalConfigPath = join(globalDir, CONFIG_FILE_NAME);

    // 1. 创建 ~/.spaceflow/ 目录和 package.json
    ensureSpaceflowPackageJson(globalDir);
    console.log(t("setup:dirCreated", { dir: globalDir }));

    // 读取本地配置（支持 .spaceflow/spaceflow.json 和 .spaceflowrc）
    const localConfig = readConfigSync(cwd);
    if (Object.keys(localConfig).length > 0) {
      console.log(t("setup:localConfigRead"));
    }

    // 读取本地 .env 文件并解析为配置
    const envPath = join(cwd, ".env");
    const envConfig = this.parseEnvToConfig(envPath);

    const instanceConfig = (global as any).spaceflowConfig ?? {};

    // 合并配置：本地配置（已含全局） < 实例配置 < 环境变量配置
    const mergedConfig = this.deepMerge(localConfig, instanceConfig, envConfig);

    // 写入全局配置
    writeFileSync(globalConfigPath, stringify(mergedConfig, { indent: 2 }) + "\n");
    console.log(t("setup:globalConfigGenerated", { path: globalConfigPath }));

    // 显示合并的环境变量
    if (Object.keys(envConfig).length > 0) {
      console.log(t("setup:envConfigMerged"));
      this.printConfigTree(envConfig, "   ");
    }
  }

  /**
   * 解析 .env 文件为配置对象
   * 支持嵌套格式：SPACEFLOW_GIT_PROVIDER_SERVER_URL -> { gitProvider: { serverUrl: "..." } }
   */
  private parseEnvToConfig(envPath: string): Record<string, unknown> {
    if (!existsSync(envPath)) {
      return {};
    }

    const config: Record<string, unknown> = {};

    try {
      const content = readFileSync(envPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // 移除引号
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // 只处理 SPACEFLOW_ 前缀的环境变量
        if (!key.startsWith("SPACEFLOW_")) continue;

        // 转换为嵌套配置
        // SPACEFLOW_GIT_PROVIDER_SERVER_URL -> gitProvider.serverUrl
        const parts = key
          .slice("SPACEFLOW_".length)
          .toLowerCase()
          .split("_")
          .map((part, index) => {
            // 第一个部分保持小写，后续部分转为 camelCase
            if (index === 0) return part;
            return part.charAt(0).toUpperCase() + part.slice(1);
          });

        // 重新组织为嵌套结构
        // 例如: ["git", "Provider", "Server", "Url"] -> { gitProviderServerUrl: value }
        // 简化处理：按照常见模式分组
        this.setNestedValue(config, parts, value);
      }

      console.log(t("setup:envRead", { path: envPath }));
    } catch {
      console.warn(t("setup:envReadFailed", { path: envPath }));
    }

    return config;
  }

  /**
   * 设置嵌套值
   * 例如: ["review", "Gitea", "Server", "Url"] 和 value
   * 结果: { review: { giteaServerUrl: value } }
   */
  private setNestedValue(obj: Record<string, unknown>, parts: string[], value: string): void {
    if (parts.length === 0) return;

    // 第一个部分作为顶级 key（如 review, commit 等）
    const topKey = parts[0];

    if (parts.length === 1) {
      obj[topKey] = value;
      return;
    }

    // 剩余部分合并为 camelCase 作为嵌套 key
    // 例如: ["Gitea", "Server", "Url"] -> giteaServerUrl
    const restParts = parts.slice(1);
    const nestedKey = restParts
      .map((part, index) => (index === 0 ? part.toLowerCase() : part))
      .join("");

    if (!obj[topKey] || typeof obj[topKey] !== "object") {
      obj[topKey] = {};
    }

    (obj[topKey] as Record<string, unknown>)[nestedKey] = value;
  }

  /**
   * 深度合并对象
   */
  private deepMerge<T extends Record<string, unknown>>(...objects: Partial<T>[]): Partial<T> {
    const result: Record<string, unknown> = {};

    for (const obj of objects) {
      for (const key in obj) {
        const value = obj[key];
        const existing = result[key];

        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          existing !== null &&
          typeof existing === "object" &&
          !Array.isArray(existing)
        ) {
          result[key] = this.deepMerge(
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
   * 打印配置树
   */
  private printConfigTree(config: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        console.log(`${prefix}${key}:`);
        this.printConfigTree(value as Record<string, unknown>, prefix + "  ");
      } else {
        // 隐藏敏感值
        const displayValue = this.isSensitiveKey(key) ? "***" : String(value);
        console.log(`${prefix}${key}: ${displayValue}`);
      }
    }
  }

  /**
   * 判断是否为敏感 key
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = ["token", "secret", "password", "key", "apikey"];
    const lowerKey = key.toLowerCase();
    return sensitivePatterns.some((pattern) => lowerKey.includes(pattern));
  }
}
