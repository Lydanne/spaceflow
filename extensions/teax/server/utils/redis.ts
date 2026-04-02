import Redis from "ioredis";

let _redis: Redis | null = null;

/**
 * 运行时解析 Redis 连接 URL
 * 优先级：NUXT_REDIS_URL > 分离参数拼接
 */
function resolveRedisUrl(config: ReturnType<typeof useRuntimeConfig>): string {
  if (config.redisUrl) {
    return config.redisUrl;
  }
  const host = config.redisHost || "localhost";
  const port = config.redisPort || "6379";
  const password = config.redisPassword || "";
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

export function useRedis(): Redis {
  if (!_redis) {
    const config = useRuntimeConfig();
    const redisUrl = resolveRedisUrl(config);
    _redis = new Redis(redisUrl);
  }
  return _redis;
}
