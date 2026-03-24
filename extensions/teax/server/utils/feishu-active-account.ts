/**
 * 飞书用户当前活跃账户管理
 * 支持一个飞书账号绑定多个 Teax 账户时，选择当前使用的账户
 */

import { useRedis } from "./redis";

const ACTIVE_ACCOUNT_PREFIX = "feishu:active_account:";
const ACTIVE_ACCOUNT_TTL = 60 * 60 * 24 * 30; // 30 天

/**
 * 获取飞书用户当前活跃的 Teax 账户 ID
 */
export async function getActiveAccountId(openId: string): Promise<string | null> {
  const redis = useRedis();
  const key = `${ACTIVE_ACCOUNT_PREFIX}${openId}`;
  return await redis.get(key);
}

/**
 * 设置飞书用户当前活跃的 Teax 账户 ID
 */
export async function setActiveAccountId(openId: string, userId: string): Promise<void> {
  const redis = useRedis();
  const key = `${ACTIVE_ACCOUNT_PREFIX}${openId}`;
  await redis.setex(key, ACTIVE_ACCOUNT_TTL, userId);
}

/**
 * 清除飞书用户当前活跃账户（解绑时调用）
 */
export async function clearActiveAccountId(openId: string): Promise<void> {
  const redis = useRedis();
  const key = `${ACTIVE_ACCOUNT_PREFIX}${openId}`;
  await redis.del(key);
}
