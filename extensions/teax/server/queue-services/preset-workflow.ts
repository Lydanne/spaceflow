import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { dispatchAndPoll } from "~~/server/utils/workflow-trigger";
import { persistPresetTriggerResult } from "~~/server/services/preset-run.service";
import { defineQueue } from "~~/server/queue-kit/define";

interface WorkflowPayload {
  preset_id: string;
  group_id: string;
  queued_by: string;
  branch: string;
  inputs: Record<string, string | boolean | number>;
}

/**
 * Preset workflow 队列定义
 *
 * queue_key 格式: "workflow:{repositoryId}:{workflowPath}:{branch}"
 * 按仓库 + workflow 文件 + 分支隔离队列
 */
export const presetWorkflowQueue
  = defineQueue("workflow:{repositoryId}:{workflowPath}:{branch}")
    .defaults({ concurrency: 1, autoRun: true })
    .handler<WorkflowPayload>(async (params, payload, ctx) => {
      const db = useDB();

      // 获取子预设信息
      const [preset] = await db
        .select()
        .from(schema.workflowPresets)
        .where(eq(schema.workflowPresets.id, payload.preset_id))
        .limit(1);

      if (!preset) {
        return ctx.fail("Preset not found");
      }

      // 获取仓库信息
      const [repo] = await db
        .select({
          name: schema.repositories.name,
          full_name: schema.repositories.full_name,
        })
        .from(schema.repositories)
        .where(eq(schema.repositories.id, params.repositoryId))
        .limit(1);

      if (!repo) {
        return ctx.fail("Repository not found");
      }

      const [owner, repoName] = repo.full_name.split("/");
      if (!owner || !repoName) {
        return ctx.fail("Invalid repository full_name");
      }

      // 使用 service token 触发
      const gitea = await useGiteaSdk(undefined).role("admin");

      const workflowFileName = params.workflowPath.split("/").pop() || params.workflowPath;
      const branch = payload.branch;
      const inputs = payload.inputs || {};

      const runResult = await dispatchAndPoll(gitea, {
        owner,
        repo: repoName,
        workflowFileName,
        branch,
        inputs,
      });

      // 持久化触发结果（写入 current_run_id，webhook 回调时据此关联）
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

      // 注意：不调用 ctx.complete()，queue item 保持 running 状态。
      // CI 完成后由 webhook handler（gitea.post.ts）调用 completeRunningItem 来 complete，
      // 从而确保队列串行执行（下一个任务等前一个 CI 真正跑完才触发）。

      console.log(`[preset-workflow-consumer] Dispatched item ${ctx.item.id}, run_id=${runResult.runId}, waiting for webhook to complete`);
    });
