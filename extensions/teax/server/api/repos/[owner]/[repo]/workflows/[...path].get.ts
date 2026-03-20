import { parse as parseYaml } from "yaml";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

function parseWorkflowYaml(yamlContent: string) {
  try {
    const doc = parseYaml(yamlContent);
    if (!doc || typeof doc !== "object") return null;
    return doc as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractInputs(doc: Record<string, unknown>): Record<string, WorkflowInputDef> | null {
  const on = doc.on;
  if (!on || typeof on !== "object") return null;
  const dispatch = (on as Record<string, unknown>).workflow_dispatch;
  if (!dispatch || typeof dispatch !== "object") return null;
  const inputs = (dispatch as Record<string, unknown>).inputs;
  if (!inputs || typeof inputs !== "object") return null;
  return inputs as Record<string, WorkflowInputDef>;
}

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  // 从 URL 提取文件名（Nitro 会截断 .yml/.yaml 扩展名，需要从完整路径恢复）
  const url = getRequestURL(event);
  const urlMatch = url.pathname.match(/\/workflows\/(.+?)$/);
  const fileName = urlMatch?.[1] ? decodeURIComponent(urlMatch[1]) : "";
  if (!fileName) {
    throw createError({ statusCode: 400, message: "Missing workflow file name" });
  }

  const query = getQuery(event);
  const branch = (query.branch as string) || undefined;

  const gitea = await useGiteaSdk(event).role("user");

  // 从工作流列表中按文件名匹配
  const workflowsList = await gitea.getRepoWorkflows(owner, repo);
  const workflow = workflowsList.workflows?.find((w) => w.path.endsWith(`/${fileName}`));
  if (!workflow) {
    const available = workflowsList.workflows?.map((w) => w.path.split("/").pop()).join(", ") || "none";
    throw createError({ statusCode: 404, message: `Workflow "${fileName}" not found. Available: ${available}` });
  }

  // 获取文件内容
  const content = await gitea.getFileContent(owner, repo, workflow.path, branch);
  if (!content) {
    throw createError({ statusCode: 404, message: `Cannot read workflow file: ${workflow.path}` });
  }

  const doc = parseWorkflowYaml(content);
  if (!doc) {
    throw createError({ statusCode: 400, message: "Invalid workflow file" });
  }

  // 获取分支列表
  let branches: string[] = [];
  try {
    const branchesResult = await gitea.getRepoBranches(owner, repo);
    branches = branchesResult.map((b) => b.name);
  } catch {
    // 忽略
  }

  return {
    workflow: {
      name: workflow.name,
      path: workflow.path,
    },
    inputDefs: extractInputs(doc) || {},
    branches,
    repository: {
      id: repoId,
      full_name: `${owner}/${repo}`,
      name: repo,
    },
  };
});
