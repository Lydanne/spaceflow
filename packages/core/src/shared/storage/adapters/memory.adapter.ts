import { StorageItem } from "../types";
import { StorageAdapter } from "./storage-adapter.interface";

/**
 * 内存存储适配器
 * 数据存储在内存中，进程重启后数据丢失
 */
export class MemoryAdapter implements StorageAdapter {
  protected store = new Map<string, StorageItem>();

  async get<T = any>(key: string): Promise<StorageItem<T> | undefined> {
    return this.store.get(key) as StorageItem<T> | undefined;
  }

  async set<T = any>(key: string, item: StorageItem<T>): Promise<void> {
    this.store.set(key, item);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());

    if (!pattern) {
      return allKeys;
    }

    // 将通配符模式转换为正则表达式
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 转义特殊字符
      .replace(/\*/g, ".*"); // * 转换为 .*

    const regex = new RegExp(`^${regexPattern}$`);
    return allKeys.filter((key) => regex.test(key));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}
