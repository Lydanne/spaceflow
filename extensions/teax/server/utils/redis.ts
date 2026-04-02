import Redis from "ioredis";

let _redis: Redis | null = null;

/**
 * 运行时解析 Redis 连接 URL
 * 优先级：NUXT_REDIS_URL > 分离参数拼接
 */
function resolveRedisUrl(config: ReturnType<typeof useRuntimeConfig>): string {
  if (config.redis.url) {
    return config.redis.url;
  }
  const host = config.redis.host || "localhost";
  const port = config.redis.port || "6379";
  const password = config.redis.password || "";
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
