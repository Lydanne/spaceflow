import { requireAuth } from "~~/server/utils/auth";
import { completeItemBodySchema } from "~~/server/queue-kit/dto";
import { completeItem, getQueueItem } from "~~/server/queue-kit/service";

/**
 * POST /api/queues/items/:itemId/complete — 标记任务完成
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const itemId = getRouterParam(event, "itemId");

  if (!itemId) {
    throw createError({ statusCode: 400, message: "Missing itemId" });
  }

  const item = await getQueueItem(itemId);
  if (!item) {
    throw createError({ statusCode: 404, message: "Queue item not found" });
  }

  if (item.status !== "running") {
    throw createError({ statusCode: 409, message: `Cannot complete item with status: ${item.status}` });
  }

  const body = await readValidatedBody(event, completeItemBodySchema.parse);
  await completeItem(itemId, body.result);

  return { success: true };
});
