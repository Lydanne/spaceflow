import { useRedis } from "./redis";

const TOKEN_PREFIX = "feishu_select:";
const TOKEN_TTL = 60 * 5; // 5 分钟有效期

export interface FeishuSelectData {
  openId: string;
  userIds: string[];
  feishuName: string;
  feishuAvatar: string;
}

export function generateSelectToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b: number) => b.toString(16).padStart(2, "0")).join("");
}

export async function storeFeishuSelectToken(
  token: string,
  data: FeishuSelectData,
): Promise<void> {
  const redis = useRedis();
  const key = `${TOKEN_PREFIX}${token}`;
  await redis.set(key, JSON.stringify(data), "EX", TOKEN_TTL);
}

export async function getFeishuSelectData(token: string): Promise<FeishuSelectData | null> {
  const redis = useRedis();
  const key = `${TOKEN_PREFIX}${token}`;
  const data = await redis.get(key);
  if (!data) {
    return null;
  }
  return JSON.parse(data);
}

export async function consumeFeishuSelectToken(token: string): Promise<FeishuSelectData | null> {
  const redis = useRedis();
  const key = `${TOKEN_PREFIX}${token}`;
  const data = await redis.get(key);
  if (!data) {
    return null;
  }
  // 一次性使用后删除
  await redis.del(key);
  return JSON.parse(data);
}
