import { config } from "dotenv";
import { existsSync } from "fs";

/**
 * 加载 .env 文件
 * 按优先级从高到低加载，先加载的变量不会被后加载的覆盖
 * @param paths .env 文件路径列表（按优先级从高到低排列）
 */
export function loadEnvFiles(paths: string[]): void {
  for (const envPath of paths) {
    if (existsSync(envPath)) {
      config({ path: envPath, override: false });
    }
  }
}
