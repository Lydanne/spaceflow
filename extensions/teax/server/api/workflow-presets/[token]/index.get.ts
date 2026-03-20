import { parse as parseYaml } from "yaml";
import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";

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
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 检查权限
  await requirePermission(event, repo.organization_id, "actions:trigger", repo.id);

  const gitea = await useGiteaSdk(event).role("user");

  let workflowName = preset.workflow_path;
  let inputDefs: Record<string, WorkflowInputDef> = {};
  let branches: string[] = [];

  try {
    const result = await gitea.getRepoWorkflows(owner, repoName);
    const wf = result.workflows?.find((w) => w.path === preset.workflow_path);
    if (wf) {
      workflowName = wf.name;
      // 获取 workflow 文件内容解析 inputs 定义
      const content = await gitea.getFileContent(owner, repoName, wf.path);
      if (content) {
        const doc = parseWorkflowYaml(content);
        if (doc) {
          inputDefs = extractInputs(doc) || {};
        }
      }
    }

    // 如果允许修改分支，获取分支列表
    if (preset.allow_branch_override) {
      const branchesResult = await gitea.getRepoBranches(owner, repoName);
      branches = branchesResult.map((b) => b.name);
    }
  } catch {
    // 忽略错误
  }

  return {
    preset: {
      id: preset.id,
      name: preset.name,
      workflow_path: preset.workflow_path,
      workflow_name: workflowName,
      branch: preset.branch,
      inputs: preset.inputs,
      allow_input_override: preset.allow_input_override ?? false,
      allow_branch_override: preset.allow_branch_override ?? false,
    },
    inputDefs,
    branches,
    repository: {
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
    },
  };
});
