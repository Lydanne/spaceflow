import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { presetWorkflowQueue } from "~~/server/queue-services/preset-workflow";

/** 队列维度标识：仓库 + workflow 路径 + 分支 */
export interface WorkflowQueueKey {
  repositoryId: string;
  workflowPath: string;
  branch: string;
}

/**
 * 清除指定 run_id 对应的 preset 的 current_run_id
 * 同时 complete 对应的 running queue item（如果有），从而触发队列下一个任务。
 * 返回 WorkflowQueueKey（repository_id + workflow_path + branch）供后续处理队列。
 */
export async function clearCurrentRunId(runId: number): Promise<WorkflowQueueKey | null> {
  const db = useDB();

  // 查找拥有此 run_id 的 preset，关联 group 拿 repository_id + workflow_path + queue_enabled + branch
  const [result] = await db
    .select({
      preset_id: schema.workflowPresets.id,
      group_id: schema.workflowPresets.group_id,
      branch: schema.workflowPresets.branch,
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

  // 如果队列模式开启，complete 对应的 running queue item（内部自动 triggerNext）
  if (result.queue_enabled) {
    console.log(`[preset-queue] Completing queue item for preset ${result.preset_id}, run_id=${runId}`);
    await presetWorkflowQueue.completeRunningByPayload(
      [result.repository_id, result.workflow_path, result.branch],
      "preset_id",
      result.preset_id,
      { run_id: runId },
    );
  }

  return {
    repositoryId: result.repository_id,
    workflowPath: result.workflow_path,
    branch: result.branch,
  };
}
