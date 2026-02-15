import { StorageItem } from "../types";

/**
 * Storage 适配器接口
 * 所有适配器必须实现此接口
 */
export interface StorageAdapter {
  /**
   * 获取存储项
   * @param key 键名
   */
  get<T = any>(key: string): Promise<StorageItem<T> | undefined>;

  /**
   * 设置存储项
   * @param key 键名
   * @param item 存储项
   */
  set<T = any>(key: string, item: StorageItem<T>): Promise<void>;

  /**
   * 删除存储项
   * @param key 键名
   */
  delete(key: string): Promise<boolean>;

  /**
   * 检查键是否存在
   * @param key 键名
   */
  has(key: string): Promise<boolean>;

  /**
   * 获取所有键名
   * @param pattern 可选的匹配模式，支持 * 通配符
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * 清空所有存储
   */
  clear(): Promise<void>;

  /**
   * 获取当前存储的 key 数量
   */
  size(): Promise<number>;
}
