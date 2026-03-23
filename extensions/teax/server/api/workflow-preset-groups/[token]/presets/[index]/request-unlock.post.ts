import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { createApprovalFlow } from "~~/server/services/approval-flow/service";
import type { PresetUnlockPayload } from "~~/server/services/approval-flow/strategies/preset-unlock";

/**
 * 申请解锁子预设 - 使用审批流程
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const token = getRouterParam(event, "token");
  const indexStr = getRouterParam(event, "index");

  if (!token || !indexStr) {
    throw createError({ statusCode: 400, message: "Missing parameters" });
  }

  const presetIndex = parseInt(indexStr, 10);
  if (isNaN(presetIndex)) {
    throw createError({ statusCode: 400, message: "Invalid preset index" });
  }

  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({
      id: schema.workflowPresetGroups.id,
      name: schema.workflowPresetGroups.name,
      share_token: schema.workflowPresetGroups.share_token,
      repository_id: schema.workflowPresetGroups.repository_id,
    })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  // 获取仓库信息（用于获取组织 ID）
  const [repo] = await db
    .select({ organization_id: schema.repositories.organization_id })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, group.repository_id))
    .limit(1);

  // 获取子预设
  const [preset] = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      locked_by: schema.workflowPresets.locked_by,
    })
    .from(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.group_id, group.id),
        eq(schema.workflowPresets.preset_index, presetIndex),
      ),
    );

  if (!preset) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  // 检查是否已被锁定
  if (!preset.locked_by) {
    throw createError({ statusCode: 400, message: "预设未被锁定" });
  }

  // 不能申请解锁自己锁定的预设
  if (preset.locked_by === session.user.id) {
    throw createError({ statusCode: 400, message: "不能申请解锁自己锁定的预设" });
  }

  // 创建审批流程
  const payload: PresetUnlockPayload = {
    presetId: preset.id,
    presetName: preset.name,
    groupName: group.name,
    groupShareToken: group.share_token,
    lockedBy: preset.locked_by,
  };

  const flow = await createApprovalFlow(event, {
    flowType: "preset:unlock",
    organizationId: repo?.organization_id ?? undefined,
    requesterId: session.user.id,
    payload,
    reason: "申请使用此预设",
    expireDays: 1, // 解锁申请 1 天过期
  });

  return {
    success: true,
    message: "已发送解锁申请",
    flowId: flow.id,
  };
});
