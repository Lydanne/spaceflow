import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { dispatchAndPoll } from "~~/server/utils/workflow-trigger";
import { persistPresetTriggerResult } from "~~/server/services/preset-run.service";
import { registerConsumer, type TaskQueueItem, type TaskQueue } from "~~/server/queue-kit/registry";
import { completeItem, failItem } from "~~/server/queue-kit/service";

/**
 * Workflow queue key 格式: "workflow:{repositoryId}:{workflowPath}"
 */
export const WORKFLOW_QUEUE_PREFIX = "workflow:";

export function buildWorkflowQueueKey(repositoryId: string, workflowPath: string): string {
  return `${WORKFLOW_QUEUE_PREFIX}${repositoryId}:${workflowPath}`;
}

export function parseWorkflowQueueKey(queueKey: string): { repositoryId: string; workflowPath: string } | null {
  if (!queueKey.startsWith(WORKFLOW_QUEUE_PREFIX)) return null;
  const rest = queueKey.slice(WORKFLOW_QUEUE_PREFIX.length);
  const idx = rest.indexOf(":");
  if (idx === -1) return null;
  return {
    repositoryId: rest.slice(0, idx),
    workflowPath: rest.slice(idx + 1),
  };
}

/**
 * Preset workflow 消费者处理函数
 * payload 格式: { preset_id, group_id, queued_by, branch, inputs }
 */
async function handlePresetWorkflowItem(item: TaskQueueItem, queue: TaskQueue): Promise<void> {
  const db = useDB();
  const payload = item.payload as {
    preset_id: string;
    group_id: string;
    queued_by: string;
    branch: string;
    inputs: Record<string, string | boolean | number>;
  };

  const parsed = parseWorkflowQueueKey(queue.queue_key);
  if (!parsed) {
    await failItem(item.id, "Invalid workflow queue key");
    return;
  }

  try {
    // 获取子预设信息
    const [preset] = await db
      .select()
      .from(schema.workflowPresets)
      .where(eq(schema.workflowPresets.id, payload.preset_id))
      .limit(1);

    if (!preset) {
      await failItem(item.id, "Preset not found");
      return;
    }

    // 获取仓库信息
    const [repo] = await db
      .select({
        name: schema.repositories.name,
        full_name: schema.repositories.full_name,
      })
      .from(schema.repositories)
      .where(eq(schema.repositories.id, parsed.repositoryId))
      .limit(1);

    if (!repo) {
      await failItem(item.id, "Repository not found");
      return;
    }

    const [owner, repoName] = repo.full_name.split("/");
    if (!owner || !repoName) {
      await failItem(item.id, "Invalid repository full_name");
      return;
    }

    // 使用 service token 触发
    const gitea = await useGiteaSdk(undefined).role("admin");

    const workflowFileName = parsed.workflowPath.split("/").pop() || parsed.workflowPath;
    const branch = payload.branch;
    const inputs = payload.inputs || {};

    const runResult = await dispatchAndPoll(gitea, {
      owner,
      repo: repoName,
      workflowFileName,
      branch,
      inputs,
    });

    // 持久化触发结果
    await persistPresetTriggerResult({
      preset: {
        ...preset,
        inputs: preset.inputs as Record<string, string | boolean | number> | null,
        locked_inputs: preset.locked_inputs as string[] | null,
      },
      actorId: payload.queued_by,
      runId: runResult.runId,
      runNumber: runResult.runNumber,
      branch,
      inputs,
    });

    // 标记完成
    await completeItem(item.id, {
      run_id: runResult.runId,
      run_number: runResult.runNumber,
    });

    console.log(`[preset-workflow-consumer] Triggered item ${item.id}, run_id=${runResult.runId}`);
  } catch (err) {
    console.error(`[preset-workflow-consumer] Failed item ${item.id}:`, err);
    await failItem(item.id, (err as Error).message?.slice(0, 2048) || "Unknown error");
  }
}

/**
 * 注册 preset workflow 消费者
 * 在服务器启动时调用
 */
export function registerPresetWorkflowConsumer(): void {
  registerConsumer(WORKFLOW_QUEUE_PREFIX, handlePresetWorkflowItem);
  console.log("[preset-workflow-consumer] Registered consumer for prefix:", WORKFLOW_QUEUE_PREFIX);
}
