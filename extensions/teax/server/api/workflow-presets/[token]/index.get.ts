import { requirePermission } from "~~/server/utils/permission";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { resolvePresetByToken } from "~~/server/utils/resolve-preset";

export default defineEventHandler(async (event) => {
  const { preset, repo, owner, repoName } = await resolvePresetByToken(event);

  // 检查权限
  await requirePermission(event, repo.organization_id, "actions:trigger", repo.id);

  // 获取 workflow 名称
  const gitea = await useGiteaSdk(event).role("user");

  let workflowName = preset.workflow_path;
  try {
    const result = await gitea.getRepoWorkflows(owner, repoName);
    const wf = result.workflows?.find((w) => w.path === preset.workflow_path);
    if (wf) {
      workflowName = wf.name;
    }
  } catch {
    // 忽略错误，使用 path 作为名称
  }

  return {
    preset: {
      id: preset.id,
      name: preset.name,
      workflow_path: preset.workflow_path,
      workflow_name: workflowName,
      branch: preset.branch,
      inputs: preset.inputs,
    },
    repository: {
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
    },
  };
});
