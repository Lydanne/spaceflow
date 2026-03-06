import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const jobId = Number(getRouterParam(event, "jobId"));
  if (!jobId || isNaN(jobId)) {
    throw createError({ statusCode: 400, message: "Invalid job ID" });
  }

  const gitea = await createServiceGiteaClient();

  try {
    const logs = await gitea.getWorkflowJobLogs(owner, repo, jobId);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return logs;
  } catch {
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return "日志不可用（可能已被清理或 Runner 未上传日志）";
  }
});
