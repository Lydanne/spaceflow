import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";
import { resetQueue, getQueueById } from "~~/server/queue-kit/service";
import { presetWorkflowQueue } from "~~/server/queue-services/preset-workflow";

/**
 * POST /api/queues/:queueId/reset — 重置队列状态
 * 强制完成所有 running items，取消所有 waiting items，
 * 同时清除关联预设的 current_run_id。
 * 仅管理员可用。
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

  // 重置队列（complete running + cancel waiting）
  const { completedCount, cancelledCount } = await resetQueue(queueId);

  // 通过 queue_key 解析出 repositoryId + workflowPath，找到对应的 group
  const params = presetWorkflowQueue.parseQueueKey(queue.queue_key);
  if (params) {
    const db = useDB();
    // 找到 group
    const [group] = await db
      .select({ id: schema.workflowPresetGroups.id })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.repository_id, params.repositoryId))
      .limit(1);

    if (group) {
      // 清除该 group 下所有预设的 current_run_id
      await db
        .update(schema.workflowPresets)
        .set({ current_run_id: null })
        .where(
          eq(schema.workflowPresets.group_id, group.id),
        );
    }
  }

  return {
    success: true,
    completed_count: completedCount,
    cancelled_count: cancelledCount,
    message: `已重置队列：完成 ${completedCount} 个运行中任务，取消 ${cancelledCount} 个等待任务`,
  };
});
