import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";
import { createServiceGiteaClient } from "../../../../../utils/gitea";
import { triggerWorkflowBodySchema } from "../../../../../shared/dto";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId")!;
  const projectId = getRouterParam(event, "projectId")!;
  await requirePermission(event, orgId, "actions:trigger", projectId);

  const body = await readValidatedBody(event, triggerWorkflowBodySchema.parse);

  const db = useDB();
  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, projectId))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createServiceGiteaClient();
  const parts = project.full_name.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";

  // workflow_id 可能是完整路径如 .github/workflows/test.yaml，提取文件名
  const workflowFile = body.workflow_id.split("/").pop() || body.workflow_id;
  await gitea.dispatchWorkflow(owner, repo, workflowFile, body.ref, body.inputs);

  return { success: true };
});
