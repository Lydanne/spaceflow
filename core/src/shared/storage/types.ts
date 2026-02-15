/**
 * Storage 模块配置选项
 */
export interface StorageModuleOptions {
  /**
   * 适配器类型
   */
  adapter: "memory" | "file";

  /**
   * 文件适配器的存储路径（仅 file 适配器需要）
   */
  filePath?: string;

  /**
   * 默认过期时间（毫秒），0 表示永不过期
   */
  defaultTtl?: number;

  /**
   * 最大 key 数量，超过时会淘汰最早过期的 key
   * 0 或 undefined 表示不限制
   */
  maxKeys?: number;
}

/**
 * 异步模块配置选项
 */
export interface StorageModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<StorageModuleOptions> | StorageModuleOptions;
  inject?: any[];
}

/**
 * 存储项元数据
 */
export interface StorageItem<T = any> {
  value: T;
  expireAt?: number; // 过期时间戳，undefined 表示永不过期
}

/**
 * 模块配置注入 Token
 */
export const STORAGE_MODULE_OPTIONS = Symbol("STORAGE_MODULE_OPTIONS");

/**
 * 适配器注入 Token
 */
export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");
