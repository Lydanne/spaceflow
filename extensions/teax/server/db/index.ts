import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * 运行时解析数据库连接 URL
 * 优先级：NUXT_DATABASE_URL > 分离参数拼接
 */
function resolveDatabaseUrl(config: ReturnType<typeof useRuntimeConfig>): string {
  if (config.database.url) {
    return config.database.url;
  }
  const user = config.database.user || "postgres";
  const password = config.database.password || "postgres";
  const host = config.database.host || "localhost";
  const port = config.database.port || "5432";
  const database = config.database.db || "teax";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function useDB() {
  if (!_db) {
    const config = useRuntimeConfig();
    const databaseUrl = resolveDatabaseUrl(config);
    const client = postgres(databaseUrl);
    _db = drizzle(client, { schema });
  }
  return _db;
}

export { schema };
