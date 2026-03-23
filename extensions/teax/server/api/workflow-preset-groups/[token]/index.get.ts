import { eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { useDB, schema } from "~~/server/db";
import { useGiteaSdk } from "~~/server/utils/gitea";

interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

function extractInputs(doc: Record<string, unknown>): Record<string, WorkflowInput> | null {
  const on = doc.on;
  if (!on || typeof on !== "object") return null;
  const dispatch = (on as Record<string, unknown>).workflow_dispatch;
  if (!dispatch || typeof dispatch !== "object") return null;
  const inputs = (dispatch as Record<string, unknown>).inputs;
  if (!inputs || typeof inputs !== "object") return null;
  return inputs as Record<string, WorkflowInput>;
}

/**
 * 通过 token 获取预设组详情（含所有子预设状态）
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  if (!token) {
    throw createError({ statusCode: 400, message: "Missing token" });
  }

  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({
      id: schema.workflowPresetGroups.id,
      name: schema.workflowPresetGroups.name,
      description: schema.workflowPresetGroups.description,
      workflow_path: schema.workflowPresetGroups.workflow_path,
      default_branch: schema.workflowPresetGroups.default_branch,
      default_inputs: schema.workflowPresetGroups.default_inputs,
      auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes,
      share_token: schema.workflowPresetGroups.share_token,
      created_by: schema.workflowPresetGroups.created_by,
      created_at: schema.workflowPresetGroups.created_at,
      repository_id: schema.workflowPresetGroups.repository_id,
    })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  // 获取仓库信息
  const [repo] = await db
    .select({
      id: schema.repositories.id,
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, group.repository_id));

  // 获取创建者信息
  const [creator] = await db
    .select({
      id: schema.users.id,
      name: schema.users.gitea_username,
      avatar_url: schema.users.avatar_url,
    })
    .from(schema.users)
    .where(eq(schema.users.id, group.created_by));

  // 获取所有子预设
  const presets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      preset_index: schema.workflowPresets.preset_index,
      branch: schema.workflowPresets.branch,
      inputs: schema.workflowPresets.inputs,
      share_token: schema.workflowPresets.share_token,
      current_run_id: schema.workflowPresets.current_run_id,
      locked_by: schema.workflowPresets.locked_by,
      locked_at: schema.workflowPresets.locked_at,
      auto_unlock_at: schema.workflowPresets.auto_unlock_at,
      last_triggered_by: schema.workflowPresets.last_triggered_by,
    })
    .from(schema.workflowPresets)
    .where(eq(schema.workflowPresets.group_id, group.id))
    .orderBy(schema.workflowPresets.preset_index);

  // 获取锁定者信息
  const lockedByIds = presets
    .filter((p) => p.locked_by)
    .map((p) => p.locked_by!);

  let lockedByUsers: { id: string; name: string; avatar_url: string | null }[] = [];
  if (lockedByIds.length > 0) {
    const firstId = lockedByIds[0];
    if (firstId) {
      lockedByUsers = await db
        .select({
          id: schema.users.id,
          name: schema.users.gitea_username,
          avatar_url: schema.users.avatar_url,
        })
        .from(schema.users)
        .where(eq(schema.users.id, firstId));
    }
  }

  const userMap = new Map(lockedByUsers.map((u) => [u.id, u]));

  // 组装子预设数据
  const presetsWithUsers = presets.map((p) => ({
    ...p,
    locked_by_user: p.locked_by ? userMap.get(p.locked_by) || null : null,
    status: p.current_run_id
      ? "running"
      : p.locked_by
        ? "locked"
        : "idle",
  }));

  // 获取 workflow inputs 定义
  let workflowInputs: Record<string, WorkflowInput> = {};
  if (repo) {
    try {
      const parts = repo.full_name.split("/");
      const owner = parts[0] || "";
      const repoName = parts[1] || "";
      if (owner && repoName) {
        const gitea = await useGiteaSdk(event).role("user");
        const content = await gitea.getFileContent(owner, repoName, group.workflow_path);
        if (content) {
          const doc = parseYaml(content);
          if (doc && typeof doc === "object") {
            workflowInputs = extractInputs(doc as Record<string, unknown>) || {};
          }
        }
      }
    } catch {
      // 忽略获取 workflow 失败的情况
    }
  }

  return {
    ...group,
    repository: repo,
    creator,
    presets: presetsWithUsers,
    workflow_inputs: workflowInputs,
  };
});
