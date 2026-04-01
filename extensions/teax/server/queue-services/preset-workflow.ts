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
 * queue_key 格式: "workflow:{repositoryId}:{workflowPath}"
 */
export const presetWorkflowQueue
  = defineQueue("workflow:{repositoryId}:{workflowPath}")
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
      await ctx.complete({
        run_id: runResult.runId,
        run_number: runResult.runNumber,
      });

      console.log(`[preset-workflow-consumer] Triggered item ${ctx.item.id}, run_id=${runResult.runId}`);
    });
