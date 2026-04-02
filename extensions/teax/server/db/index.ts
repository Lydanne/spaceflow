import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * 运行时解析数据库连接 URL
 * 优先级：NUXT_DATABASE_URL > 分离参数拼接
 */
function resolveDatabaseUrl(config: ReturnType<typeof useRuntimeConfig>): string {
  if (config.databaseUrl) {
    return config.databaseUrl;
  }
  const user = config.postgresUser || "postgres";
  const password = config.postgresPassword || "postgres";
  const host = config.postgresHost || "localhost";
  const port = config.postgresPort || "5432";
  const database = config.postgresDb || "teax";
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
