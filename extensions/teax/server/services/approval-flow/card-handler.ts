import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { approveFlow, rejectFlow } from "./service";
import { FeishuCardBuilder } from "~~/server/utils/feishu-card-builder";
import { updateCardMessage } from "~~/server/utils/feishu-sdk";

/**
 * 处理审批流程卡片交互（来自飞书长连接）
 * @param openId 操作者的飞书 open_id
 * @param _messageToken 消息 token（长连接的 token，不是 message_id）
 * @param action 操作类型，格式: approval_flow:approve:flowId 或 approval_flow:reject:flowId
 * @returns 返回新卡片内容，用于飞书更新卡片
 */
export async function handleApprovalFlowCardAction(
  openId: string,
  _messageToken: string,
  action: string,
): Promise<Record<string, unknown> | undefined> {
  const parts = action.split(":");
  if (parts.length < 3) {
    console.error("[ApprovalFlow] Invalid action format:", action);
    return;
  }

  const [, actionType, flowId] = parts;

  if (!flowId) {
    console.error("[ApprovalFlow] Missing flowId");
    return;
  }

  // 根据 open_id 查找用户
  const db = useDB();
  const [feishuBinding] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId))
    .limit(1);

  if (!feishuBinding?.user_id) {
    console.error("[ApprovalFlow] User not found for openId:", openId);
    return;
  }

  // 获取审批流程记录，拿到 feishu_message_id
  const [flow] = await db
    .select({ feishu_message_id: schema.approvalFlows.feishu_message_id })
    .from(schema.approvalFlows)
    .where(eq(schema.approvalFlows.id, flowId))
    .limit(1);

  const messageId = flow?.feishu_message_id;

  try {
    // 创建一个模拟的 H3Event（审批流程需要）
    const mockEvent = createMockEvent(feishuBinding.user_id);
    let resultCard: Record<string, unknown>;

    if (actionType === "approve") {
      await approveFlow(mockEvent, flowId, feishuBinding.user_id);
      console.log("[ApprovalFlow] Approved flow:", flowId);
      resultCard = buildSuccessCard("✅ 审批已通过", "green");
    } else if (actionType === "reject") {
      await rejectFlow(mockEvent, flowId, feishuBinding.user_id);
      console.log("[ApprovalFlow] Rejected flow:", flowId);
      resultCard = buildSuccessCard("❌ 审批已拒绝", "red");
    } else {
      console.error("[ApprovalFlow] Unknown action type:", actionType);
      return;
    }

    // 使用 message_id 更新卡片（不返回卡片，避免被飞书长连接覆盖）
    if (messageId) {
      // 延迟 100ms 再更新，确保飞书长连接的响应先处理完
      setTimeout(async () => {
        try {
          await updateCardMessage(messageId, resultCard);
          console.log("[ApprovalFlow] Card updated for message:", messageId);
        } catch (e) {
          console.error("[ApprovalFlow] Failed to update card:", e);
        }
      }, 100);
    }

    // 不返回卡片内容，让飞书保持原卡片，然后我们通过 API 更新
    return;
  } catch (e) {
    console.error("[ApprovalFlow] Card action error:", e);
    const errorMessage = e instanceof Error ? e.message : "操作失败";
    const errorCard = buildErrorCard(errorMessage);

    // 尝试更新卡片显示错误
    if (messageId) {
      setTimeout(async () => {
        try {
          await updateCardMessage(messageId, errorCard);
        } catch {
          // 忽略更新失败
        }
      }, 100);
    }

    return;
  }
}

/**
 * 创建模拟的 H3Event（用于审计日志）
 */
function createMockEvent(userId: string) {
  return {
    context: {
      params: {},
    },
    node: {
      req: {
        headers: {},
        url: "/api/approval-flow/card-action",
        method: "POST",
      },
      res: {},
    },
    _userId: userId,
  } as unknown as Parameters<typeof approveFlow>[0];
}

/**
 * 构建成功卡片（用于返回给飞书更新）
 */
function buildSuccessCard(
  message: string,
  theme: "red" | "green" | "blue" | "orange" | "grey" = "green",
): Record<string, unknown> {
  const card = new FeishuCardBuilder({
    title: message,
    theme,
  })
    .addText("操作已完成")
    .build();

  return card.card;
}

/**
 * 构建错误卡片（用于返回给飞书更新）
 */
function buildErrorCard(message: string): Record<string, unknown> {
  const card = new FeishuCardBuilder({
    title: "❌ 操作失败",
    theme: "red",
  })
    .addText(message)
    .build();

  return card.card;
}
