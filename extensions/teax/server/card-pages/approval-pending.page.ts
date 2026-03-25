import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage } from "~~/server/card-kit";
import { approveFlow, rejectFlow } from "~~/server/services/approval-flow/service";
import { updateCardMessage } from "~~/server/utils/feishu-sdk";
import type { H3Event } from "h3";

/**
 * 创建模拟的 H3Event（审批流程需要）
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
  } as unknown as H3Event;
}

export default defineCardPage({
  name: "approval:pending",

  async render(ctx) {
    const flowId = ctx.params.flowId as string;
    if (!flowId) {
      return ctx
        .card({ title: "❌ 参数错误", theme: "red" })
        .text("缺少审批流程 ID", true)
        .build();
    }

    const db = useDB();
    const [flow] = await db
      .select()
      .from(schema.approvalFlows)
      .where(eq(schema.approvalFlows.id, flowId))
      .limit(1);

    if (!flow) {
      return ctx
        .card({ title: "❌ 审批不存在", theme: "red" })
        .text("该审批流程可能已被删除", true)
        .build();
    }

    if (flow.status !== "pending") {
      const isApproved = flow.status === "approved";
      return ctx
        .card({
          title: isApproved ? "✅ 审批已通过" : "❌ 审批已拒绝",
          theme: isApproved ? "green" : "red",
        })
        .text("操作已完成", true)
        .build();
    }

    // 获取策略并构建字段
    const { getStrategy } = await import("~~/server/services/approval-flow/registry");
    const strategy = getStrategy(flow.flow_type);
    const fields = await strategy.buildCardFields(
      flow,
      flow.payload as Record<string, unknown>,
    );

    // 添加申请人信息
    const requesterInfo = await getRequesterDisplayInfo(flow.requester_id);
    fields.unshift({ label: "申请人", value: requesterInfo });

    // 添加申请理由
    if (flow.reason) {
      fields.push({ label: "申请理由", value: flow.reason });
    }

    const card = ctx.card({ title: `📋 ${flow.title}`, theme: "blue" });
    card.fields(fields);
    card.divider();
    card.buttons([
      {
        text: "✅ 通过",
        type: "primary",
        action: "approve",
        params: { flowId },
      },
      {
        text: "❌ 拒绝",
        type: "danger",
        action: "reject",
        params: { flowId },
      },
    ]);

    return card.build();
  },

  async onAction(ctx) {
    const flowId = ctx.params.flowId as string;
    const actionType = ctx.action; // "approve" or "reject"

    if (!flowId || !actionType) {
      return undefined;
    }

    // 查找用户
    const db = useDB();
    const [feishuBinding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.openId))
      .limit(1);

    if (!feishuBinding?.user_id) {
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const card = new EnhancedCardBuilder(
        { title: "❌ 未绑定账号", theme: "red" },
        "",
      )
        .text("未找到关联的用户账号", true)
        .build();
      await ctx.updateCard(card);
      return undefined;
    }

    const mockEvent = createMockEvent(feishuBinding.user_id);

    try {
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      let resultCard: Record<string, unknown>;

      if (actionType === "approve") {
        await approveFlow(mockEvent, flowId, feishuBinding.user_id);
        resultCard = new EnhancedCardBuilder(
          { title: "✅ 审批已通过", theme: "green" },
          "",
        )
          .text("操作已完成", true)
          .build();
      } else if (actionType === "reject") {
        await rejectFlow(mockEvent, flowId, feishuBinding.user_id);
        resultCard = new EnhancedCardBuilder(
          { title: "❌ 审批已拒绝", theme: "red" },
          "",
        )
          .text("操作已完成", true)
          .build();
      } else {
        return undefined;
      }

      await ctx.updateCard(resultCard);

      // 也尝试通过 message_id 更新（多审批人场景）
      const [flow] = await db
        .select({ feishu_message_id: schema.approvalFlows.feishu_message_id })
        .from(schema.approvalFlows)
        .where(eq(schema.approvalFlows.id, flowId))
        .limit(1);

      if (flow?.feishu_message_id) {
        try {
          await updateCardMessage(flow.feishu_message_id, resultCard);
        } catch {
          // 忽略更新失败
        }
      }
    } catch (err) {
      console.error("[approval:pending] action error:", err);
      const errorMessage = err instanceof Error ? err.message : "操作失败";
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const errorCard = new EnhancedCardBuilder(
        { title: "❌ 操作失败", theme: "red" },
        "",
      )
        .text(errorMessage, true)
        .build();
      await ctx.updateCard(errorCard);
    }

    return undefined;
  },
});

/**
 * 获取申请人的显示信息
 */
async function getRequesterDisplayInfo(requesterId: string): Promise<string> {
  const db = useDB();
  const [user] = await db
    .select({
      gitea_username: schema.users.gitea_username,
      feishu_open_id: schema.userFeishu.feishu_open_id,
      feishu_name: schema.userFeishu.feishu_name,
    })
    .from(schema.users)
    .leftJoin(schema.userFeishu, eq(schema.users.id, schema.userFeishu.user_id))
    .where(eq(schema.users.id, requesterId))
    .limit(1);

  if (!user) return "未知用户";
  if (user.feishu_open_id) return `<at id=${user.feishu_open_id}></at>`;
  return user.feishu_name || user.gitea_username || "未知用户";
}
