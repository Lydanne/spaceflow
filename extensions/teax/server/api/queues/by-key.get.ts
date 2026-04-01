import { requireAuth } from "~~/server/utils/auth";
import {
  getQueueByKey,
  getQueueItems,
  getRunningCount,
  getWaitingCount,
} from "~~/server/queue-kit/service";

/**
 * GET /api/queues/by-key?key=xxx — 按 queue_key 查询队列
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const query = getQuery(event);
  const key = typeof query.key === "string" ? query.key : "";

  if (!key) {
    throw createError({ statusCode: 400, message: "Missing key parameter" });
  }

  const queue = await getQueueByKey(key);
  if (!queue) {
    throw createError({ statusCode: 404, message: "Queue not found" });
  }

  const status = typeof query.status === "string" ? query.status : undefined;

  const [items, running, waiting] = await Promise.all([
    getQueueItems(queue.id, status),
    getRunningCount(queue.id),
    getWaitingCount(queue.id),
  ]);

  return {
    id: queue.id,
    queue_key: queue.queue_key,
    name: queue.name,
    auto_run: queue.auto_run,
    concurrency: queue.concurrency,
    metadata: queue.metadata,
    created_by: queue.created_by,
    created_at: queue.created_at?.toISOString() ?? null,
    running_count: running,
    waiting_count: waiting,
    items: items.map((item) => ({
      id: item.id,
      queue_id: item.queue_id,
      position: item.position,
      status: item.status,
      payload: item.payload,
      result: item.result,
      error: item.error,
      created_by: item.created_by,
      created_at: item.created_at?.toISOString() ?? null,
      started_at: item.started_at?.toISOString() ?? null,
      completed_at: item.completed_at?.toISOString() ?? null,
    })),
  };
});
