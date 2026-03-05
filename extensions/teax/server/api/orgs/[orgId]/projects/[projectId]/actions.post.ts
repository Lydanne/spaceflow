import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requirePermission } from "../../../../../utils/permission";
import { createServiceGiteaClient } from "../../../../../utils/gitea";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId")!;
  const projectId = getRouterParam(event, "projectId")!;
  await requirePermission(event, orgId, "actions:trigger", projectId);

  const body = await readBody<{
    workflowId: string;
    ref: string;
    inputs?: Record<string, string>;
  }>(event);

  if (!body.workflowId || !body.ref) {
    throw createError({ statusCode: 400, message: "Missing workflowId or ref" });
  }

  const db = useDB();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createServiceGiteaClient();
  const parts = project.fullName.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";

  // workflowId 可能是完整路径如 .github/workflows/test.yaml，提取文件名
  const workflowFile = body.workflowId.split("/").pop() || body.workflowId;
  await gitea.dispatchWorkflow(owner, repo, workflowFile, body.ref, body.inputs);

  return { success: true };
});
