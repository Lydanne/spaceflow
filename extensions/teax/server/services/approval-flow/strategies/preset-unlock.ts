import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { ApprovalStrategy } from "../types";

/**
 * 预设解锁申请 Payload
 */
export interface PresetUnlockPayload extends Record<string, unknown> {
  presetId: string;
  presetName: string;
  groupName: string;
  groupShareToken: string;
  lockedBy: string;
}

/**
 * 预设解锁申请策略
 *
 * 当用户想要使用被他人锁定的预设时，可以发起解锁申请
 * 审批人为锁定者本人
 */
export const presetUnlockStrategy: ApprovalStrategy<PresetUnlockPayload> = {
  flowType: "preset:unlock",

  async validateRequest(_event, payload, _organizationId) {
    if (!payload.presetId) {
      throw createError({ statusCode: 400, message: "预设 ID 不能为空" });
    }
    if (!payload.lockedBy) {
      throw createError({ statusCode: 400, message: "锁定者 ID 不能为空" });
    }

    const db = useDB();

    // 检查预设是否存在且被锁定
    const [preset] = await db
      .select({
        id: schema.workflowPresets.id,
        locked_by: schema.workflowPresets.locked_by,
      })
      .from(schema.workflowPresets)
      .where(eq(schema.workflowPresets.id, payload.presetId))
      .limit(1);

    if (!preset) {
      throw createError({ statusCode: 404, message: "预设不存在" });
    }

    if (!preset.locked_by) {
      throw createError({ statusCode: 400, message: "预设未被锁定" });
    }

    if (preset.locked_by !== payload.lockedBy) {
      throw createError({ statusCode: 400, message: "锁定者信息不匹配" });
    }

    // 检查是否有重复的待处理申请
    const existingFlows = await db
      .select()
      .from(schema.approvalFlows)
      .where(eq(schema.approvalFlows.flow_type, "preset:unlock"));

    for (const flow of existingFlows) {
      if (flow.status !== "pending") continue;
      const existingPayload = flow.payload as PresetUnlockPayload;
      if (existingPayload.presetId === payload.presetId) {
        throw createError({
          statusCode: 400,
          message: "已存在相同预设的待处理解锁申请",
        });
      }
    }
  },

  async buildTitle(payload) {
    return `申请解锁预设「${payload.presetName}」`;
  },

  async findApprovers(_organizationId, payload) {
    const db = useDB();

    // 审批人为锁定者本人
    const [feishuBinding] = await db
      .select({ openId: schema.userFeishu.feishu_open_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.user_id, payload.lockedBy))
      .limit(1);

    if (!feishuBinding?.openId) {
      return [];
    }

    return [feishuBinding.openId];
  },

  async buildCardFields(_flow, payload) {
    return [
      { label: "预设组", value: payload.groupName },
      { label: "子预设", value: payload.presetName },
    ];
  },

  async onApproved(_flow, payload, _approverId) {
    const db = useDB();

    // 解锁预设
    await db
      .update(schema.workflowPresets)
      .set({
        locked_by: null,
        locked_at: null,
        auto_unlock_at: null,
      })
      .where(eq(schema.workflowPresets.id, payload.presetId));

    // 记录历史
    await db.insert(schema.workflowPresetHistory).values({
      preset_id: payload.presetId,
      action: "unlock",
      actor_id: payload.lockedBy,
      details: { reason: "approval_granted" },
    });
  },

  async getRequesterNotification(_flow, payload, result) {
    const isApproved = result === "approved";
    return {
      title: isApproved
        ? `✅ 预设「${payload.presetName}」已解锁`
        : `❌ 解锁申请「${payload.presetName}」已拒绝`,
      fields: [
        { label: "预设组", value: payload.groupName },
        { label: "子预设", value: payload.presetName },
      ],
    };
  },
};
