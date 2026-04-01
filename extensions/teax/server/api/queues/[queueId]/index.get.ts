import { requireAuth } from "~~/server/utils/auth";
import {
  getQueueById,
  getQueueItems,
  getRunningCount,
  getWaitingCount,
} from "~~/server/queue-kit/service";

/**
 * GET /api/queues/:queueId — 获取队列详情（含任务列表）
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const queueId = getRouterParam(event, "queueId");

  if (!queueId) {
    throw createError({ statusCode: 400, message: "Missing queueId" });
  }

  const queue = await getQueueById(queueId);
  if (!queue) {
    throw createError({ statusCode: 404, message: "Queue not found" });
  }

  const query = getQuery(event);
  const status = typeof query.status === "string" ? query.status : undefined;

  const [items, running, waiting] = await Promise.all([
    getQueueItems(queueId, status),
    getRunningCount(queueId),
    getWaitingCount(queueId),
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
