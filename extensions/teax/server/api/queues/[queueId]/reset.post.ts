import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";
import { resetQueue, getQueueById, getQueueIdsByKeyPrefix } from "~~/server/queue-kit/service";

/**
 * POST /api/queues/:queueId/reset — 重置队列状态
 * 通过任意一个 queueId 找到同 workflow 的所有分支队列，全部重置。
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

  // 从 queue_key "workflow:{repoId}:{workflowPath}:{branch}" 中提取前缀（去掉 branch）
  const parts = queue.queue_key.split(":");
  // 前缀 = "workflow:{repoId}:{workflowPath}:"
  const keyPrefix = parts.slice(0, 3).join(":") + ":";

  // 找到所有分支的队列并逐一重置
  const allQueueIds = await getQueueIdsByKeyPrefix(keyPrefix);
  let totalCompleted = 0;
  let totalCancelled = 0;
  for (const qId of allQueueIds) {
    const { completedCount, cancelledCount } = await resetQueue(qId);
    totalCompleted += completedCount;
    totalCancelled += cancelledCount;
  }

  // 通过 queue_key 解析 repositoryId，找到对应的 group 并清除 current_run_id
  const repositoryId = parts[1];
  if (repositoryId) {
    const db = useDB();
    const [group] = await db
      .select({ id: schema.workflowPresetGroups.id })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.repository_id, repositoryId))
      .limit(1);

    if (group) {
      await db
        .update(schema.workflowPresets)
        .set({ current_run_id: null })
        .where(eq(schema.workflowPresets.group_id, group.id));
    }
  }

  return {
    success: true,
    completed_count: totalCompleted,
    cancelled_count: totalCancelled,
    message: `已重置队列：完成 ${totalCompleted} 个运行中任务，取消 ${totalCancelled} 个等待任务`,
  };
});
