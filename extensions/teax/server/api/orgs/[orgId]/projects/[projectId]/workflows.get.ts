import { eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { useDB, schema } from "../../../../../db";
import { requireOrgAccess } from "../../../../../utils/org-access";
import { createGiteaService } from "../../../../../utils/gitea";

interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

function extractInputs(yamlContent: string): Record<string, WorkflowInput> | null {
  try {
    const doc = parseYaml(yamlContent);
    if (!doc || typeof doc !== "object") return null;
    const on = (doc as Record<string, unknown>).on;
    if (!on || typeof on !== "object") return null;
    const dispatch = (on as Record<string, unknown>).workflow_dispatch;
    if (!dispatch || typeof dispatch !== "object") return null;
    const inputs = (dispatch as Record<string, unknown>).inputs;
    if (!inputs || typeof inputs !== "object") return null;
    return inputs as Record<string, WorkflowInput>;
  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId")!;
  const session = await requireOrgAccess(event, orgId);
  const projectId = getRouterParam(event, "projectId")!;

  const db = useDB();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = createGiteaService(session.giteaAccessToken);
  const parts = project.fullName.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";

  try {
    const result = await gitea.getRepoWorkflows(owner, repo);
    const workflows = result.workflows || [];

    // 并行获取每个 workflow 的文件内容以解析 inputs
    const data = await Promise.all(
      workflows.map(async (w) => {
        const content = await gitea.getFileContent(owner, repo, w.path);
        const inputs = content ? extractInputs(content) : null;
        return {
          id: w.id,
          name: w.name,
          path: w.path,
          state: w.state,
          inputs: inputs || {},
        };
      }),
    );

    return { data };
  } catch {
    return { data: [] };
  }
});
