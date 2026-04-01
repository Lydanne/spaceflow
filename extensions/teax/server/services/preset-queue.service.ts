import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { completeItem } from "~~/server/queue-kit/service";
import { presetWorkflowQueue } from "~~/server/queue-services/preset-workflow";

/** 队列维度标识：仓库 + workflow 路径 */
export interface WorkflowQueueKey {
  repositoryId: string;
  workflowPath: string;
}

/**
 * 清除指定 run_id 对应的 preset 的 current_run_id
 * 同时 complete 对应的 running queue item（如果有），从而触发队列下一个任务。
 * 返回 WorkflowQueueKey（repository_id + workflow_path）供后续处理队列。
 */
export async function clearCurrentRunId(runId: number): Promise<WorkflowQueueKey | null> {
  const db = useDB();

  // 查找拥有此 run_id 的 preset，关联 group 拿 repository_id + workflow_path + queue_enabled
  const [result] = await db
    .select({
      preset_id: schema.workflowPresets.id,
      group_id: schema.workflowPresets.group_id,
      repository_id: schema.workflowPresetGroups.repository_id,
      workflow_path: schema.workflowPresetGroups.workflow_path,
      queue_enabled: schema.workflowPresetGroups.queue_enabled,
    })
    .from(schema.workflowPresets)
    .innerJoin(
      schema.workflowPresetGroups,
      eq(schema.workflowPresets.group_id, schema.workflowPresetGroups.id),
    )
    .where(eq(schema.workflowPresets.current_run_id, runId))
    .limit(1);

  if (!result) return null;

  // 清除 current_run_id
  await db
    .update(schema.workflowPresets)
    .set({ current_run_id: null })
    .where(eq(schema.workflowPresets.id, result.preset_id));

  // 如果队列模式开启，complete 对应的 running queue item
  if (result.queue_enabled) {
    await completeRunningQueueItem(result.preset_id, result.repository_id, result.workflow_path, runId);
  }

  return {
    repositoryId: result.repository_id,
    workflowPath: result.workflow_path,
  };
}

/**
 * Complete 队列中正在 running 且 payload.preset_id 匹配的 queue item。
 * 由 CI 完成（webhook 回调）时调用，确保队列串行执行。
 */
async function completeRunningQueueItem(
  presetId: string,
  repositoryId: string,
  workflowPath: string,
  runId: number,
): Promise<void> {
  const db = useDB();
  const queueKey = presetWorkflowQueue.buildQueueKey(repositoryId, workflowPath);

  // 找到该队列
  const [queue] = await db
    .select({ id: schema.taskQueues.id })
    .from(schema.taskQueues)
    .where(eq(schema.taskQueues.queue_key, queueKey))
    .limit(1);

  if (!queue) return;

  // 找到 running 的 item，payload.preset_id 匹配
  const rows = await db.execute(
    sql`SELECT id FROM task_queue_items
        WHERE queue_id = ${queue.id}
          AND status = 'running'
          AND payload->>'preset_id' = ${presetId}
        LIMIT 1`,
  );
  const item = rows[0] as { id: string } | undefined;
  if (!item) return;

  console.log(`[preset-queue] Completing queue item ${item.id} for preset ${presetId}, run_id=${runId}`);
  await completeItem(item.id, { run_id: runId });
}
