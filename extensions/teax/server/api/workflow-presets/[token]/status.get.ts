import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";
import { presetWorkflowQueue } from "~~/server/queue-services/preset-workflow";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 检查权限
  await requirePermission(event, repo.organization_id, "actions:view", repo.id);

  // 从数据库读取 current_run_id 和 last_triggered_by
  const runId = preset.current_run_id;
  const lastTriggeredById = preset.last_triggered_by;

  // 查询触发者信息
  let triggeredBy: { id: string; name: string; avatar_url: string | null } | null = null;
  if (lastTriggeredById) {
    const db = useDB();
    const [user] = await db
      .select({
        id: schema.users.id,
        name: schema.users.gitea_username,
        avatar_url: schema.users.avatar_url,
      })
      .from(schema.users)
      .where(eq(schema.users.id, lastTriggeredById))
      .limit(1);
    if (user) {
      triggeredBy = user;
    }
  }

  // 查询队列状态（当前预设是否在队列中 waiting/running）
  let queueStatus: { status: "waiting" | "running"; position: number | null } | null = null;
  if (preset.group_id) {
    const db2 = useDB();
    const [group] = await db2
      .select({
        queue_enabled: schema.workflowPresetGroups.queue_enabled,
        repository_id: schema.workflowPresetGroups.repository_id,
        workflow_path: schema.workflowPresetGroups.workflow_path,
      })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.id, preset.group_id))
      .limit(1);

    if (group?.queue_enabled) {
      const item = await presetWorkflowQueue.getItemByPayload(
        [group.repository_id, group.workflow_path],
        "preset_id",
        preset.id,
      );
      if (item) {
        queueStatus = { status: item.status, position: item.position };
      }
    }
  }

  if (!runId) {
    return { hasRunning: false, run: null, triggeredBy, queueStatus };
  }

  const gitea = await useGiteaSdk(event).role("user");

  // 通过 runId 查询特定运行
  try {
    const userRun = await gitea.getWorkflowRun(owner, repoName, runId);

    if (!userRun) {
      return { hasRunning: false, run: null, triggeredBy, queueStatus };
    }

    const isRunning = userRun.status === "running" || userRun.status === "waiting" || userRun.status === "queued" || userRun.status === "in_progress";

    // 获取 jobs 信息用于阶段显示
    let jobs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      started_at: string | null;
      completed_at: string | null;
    }> = [];

    if (isRunning || userRun.conclusion) {
      try {
        const jobsResult = await gitea.getWorkflowRunJobs(owner, repoName, userRun.id);
        jobs = (jobsResult.jobs || []).map((job) => ({
          id: job.id,
          name: job.name,
          status: job.status,
          conclusion: job.conclusion,
          started_at: job.started_at,
          completed_at: job.completed_at,
        }));
      } catch {
        // 忽略错误
      }
    }

    return {
      hasRunning: isRunning,
      run: {
        id: userRun.id,
        run_number: userRun.run_number,
        status: userRun.status,
        conclusion: userRun.conclusion,
        started_at: userRun.started_at,
        completed_at: userRun.completed_at,
        html_url: userRun.html_url,
        jobs,
      },
      triggeredBy,
      queueStatus,
    };
  } catch {
    return { hasRunning: false, run: null, triggeredBy, queueStatus };
  }
});
