import { ConfigReader, type IConfigReader } from "@spaceflow/core";
import type { ZodSchema } from "zod";

/**
 * 环境变量映射配置
 * key: 配置路径（如 "gitProvider.token"）
 * value: 环境变量名或环境变量名数组（按优先级）
 */
const ENV_MAPPINGS: Record<string, string | string[]> = {
  // Git Provider
  "gitProvider.token": ["GIT_PROVIDER_TOKEN", "GITHUB_TOKEN", "GITLAB_TOKEN", "GITEA_TOKEN"],
  "gitProvider.serverUrl": ["GIT_PROVIDER_SERVER_URL", "GITHUB_API_URL"],
  // OpenAI
  "llm.openai.apiKey": "OPENAI_API_KEY",
  "llm.openai.baseUrl": "OPENAI_BASE_URL",
  "llm.openai.model": "OPENAI_MODEL",
  // Gemini
  "llm.gemini.apiKey": "GEMINI_API_KEY",
  "llm.gemini.model": "GEMINI_MODEL",
  // Claude
  "llm.claudeCode.authToken": "ANTHROPIC_API_KEY",
};

/**
 * 从环境变量获取值
 */
function getEnvValue(envNames: string | string[]): string | undefined {
  const names = Array.isArray(envNames) ? envNames : [envNames];
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

/**
 * 设置嵌套对象的值
 */
function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * 统一配置服务
 * 负责从配置文件和环境变量读取配置
 */
export class UnifiedConfigReader implements IConfigReader {
  private baseReader: ConfigReader;
  private mergedConfig: Record<string, unknown>;
  private schemas = new Map<string, ZodSchema>();

  constructor(cwd?: string) {
    this.baseReader = new ConfigReader(cwd);
    this.mergedConfig = this.mergeEnvConfig(this.baseReader.getRawConfig());
  }

  /**
   * 合并环境变量到配置
   */
  private mergeEnvConfig(config: Record<string, unknown>): Record<string, unknown> {
    const merged = JSON.parse(JSON.stringify(config));
    for (const [path, envNames] of Object.entries(ENV_MAPPINGS)) {
      const envValue = getEnvValue(envNames);
      if (envValue && !getNestedValue(merged, path)) {
        setNestedValue(merged, path, envValue);
      }
    }
    // 特殊处理：如果有 OPENAI_API_KEY 但没有 llm.openai，创建默认配置
    if (process.env.OPENAI_API_KEY && !merged.llm) {
      merged.llm = {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
          model: process.env.OPENAI_MODEL,
        },
      };
    }
    return merged;
  }

  /**
   * 获取配置值
   */
  get<T>(key: string): T | undefined {
    const parts = key.split(".");
    let current: unknown = this.mergedConfig;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current as T | undefined;
  }

  /**
   * 获取插件配置（带 schema 验证）
   */
  getPluginConfig<T>(key: string): T | undefined {
    const rawConfig = this.mergedConfig[key] ?? {};
    const schema = this.schemas.get(key);
    if (!schema) {
      return rawConfig as T;
    }
    try {
      return schema.parse(rawConfig) as T;
    } catch (error) {
      console.warn(`⚠️ 配置 "${key}" 验证失败:`, error);
      return rawConfig as T;
    }
  }

  /**
   * 注册配置 schema
   */
  registerSchema(key: string, schema: ZodSchema): void {
    this.schemas.set(key, schema);
  }

  /**
   * 重新加载配置
   */
  reload(cwd?: string): void {
    this.baseReader.reload(cwd);
    this.mergedConfig = this.mergeEnvConfig(this.baseReader.getRawConfig());
  }

  /**
   * 获取原始配置对象
   */
  getRawConfig(): Record<string, unknown> {
    return this.mergedConfig;
  }
}
