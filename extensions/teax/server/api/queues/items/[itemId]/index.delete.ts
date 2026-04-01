import { requireAdmin } from "~~/server/utils/auth";
import { cancelItem, getQueueItem } from "~~/server/queue-kit/service";

/**
 * DELETE /api/queues/items/:itemId — 取消等待中的任务
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const itemId = getRouterParam(event, "itemId");

  if (!itemId) {
    throw createError({ statusCode: 400, message: "Missing itemId" });
  }

  const item = await getQueueItem(itemId);
  if (!item) {
    throw createError({ statusCode: 404, message: "Queue item not found" });
  }

  if (item.status !== "waiting") {
    throw createError({ statusCode: 409, message: `Cannot cancel item with status: ${item.status}` });
  }

  await cancelItem(itemId);

  return { success: true };
});
