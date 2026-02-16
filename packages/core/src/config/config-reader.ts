import type { ZodSchema } from "zod";
import { readConfigSync } from "./spaceflow.config";
import type { IConfigReader } from "../extension-system/types";

/**
 * 配置读取器
 * 不依赖 NestJS，直接读取配置文件
 */
export class ConfigReader implements IConfigReader {
  private config: Record<string, unknown>;
  private schemas = new Map<string, ZodSchema>();

  constructor(cwd?: string) {
    this.config = readConfigSync(cwd) as Record<string, unknown>;
  }

  /**
   * 获取配置值
   * @param key 配置路径（支持点分隔，如 "gitProvider.token"）
   */
  get<T>(key: string): T | undefined {
    const parts = key.split(".");
    let current: unknown = this.config;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current as T | undefined;
  }

  /**
   * 获取插件配置
   * 使用已注册的 schema 验证并填充默认值
   * @param key 插件配置 key
   */
  getPluginConfig<T>(key: string): T | undefined {
    const rawConfig = this.config[key] ?? {};
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
   * @param key 配置 key
   * @param schema Zod schema
   */
  registerSchema(key: string, schema: ZodSchema): void {
    this.schemas.set(key, schema);
  }

  /**
   * 重新加载配置
   * @param cwd 工作目录
   */
  reload(cwd?: string): void {
    this.config = readConfigSync(cwd) as Record<string, unknown>;
  }

  /**
   * 获取原始配置对象
   */
  getRawConfig(): Record<string, unknown> {
    return this.config;
  }
}
