import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

/** 队列维度标识：仓库 + workflow 路径 */
export interface WorkflowQueueKey {
  repositoryId: string;
  workflowPath: string;
}

/**
 * 清除指定 run_id 对应的 preset 的 current_run_id
 * 返回 WorkflowQueueKey（repository_id + workflow_path）供后续处理队列
 */
export async function clearCurrentRunId(runId: number): Promise<WorkflowQueueKey | null> {
  const db = useDB();

  // 查找拥有此 run_id 的 preset，关联 group 拿 repository_id + workflow_path
  const [result] = await db
    .select({
      preset_id: schema.workflowPresets.id,
      group_id: schema.workflowPresets.group_id,
      repository_id: schema.workflowPresetGroups.repository_id,
      workflow_path: schema.workflowPresetGroups.workflow_path,
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

  return {
    repositoryId: result.repository_id,
    workflowPath: result.workflow_path,
  };
}
