import { requireAdmin } from "~~/server/utils/auth";
import { triggerNext, getQueueById } from "~~/server/queue-kit/service";

/**
 * POST /api/queues/:queueId/trigger — 手动触发队列中下一个任务
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const queueId = getRouterParam(event, "queueId");

  if (!queueId) {
    throw createError({ statusCode: 400, message: "Missing queueId" });
  }

  const queue = await getQueueById(queueId);
  if (!queue) {
    throw createError({ statusCode: 404, message: "Queue not found" });
  }

  const item = await triggerNext(queueId);

  if (!item) {
    return {
      triggered: false,
      message: "No waiting items or concurrency limit reached",
    };
  }

  return {
    triggered: true,
    item_id: item.id,
    message: "Task triggered",
  };
});
