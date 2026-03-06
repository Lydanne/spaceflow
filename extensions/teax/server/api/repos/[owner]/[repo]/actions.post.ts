import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { triggerWorkflowBodySchema } from "~~/server/shared/dto";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  const body = await readValidatedBody(event, triggerWorkflowBodySchema.parse);

  const gitea = await createServiceGiteaClient();

  // workflow_id 可能是完整路径如 .github/workflows/test.yaml，提取文件名
  const workflowFile = body.workflow_id.split("/").pop() || body.workflow_id;
  await gitea.dispatchWorkflow(owner, repo, workflowFile, body.ref, body.inputs);

  return { success: true };
});
