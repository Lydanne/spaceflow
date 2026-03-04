import Redis from "ioredis";

let _redis: Redis | null = null;

export function useRedis(): Redis {
  if (!_redis) {
    const config = useRuntimeConfig();
    _redis = new Redis(config.redisUrl);
  }
  return _redis;
}
