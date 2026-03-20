import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { triggerWorkflowBodySchema } from "~~/server/shared/dto";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  const body = await readValidatedBody(event, triggerWorkflowBodySchema.parse);

  // 使用用户 token 触发工作流，确保操作在用户权限范围内
  const gitea = await useGiteaSdk(event).role("user");

  // workflow_id 可能是完整路径如 .github/workflows/test.yaml，提取文件名
  const workflowFile = body.workflow_id.split("/").pop() || body.workflow_id;
  await gitea.dispatchWorkflow(owner, repo, workflowFile, body.ref, body.inputs);

  // 等待一小段时间让 Gitea 创建运行记录
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 查询最近的运行，找到刚触发的那个
  try {
    const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
    // 取最新的运行（通常就是刚触发的）
    const latestRun = runs.workflow_runs?.[0];
    if (latestRun) {
      return { success: true, run_id: latestRun.id };
    }
  } catch {
    // 忽略错误
  }

  return { success: true };
});
