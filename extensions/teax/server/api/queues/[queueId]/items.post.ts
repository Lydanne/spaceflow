import { requireAuth } from "~~/server/utils/auth";
import { enqueueBodySchema } from "~~/server/queue-kit/dto";
import { enqueue, getQueueById } from "~~/server/queue-kit/service";

/**
 * POST /api/queues/:queueId/items — 添加任务到队列
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const queueId = getRouterParam(event, "queueId");

  if (!queueId) {
    throw createError({ statusCode: 400, message: "Missing queueId" });
  }

  const queue = await getQueueById(queueId);
  if (!queue) {
    throw createError({ statusCode: 404, message: "Queue not found" });
  }

  const body = await readValidatedBody(event, enqueueBodySchema.parse);

  const result = await enqueue({
    queueId,
    payload: body.payload,
    createdBy: session.user.id,
  });

  return {
    item_id: result.itemId,
    position: result.position,
  };
});
