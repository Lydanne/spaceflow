import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { getStrategy } from "./registry";
import { sendFeishuCardMessage } from "~~/server/utils/feishu-sdk";
import { writeAuditLog } from "~~/server/utils/audit";
import type { H3Event } from "h3";
import type { ApprovalFlow } from "~~/server/db/schema/approval-flow";
import type { ApprovalStrategy } from "./types";

const DEFAULT_EXPIRE_DAYS = 7;

/**
 * 创建审批流程
 */
export async function createApprovalFlow<TPayload extends Record<string, unknown>>(
  event: H3Event,
  params: {
    flowType: string;
    organizationId?: string;
    requesterId: string;
    payload: TPayload;
    reason?: string;
    expireDays?: number;
  },
): Promise<ApprovalFlow> {
  const db = useDB();
  const strategy = getStrategy(params.flowType);

  // 1. 校验申请
  await strategy.validateRequest(event, params.payload, params.organizationId);

  // 2. 生成标题
  const title = await strategy.buildTitle(params.payload);

  // 3. 查找审批人
  const approverOpenIds = await strategy.findApprovers(
    params.organizationId,
    params.payload,
  );

  if (approverOpenIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: "No approvers found for this request",
    });
  }

  // 4. 计算过期时间
  const expireDays = params.expireDays ?? DEFAULT_EXPIRE_DAYS;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expireDays);

  // 5. 创建记录
  const [flow] = await db
    .insert(schema.approvalFlows)
    .values({
      organization_id: params.organizationId,
      requester_id: params.requesterId,
      flow_type: params.flowType,
      title,
      reason: params.reason,
      payload: params.payload,
      expires_at: expiresAt,
    })
    .returning();

  if (!flow) {
    throw createError({ statusCode: 500, message: "Failed to create approval flow" });
  }

  // 6. 发送审批卡片
  await sendApprovalCard(flow, approverOpenIds, strategy);

  // 7. 写入审计日志
  await writeAuditLog(event, {
    user_id: params.requesterId,
    action: "approval_flow.create",
    resource_type: "approval_flow",
    resource_id: flow.id,
    organization_id: params.organizationId,
    detail: { flowType: params.flowType, payload: params.payload },
  });

  return flow;
}

/**
 * 审批通过
 */
export async function approveFlow(
  event: H3Event,
  flowId: string,
  approverId: string,
  comment?: string,
): Promise<ApprovalFlow> {
  const db = useDB();

  // 1. 获取流程记录
  const [flow] = await db
    .select()
    .from(schema.approvalFlows)
    .where(eq(schema.approvalFlows.id, flowId))
    .limit(1);

  if (!flow) {
    throw createError({ statusCode: 404, message: "Approval flow not found" });
  }

  if (flow.status !== "pending") {
    throw createError({ statusCode: 400, message: "Flow is not pending" });
  }

  // 2. 检查是否过期
  if (flow.expires_at && new Date() > flow.expires_at) {
    throw createError({ statusCode: 400, message: "Flow has expired" });
  }

  const strategy = getStrategy(flow.flow_type);

  // 3. 执行业务操作
  await strategy.onApproved(flow, flow.payload as Record<string, unknown>, approverId);

  // 4. 更新状态
  const [updatedFlow] = await db
    .update(schema.approvalFlows)
    .set({
      status: "approved",
      approver_id: approverId,
      approver_comment: comment,
      approved_at: new Date(),
    })
    .where(eq(schema.approvalFlows.id, flowId))
    .returning();

  if (!updatedFlow) {
    throw createError({ statusCode: 500, message: "Failed to update approval flow" });
  }

  // 5. 通知申请人
  await notifyRequester(updatedFlow, "approved", strategy);

  // 6. 写入审计日志
  await writeAuditLog(event, {
    user_id: approverId,
    action: "approval_flow.approve",
    resource_type: "approval_flow",
    resource_id: flowId,
    organization_id: flow.organization_id ?? undefined,
    detail: { comment },
  });

  return updatedFlow;
}

/**
 * 审批拒绝
 */
