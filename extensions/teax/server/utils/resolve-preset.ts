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
 * 从路由参数 token 解析出 preset 和关联的 repo 信息。
 * 路由目录为 /api/workflow-presets/[token]/...
 * 找不到时抛 404。
 */
export async function resolvePresetByToken(event: H3Event): Promise<ResolvedPreset> {
  const token = getRouterParam(event, "token");
  if (!token) {
    throw createError({ statusCode: 400, message: "Missing token" });
  }

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
