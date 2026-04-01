import { requireAuth } from "~~/server/utils/auth";
import { failItemBodySchema } from "~~/server/queue-kit/dto";
import { failItem, getQueueItem } from "~~/server/queue-kit/service";

/**
 * POST /api/queues/items/:itemId/fail — 标记任务失败
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
    throw createError({ statusCode: 409, message: `Cannot fail item with status: ${item.status}` });
  }

  const body = await readValidatedBody(event, failItemBodySchema.parse);
  await failItem(itemId, body.error);

  return { success: true };
});
