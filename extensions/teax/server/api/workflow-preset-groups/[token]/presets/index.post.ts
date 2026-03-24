import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { z } from "zod";
import { nanoid } from "nanoid";

const addPresetBodySchema = z.object({
  name: z.string().optional(),
  branch: z.string().optional(),
  inputs: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
  locked_inputs: z.array(z.string()).optional(),
  allow_branch_override: z.boolean().optional(),
});

/**
 * 添加子预设到预设组
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({ statusCode: 400, message: "Missing token" });
  }

  const body = await readValidatedBody(event, addPresetBodySchema.parse);
  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select()
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  // 检查权限：必须是管理员或创建者
  const isAdmin = session.user.is_admin === true;
  const isOwner = group.created_by === session.user.id;

  if (!isAdmin && !isOwner) {
    throw createError({ statusCode: 403, message: "Only admin or group owner can add presets" });
  }

  // 获取当前最大的 preset_index 和所有现有子预设
  const existingPresets = await db
    .select({
      preset_index: schema.workflowPresets.preset_index,
      branch: schema.workflowPresets.branch,
      inputs: schema.workflowPresets.inputs,
    })
    .from(schema.workflowPresets)
    .where(eq(schema.workflowPresets.group_id, group.id));

  const maxIndex = existingPresets.reduce((max, p) => Math.max(max, p.preset_index ?? 0), -1);
  const nextIndex = maxIndex + 1;

  // 确定新子预设的 branch 和 inputs
  const newBranch = body.branch || group.default_branch;
  const newInputs = body.inputs || group.default_inputs || {};

  // 检查参数唯一性：branch + inputs 组合不能与已有子预设重复
  const isDuplicate = existingPresets.some((preset) => {
    if (preset.branch !== newBranch) return false;
    const existingInputs = (preset.inputs || {}) as Record<string, unknown>;
    const inputKeys = new Set([...Object.keys(existingInputs), ...Object.keys(newInputs)]);
    for (const key of inputKeys) {
      if (String(existingInputs[key] ?? "") !== String(newInputs[key] ?? "")) {
        return false;
      }
    }
    return true;
  });

  if (isDuplicate) {
    throw createError({
      statusCode: 400,
      message: "已存在相同配置的子预设（分支和参数完全相同）",
    });
  }

  // 生成子预设名称
  const presetName = body.name || `子预设 ${nextIndex + 1}`;

  // 创建子预设
  const [newPreset] = await db
    .insert(schema.workflowPresets)
    .values({
      repository_id: group.repository_id,
      name: presetName,
      workflow_path: group.workflow_path,
      branch: newBranch,
      inputs: newInputs,
      locked_inputs: body.locked_inputs || [],
      allow_branch_override: body.allow_branch_override ?? false,
      share_token: nanoid(16),
      created_by: session.user.id,
      group_id: group.id,
      preset_index: nextIndex,
    })
    .returning();

  return {
    success: true,
    preset: {
      id: newPreset!.id,
      name: newPreset!.name,
      preset_index: newPreset!.preset_index,
      branch: newPreset!.branch,
      inputs: newPreset!.inputs,
      share_token: newPreset!.share_token,
      status: "idle",
    },
  };
});
