import { type StorageAdapter } from "./adapters/storage-adapter.interface";
import { type StorageModuleOptions } from "./types";
import type { IStorageService } from "../../extension-system/types";

/**
 * Storage 服务
 * 提供统一的键值存储接口，支持过期时间和层级 key
 *
 * Key 使用 : 作为层级分隔符，例如：
 * - user:123:profile
 * - cache:api:users
 */
export class StorageService implements IStorageService {
  protected cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    protected readonly adapter: StorageAdapter,
    protected readonly options: StorageModuleOptions = {},
  ) {
    // 启动定期清理过期项的定时器
    this.startCleanupTimer();
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 启动定期清理过期项的定时器
   */
  protected startCleanupTimer(): void {
    // 每分钟清理一次过期项
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, 60 * 1000);
  }

  /**
   * 清理所有过期项
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const allKeys = await this.adapter.keys();
    let cleaned = 0;

    for (const key of allKeys) {
      const item = await this.adapter.get(key);
      if (item && item.expireAt && item.expireAt <= now) {
        await this.adapter.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取值
   * @param key 键名，支持 : 分隔的层级结构
   * @returns 值，如果不存在或已过期返回 undefined
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    const item = await this.adapter.get<T>(key);

    if (!item) {
      return undefined;
    }

    // 检查是否过期
    if (item.expireAt && item.expireAt <= Date.now()) {
      await this.adapter.delete(key);
      return undefined;
    }

    return item.value;
  }

  /**
   * 设置值
   * @param key 键名，支持 : 分隔的层级结构
   * @param value 值
   * @param ttl 过期时间（毫秒），0 或 undefined 表示使用默认值
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.options.defaultTtl ?? 0;

    // 检查是否需要淘汰
    if (this.options.maxKeys && this.options.maxKeys > 0) {
      const exists = await this.adapter.has(key);
      if (!exists) {
        await this.evictIfNeeded();
      }
    }

    await this.adapter.set(key, {
      value,
      expireAt: effectiveTtl > 0 ? Date.now() + effectiveTtl : undefined,
    });
  }

  /**
   * 如果超过最大 key 数量，淘汰最早过期的 key
   */
  protected async evictIfNeeded(): Promise<void> {
    const maxKeys = this.options.maxKeys;
    if (!maxKeys || maxKeys <= 0) return;

    const currentSize = await this.adapter.size();
    if (currentSize < maxKeys) return;

    // 先清理过期的 key
    await this.cleanup();

    // 再次检查
    const sizeAfterCleanup = await this.adapter.size();
    if (sizeAfterCleanup < maxKeys) return;

    // 仍然超过限制，淘汰最早过期的 key
    const allKeys = await this.adapter.keys();
    const keyWithExpire: { key: string; expireAt: number }[] = [];

    for (const key of allKeys) {
      const item = await this.adapter.get(key);
      if (item) {
        keyWithExpire.push({
          key,
          expireAt: item.expireAt ?? Infinity, // 永不过期的放最后
        });
      }
    }

    // 按过期时间排序，最早过期的在前面
    keyWithExpire.sort((a, b) => a.expireAt - b.expireAt);

    // 淘汰超出的 key
    const toEvict = sizeAfterCleanup - maxKeys + 1; // +1 为新 key 腾出空间
    for (let i = 0; i < toEvict && i < keyWithExpire.length; i++) {
      await this.adapter.delete(keyWithExpire[i].key);
    }
  }

  /**
   * 删除值
   * @param key 键名
   * @returns 是否删除成功
   */
  async del(key: string): Promise<boolean> {
    return this.adapter.delete(key);
  }

  /**
   * 检查键是否存在（且未过期）
   * @param key 键名
   */
  async has(key: string): Promise<boolean> {
    const item = await this.adapter.get(key);

    if (!item) {
      return false;
    }

    // 检查是否过期
    if (item.expireAt && item.expireAt <= Date.now()) {
      await this.adapter.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取匹配的键名列表
   * @param pattern 匹配模式，支持 * 通配符
   *
   * 示例：
   * - keys('user:*') 获取所有以 user: 开头的键
   * - keys('*:profile') 获取所有以 :profile 结尾的键
   * - keys('user:*:settings') 获取匹配模式的键
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = await this.adapter.keys(pattern);
    const now = Date.now();
    const validKeys: string[] = [];

    // 过滤掉已过期的键
    for (const key of allKeys) {
      const item = await this.adapter.get(key);
      if (item && (!item.expireAt || item.expireAt > now)) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * 获取指定前缀下的所有键
   * @param prefix 前缀，例如 'user:123'
   */
  async keysWithPrefix(prefix: string): Promise<string[]> {
    return this.keys(`${prefix}:*`);
  }

  /**
   * 删除指定前缀下的所有键
   * @param prefix 前缀
   * @returns 删除的键数量
   */
  async delByPrefix(prefix: string): Promise<number> {
    const keysToDelete = await this.keysWithPrefix(prefix);
    let deleted = 0;

    for (const key of keysToDelete) {
      if (await this.adapter.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * 设置过期时间
   * @param key 键名
   * @param ttl 过期时间（毫秒）
   * @returns 是否设置成功
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const item = await this.adapter.get(key);

    if (!item) {
      return false;
    }

    // 检查是否已过期
    if (item.expireAt && item.expireAt <= Date.now()) {
      await this.adapter.delete(key);
      return false;
    }

    await this.adapter.set(key, {
      ...item,
      expireAt: ttl > 0 ? Date.now() + ttl : undefined,
    });

    return true;
  }

  /**
   * 获取剩余过期时间
   * @param key 键名
   * @returns 剩余时间（毫秒），-1 表示永不过期，undefined 表示键不存在
   */
  async ttl(key: string): Promise<number | undefined> {
    const item = await this.adapter.get(key);

    if (!item) {
      return undefined;
    }

    // 检查是否已过期
    if (item.expireAt && item.expireAt <= Date.now()) {
      await this.adapter.delete(key);
      return undefined;
    }

    if (!item.expireAt) {
      return -1; // 永不过期
    }

    return item.expireAt - Date.now();
  }

  /**
   * 清空所有存储
   */
  async clear(): Promise<void> {
    await this.adapter.clear();
  }

  /**
   * 获取当前存储的 key 数量
   */
  async size(): Promise<number> {
    return this.adapter.size();
  }
}
