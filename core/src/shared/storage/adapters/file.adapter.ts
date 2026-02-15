import * as fs from "fs";
import * as path from "path";
import { StorageItem } from "../types";
import { StorageAdapter } from "./storage-adapter.interface";

/**
 * 文件存储适配器
 * 数据持久化到 JSON 文件，支持进程重启后恢复
 */
export class FileAdapter implements StorageAdapter {
  protected store = new Map<string, StorageItem>();
  protected filePath: string;
  protected saveTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly debounceMs = 100; // 防抖延迟

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  /**
   * 从文件加载数据
   */
  protected load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(data) as Record<string, StorageItem>;
        this.store = new Map(Object.entries(parsed));
      }
    } catch {
      // 文件不存在或解析失败，使用空存储
      this.store = new Map();
    }
  }

  /**
   * 保存数据到文件（防抖）
   */
  protected save(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveSync();
      this.saveTimer = null;
    }, this.debounceMs);
  }

  /**
   * 同步保存数据到文件
   */
  protected saveSync(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Object.fromEntries(this.store);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save storage file:", error);
    }
  }

  async get<T = any>(key: string): Promise<StorageItem<T> | undefined> {
    return this.store.get(key) as StorageItem<T> | undefined;
  }

  async set<T = any>(key: string, item: StorageItem<T>): Promise<void> {
    this.store.set(key, item);
    this.save();
  }

  async delete(key: string): Promise<boolean> {
    const result = this.store.delete(key);
    if (result) {
      this.save();
    }
    return result;
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
    this.save();
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}
