import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 检查权限
  await requirePermission(event, repo.organization_id, "actions:view", repo.id);

  // 从数据库读取 current_run_id
  const runId = preset.current_run_id;

  if (!runId) {
    return { hasRunning: false, run: null };
  }

  const gitea = await useGiteaSdk(event).role("user");
  const db = useDB();

  // 通过 runId 查询特定运行
  try {
    const userRun = await gitea.getWorkflowRun(owner, repoName, runId);

    if (!userRun) {
      return { hasRunning: false, run: null };
    }

    const isRunning = userRun.status === "running" || userRun.status === "waiting" || userRun.status === "queued";

    // 如果运行已完成，清除数据库中的 current_run_id
    if (!isRunning) {
      await db
        .update(schema.workflowPresets)
        .set({ current_run_id: null })
        .where(eq(schema.workflowPresets.id, preset.id));
    }

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
        jobs,
      },
    };
  } catch {
    return { hasRunning: false, run: null };
  }
});
