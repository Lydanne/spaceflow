import { requireAuth } from "~~/server/utils/auth";
import { createQueueBodySchema } from "~~/server/queue-kit/dto";
import { findOrCreateQueue } from "~~/server/queue-kit/service";

/**
 * POST /api/queues — 创建队列
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const body = await readValidatedBody(event, createQueueBodySchema.parse);

  const queue = await findOrCreateQueue({
    queueKey: body.queue_key,
    name: body.name,
    autoRun: body.auto_run,
    concurrency: body.concurrency,
    metadata: body.metadata,
    createdBy: session.user.id,
  });

  return {
    id: queue.id,
    queue_key: queue.queue_key,
    name: queue.name,
    auto_run: queue.auto_run,
    concurrency: queue.concurrency,
    metadata: queue.metadata,
    created_by: queue.created_by,
    created_at: queue.created_at?.toISOString() ?? null,
  };
});
