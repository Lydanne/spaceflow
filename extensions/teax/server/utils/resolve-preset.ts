import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { H3Event } from "h3";

export interface ResolvedPreset {
  preset: {
    id: string;
    repository_id: string;
    name: string;
    workflow_path: string;
    branch: string;
    inputs: Record<string, string | boolean | number> | null;
    share_token: string;
    created_by: string;
    current_run_id: number | null;
    last_triggered_by: string | null;
    allow_input_override: boolean | null;
    locked_inputs: string[] | null;
    allow_branch_override: boolean | null;
    allow_sync_override: boolean | null;
    // 子预设相关
    group_id: string | null;
    preset_index: number | null;
    locked_by: string | null;
    locked_at: Date | null;
    auto_unlock_at: Date | null;
  };
  repo: {
    id: string;
    organization_id: string;
    full_name: string;
    name: string;
  };
  owner: string;
  repoName: string;
}

/**
 * 通过 share_token 解析出 preset 和关联的 repo 信息。
 * 可在路由处理器外部复用（无需 H3Event）。
 */
export async function resolvePresetByShareToken(token: string): Promise<ResolvedPreset> {
  const db = useDB();

  const [preset] = await db
    .select({
      id: schema.workflowPresets.id,
      repository_id: schema.workflowPresets.repository_id,
      name: schema.workflowPresets.name,
      workflow_path: schema.workflowPresets.workflow_path,
      branch: schema.workflowPresets.branch,
      inputs: schema.workflowPresets.inputs,
      share_token: schema.workflowPresets.share_token,
      created_by: schema.workflowPresets.created_by,
      current_run_id: schema.workflowPresets.current_run_id,
      last_triggered_by: schema.workflowPresets.last_triggered_by,
      allow_input_override: schema.workflowPresets.allow_input_override,
      locked_inputs: schema.workflowPresets.locked_inputs,
      allow_branch_override: schema.workflowPresets.allow_branch_override,
      allow_sync_override: schema.workflowPresets.allow_sync_override,
      // 子预设相关
      group_id: schema.workflowPresets.group_id,
      preset_index: schema.workflowPresets.preset_index,
      locked_by: schema.workflowPresets.locked_by,
      locked_at: schema.workflowPresets.locked_at,
      auto_unlock_at: schema.workflowPresets.auto_unlock_at,
    })
    .from(schema.workflowPresets)
    .where(eq(schema.workflowPresets.share_token, token))
    .limit(1);

  if (!preset) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  const [repo] = await db
    .select({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
      full_name: schema.repositories.full_name,
      name: schema.repositories.name,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, preset.repository_id))
    .limit(1);

  if (!repo) {
    throw createError({ statusCode: 404, message: "Repository not found" });
  }

  const [owner, repoName] = repo.full_name.split("/");

  return {
    preset: preset as ResolvedPreset["preset"],
    repo,
    owner: owner!,
    repoName: repoName!,
  };
}

/**
 * 从路由参数 token 解析出 preset 和关联的 repo 信息。
 * 路由目录为 /api/workflow-presets/[token]/...
 * 找不到时抛 404。
 */
export async function resolvePresetByToken(event: H3Event): Promise<ResolvedPreset> {
  const token = getRouterParam(event, "token");
  if (!token) {
    throw createError({ statusCode: 400, message: "Missing token" });
  }
  return resolvePresetByShareToken(token);
}
