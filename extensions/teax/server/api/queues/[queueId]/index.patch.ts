import { requireAuth } from "~~/server/utils/auth";
import { updateQueueBodySchema } from "~~/server/queue-kit/dto";
import { updateQueue, getQueueById } from "~~/server/queue-kit/service";

/**
 * PATCH /api/queues/:queueId — 更新队列配置
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const queueId = getRouterParam(event, "queueId");

  if (!queueId) {
    throw createError({ statusCode: 400, message: "Missing queueId" });
  }

  const existing = await getQueueById(queueId);
  if (!existing) {
    throw createError({ statusCode: 404, message: "Queue not found" });
  }

  const body = await readValidatedBody(event, updateQueueBodySchema.parse);

  const updated = await updateQueue(queueId, body);

  return {
    id: updated!.id,
    queue_key: updated!.queue_key,
    name: updated!.name,
    auto_run: updated!.auto_run,
    concurrency: updated!.concurrency,
    metadata: updated!.metadata,
    created_by: updated!.created_by,
    created_at: updated!.created_at?.toISOString() ?? null,
  };
});
