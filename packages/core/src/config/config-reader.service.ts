import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SpaceflowConfig } from "./spaceflow.config";

/**
 * 系统配置（不包含插件配置）
 */
export interface SystemConfig {
  /** 已安装的技能包注册表 */
  dependencies?: Record<string, string>;
  /** 支持的编辑器列表 */
  support?: string[];
}

/**
 * 插件配置注册信息
 */
export interface PluginConfigRegistry {
  /** 插件名称 */
  name: string;
  /** 配置 key */
  configKey?: string;
  /** 依赖的其他插件配置 */
  configDependencies?: string[];
  /** 配置 schema 工厂函数 */
  configSchema?: () => unknown;
}

/** 全局插件配置注册表（使用 global 确保跨模块共享） */
const PLUGIN_REGISTRY_KEY = Symbol.for("spaceflow.pluginRegistry");
const globalAny = global as any;
if (!globalAny[PLUGIN_REGISTRY_KEY]) {
  globalAny[PLUGIN_REGISTRY_KEY] = new Map<string, PluginConfigRegistry>();
}
const pluginRegistry: Map<string, PluginConfigRegistry> = globalAny[PLUGIN_REGISTRY_KEY];

/**
 * 注册插件配置（由插件加载器调用）
 */
export function registerPluginConfig(registry: PluginConfigRegistry): void {
  if (registry.configKey) {
    pluginRegistry.set(registry.configKey, registry);
  }
}

/**
 * 获取已注册的插件配置
 */
export function getRegisteredPluginConfig(configKey: string): PluginConfigRegistry | undefined {
  return pluginRegistry.get(configKey);
}

/**
 * 配置读取服务
 * 提供三种配置读取方式：
 * 1. getPluginConfig - 读取指定插件的配置
 * 2. getOtherPluginConfig - 读取其他插件的配置（需要在 metadata 中声明依赖）
 * 3. getSystemConfig - 读取系统配置
 */
@Injectable()
export class ConfigReaderService {
  constructor(protected readonly configService: ConfigService) {}

  /**
   * 读取插件的配置
   * 使用 schema 验证并合并默认值
   * @param configKey 插件的配置 key
   * @returns 验证后的插件配置
   */
  getPluginConfig<T>(configKey: string): T {
    const rawConfig = this.configService.get<Record<string, unknown>>("spaceflow");
    const userConfig = rawConfig?.[configKey] ?? {};

    // 从注册表获取 schema 工厂函数
    const registry = pluginRegistry.get(configKey);
    const schemaFactory = registry?.configSchema;

    if (!schemaFactory || typeof schemaFactory !== "function") {
      return userConfig as T;
    }

    // 调用工厂函数获取 schema
    const schema = schemaFactory();
    if (!schema || typeof (schema as any).parse !== "function") {
      return userConfig as T;
    }

    // 使用 schema.parse() 验证并填充默认值
    try {
      return (schema as any).parse(userConfig) as T;
    } catch (error) {
      console.warn(`⚠️ 配置 "${configKey}" 验证失败:`, error);
      return userConfig as T;
    }
  }

  /**
   * 读取其他插件的配置
   * 必须在插件的 metadata.configDependencies 中声明依赖
   * @param fromConfigKey 当前插件的配置 key
   * @param targetConfigKey 目标插件的配置 key
   * @returns 合并后的插件配置
   */
  getOtherPluginConfig<T>(fromConfigKey: string, targetConfigKey: string): T {
    const fromRegistry = pluginRegistry.get(fromConfigKey);
    if (!fromRegistry) {
      throw new Error(`插件 "${fromConfigKey}" 未注册`);
    }

    // 检查是否已声明依赖
    const dependencies = fromRegistry.configDependencies ?? [];
    if (!dependencies.includes(targetConfigKey)) {
      throw new Error(
        `插件 "${fromRegistry.name}" 未声明对 "${targetConfigKey}" 配置的依赖。` +
          `请在插件 metadata 的 configDependencies 中添加 "${targetConfigKey}"`,
      );
    }

    return this.getPluginConfig<T>(targetConfigKey);
  }

  /**
   * 读取系统配置（不包含插件配置）
   * @returns 系统配置
   */
  getSystemConfig(): SystemConfig {
    const rawConfig = this.configService.get<SpaceflowConfig>("spaceflow");
    return {
      dependencies: rawConfig?.dependencies,
      support: rawConfig?.support,
    };
  }
}