export async function rejectFlow(
  event: H3Event,
  flowId: string,
  approverId: string,
  comment?: string,
): Promise<ApprovalFlow> {
  const db = useDB();

  const [flow] = await db
    .select()
    .from(schema.approvalFlows)
    .where(eq(schema.approvalFlows.id, flowId))
    .limit(1);

  if (!flow) {
    throw createError({ statusCode: 404, message: "Approval flow not found" });
  }

  if (flow.status !== "pending") {
    throw createError({ statusCode: 400, message: "Flow is not pending" });
  }

  const strategy = getStrategy(flow.flow_type);

  // 执行拒绝后的业务操作（如果有）
  if (strategy.onRejected) {
    await strategy.onRejected(
      flow,
      flow.payload as Record<string, unknown>,
      approverId,
      comment,
    );
  }

  // 更新状态
  const [updatedFlow] = await db
    .update(schema.approvalFlows)
    .set({
      status: "rejected",
      approver_id: approverId,
      approver_comment: comment,
      approved_at: new Date(),
    })
    .where(eq(schema.approvalFlows.id, flowId))
    .returning();

  if (!updatedFlow) {
    throw createError({ statusCode: 500, message: "Failed to update approval flow" });
  }

  // 通知申请人
  await notifyRequester(updatedFlow, "rejected", strategy);

  // 写入审计日志
  await writeAuditLog(event, {
    user_id: approverId,
    action: "approval_flow.reject",
    resource_type: "approval_flow",
    resource_id: flowId,
    organization_id: flow.organization_id ?? undefined,
    detail: { comment },
  });

  return updatedFlow;
}

/**
 * 取消申请（仅申请人可操作）
 */
export async function cancelFlow(
  event: H3Event,
  flowId: string,
  requesterId: string,
): Promise<ApprovalFlow> {
  const db = useDB();

  const [flow] = await db
    .select()
    .from(schema.approvalFlows)
    .where(
      and(
        eq(schema.approvalFlows.id, flowId),
        eq(schema.approvalFlows.requester_id, requesterId),
        eq(schema.approvalFlows.status, "pending"),
      ),
    )
    .limit(1);

  if (!flow) {
    throw createError({
      statusCode: 404,
      message: "Approval flow not found or not cancellable",
    });
  }

  const [updatedFlow] = await db
    .update(schema.approvalFlows)
    .set({ status: "cancelled" })
    .where(eq(schema.approvalFlows.id, flowId))
    .returning();

  if (!updatedFlow) {
    throw createError({ statusCode: 500, message: "Failed to cancel approval flow" });
  }

  await writeAuditLog(event, {
    user_id: requesterId,
    action: "approval_flow.cancel",
    resource_type: "approval_flow",
    resource_id: flowId,
    organization_id: flow.organization_id ?? undefined,
  });

  return updatedFlow;
}

/**
 * 发送审批卡片
 */
async function sendApprovalCard(
  flow: ApprovalFlow,
  approverOpenIds: string[],
  _strategy: ApprovalStrategy,
): Promise<void> {
  const { renderCardPage } = await import("~~/server/card-kit");

  // 私信发送给每个审批人
  const db = useDB();
  for (const openId of approverOpenIds) {
    try {
      const card = await renderCardPage({ openId }, "approval-pending", { flowId: flow.id });
      if (!card) continue;

      const result = await sendFeishuCardMessage(openId, card, "open_id");

      // 记录第一个成功发送的 message_id
      if (result.message_id && !flow.feishu_message_id) {
        await db
          .update(schema.approvalFlows)
          .set({ feishu_message_id: result.message_id })
          .where(eq(schema.approvalFlows.id, flow.id));
      }
    } catch (e) {
      console.error(`[ApprovalFlow] Failed to send card to ${openId}:`, e);
    }
  }
}

/**
 * 通知申请人
 */
async function notifyRequester(
  flow: ApprovalFlow,
  result: "approved" | "rejected",
  strategy: ApprovalStrategy,
): Promise<void> {
  // 获取申请人的飞书 open_id（从 userFeishu 表）
  const db = useDB();
  const [feishuBinding] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.user_id, flow.requester_id))
    .limit(1);

  if (!feishuBinding?.feishu_open_id) return;

  const isApproved = result === "approved";

  // 获取自定义通知内容（如果策略提供）
  let title = isApproved ? "✅ 申请已通过" : "❌ 申请已拒绝";
  let fields: Array<{ label: string; value: string }> = [
    { label: "申请内容", value: flow.title },
  ];

  if (strategy.getRequesterNotification) {
    const notification = await strategy.getRequesterNotification(
      flow,
      flow.payload as Record<string, unknown>,
      result,
    );
    title = notification.title;
    fields = notification.fields;
  }

  if (flow.approver_comment) {
    fields.push({ label: "审批备注", value: flow.approver_comment });
  }

  const { EnhancedCardBuilder } = await import("~~/server/card-kit");
  const card = new EnhancedCardBuilder(
    { title, theme: isApproved ? "green" : "red" },
    "",
  )
    .fields(fields)
    .build();

  try {
    await sendFeishuCardMessage(feishuBinding.feishu_open_id, card, "open_id");
  } catch (e) {
    console.error("[ApprovalFlow] Failed to notify requester:", e);
  }
}
