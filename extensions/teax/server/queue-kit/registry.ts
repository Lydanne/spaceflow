import type { InferSelectModel } from "drizzle-orm";
import type { taskQueues, taskQueueItems } from "~~/server/db/schema/task-queue";

export type TaskQueue = InferSelectModel<typeof taskQueues>;
export type TaskQueueItem = InferSelectModel<typeof taskQueueItems>;

/**
 * 消费者处理函数签名
 * - item: 当前被触发的队列任务项
 * - queue: 所属队列
 *
 * 消费者负责执行业务逻辑，执行完成后应调用 completeItem 或 failItem。
 * 如果 handler 本身抛出异常，队列服务会自动调用 failItem。
 */
export type ConsumerHandler = (
  item: TaskQueueItem,
  queue: TaskQueue,
) => Promise<void>;

/**
 * 全局消费者注册表
 * key: queue_key 的前缀（如 "workflow:" 匹配所有 workflow 开头的队列）
 * 也支持精确匹配
 */
const consumers = new Map<string, ConsumerHandler>();

/**
 * 注册消费者
 * @param keyPattern queue_key 前缀或精确值
 * @param handler 消费函数
 */
export function registerConsumer(keyPattern: string, handler: ConsumerHandler): void {
  consumers.set(keyPattern, handler);
}

/**
 * 查找匹配的消费者
 * 优先精确匹配，然后前缀匹配（最长前缀优先）
 */
export function findConsumer(queueKey: string): ConsumerHandler | null {
  // 精确匹配
  if (consumers.has(queueKey)) {
    return consumers.get(queueKey)!;
  }

  // 前缀匹配（最长优先）
  let bestMatch: ConsumerHandler | null = null;
  let bestLength = 0;

  for (const [pattern, handler] of consumers) {
    if (queueKey.startsWith(pattern) && pattern.length > bestLength) {
      bestMatch = handler;
      bestLength = pattern.length;
    }
  }

  return bestMatch;
}

/**
 * 获取所有已注册的消费者 pattern（调试用）
 */
export function getRegisteredPatterns(): string[] {
  return [...consumers.keys()];
}
