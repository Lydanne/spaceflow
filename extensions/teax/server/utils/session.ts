import { useRedis } from "./redis";

const SESSION_PREFIX = "session:";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 天

export interface SessionMeta {
  userId: string;
  username: string;
  loginAt: number;
  loginProvider: "gitea" | "feishu";
  ip?: string;
  ua?: string;
}

function sessionKey(userId: string, sessionId: string): string {
  return `${SESSION_PREFIX}${userId}:${sessionId}`;
}

function userSessionsPattern(userId: string): string {
  return `${SESSION_PREFIX}${userId}:*`;
}

export function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b: number) => b.toString(16).padStart(2, "0")).join("");
}

export async function registerSession(
  userId: string,
  sessionId: string,
  meta: SessionMeta,
): Promise<void> {
  const redis = useRedis();
  const key = sessionKey(userId, sessionId);
  await redis.set(key, JSON.stringify(meta), "EX", SESSION_TTL);
}

export async function isSessionValid(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const redis = useRedis();
  const key = sessionKey(userId, sessionId);
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function removeSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const redis = useRedis();
  const key = sessionKey(userId, sessionId);
  await redis.del(key);
}

export async function removeAllUserSessions(userId: string): Promise<void> {
  const redis = useRedis();
  const keys = await redis.keys(userSessionsPattern(userId));
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function getUserActiveSessions(
  userId: string,
): Promise<Array<SessionMeta & { sessionId: string }>> {
  const redis = useRedis();
  const keys = await redis.keys(userSessionsPattern(userId));
  const sessions: Array<SessionMeta & { sessionId: string }> = [];

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const sessionId = key.split(":").pop()!;
      sessions.push({ ...JSON.parse(data), sessionId });
    }
  }

  return sessions;
}
