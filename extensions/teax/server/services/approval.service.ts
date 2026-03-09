import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  createFeishuApprovalInstance,
  getFeishuApprovalInstance,
  sendFeishuCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/services/messaging";

// ─── 创建审批请求 ─────────────────────────────────────────

export interface CreateApprovalParams {
  organizationId: string;
  repositoryId?: string;
  requesterId: string;
  requesterOpenId: string;
  type: "deploy" | "rollback" | "custom";
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 创建审批请求并提交到飞书审批流。
 * 1. 在 DB 中创建 approval_requests 记录
 * 2. 调用飞书创建审批实例 API
 * 3. 将 feishu_instance_code 回写 DB
 */
export async function createApprovalRequest(params: CreateApprovalParams): Promise<{
  id: string;
  feishuInstanceCode: string | null;
}> {
  const db = useDB();
  const config = useRuntimeConfig();

  // 创建 DB 记录
  const [record] = await db
    .insert(schema.approvalRequests)
    .values({
      organization_id: params.organizationId,
      repository_id: params.repositoryId || null,
      requester_id: params.requesterId,
      type: params.type,
      status: "pending",
      title: params.title,
      description: params.description || null,
      metadata: params.metadata || {},
    })
    .returning({ id: schema.approvalRequests.id });

  if (!record) {
    throw new Error("Failed to create approval request");
  }

  // 如果配置了飞书审批 code，提交到飞书
  let feishuInstanceCode: string | null = null;
  if (config.feishuApprovalCode && params.requesterOpenId) {
    try {
      const instanceCode = await createFeishuApprovalInstance({
        approval_code: config.feishuApprovalCode,
        open_id: params.requesterOpenId,
        form: [
          { id: "title", type: "input", value: params.title },
          { id: "description", type: "textarea", value: params.description || "" },
          { id: "type", type: "input", value: params.type },
          { id: "approval_id", type: "input", value: record.id },
        ],
      });
      feishuInstanceCode = instanceCode || null;

      // 回写 instance_code
      await db
        .update(schema.approvalRequests)
        .set({ feishu_instance_code: feishuInstanceCode, updated_at: new Date() })
        .where(eq(schema.approvalRequests.id, record.id));
    } catch (err) {
      console.error("[approval] Failed to create Feishu approval instance:", err);
      // 飞书审批创建失败不影响本地记录
    }
  }

  return { id: record.id, feishuInstanceCode };
}

// ─── 查询审批请求 ─────────────────────────────────────────

export async function getApprovalRequest(id: string) {
  const db = useDB();
  const [record] = await db
    .select()
    .from(schema.approvalRequests)
    .where(eq(schema.approvalRequests.id, id))
    .limit(1);
  return record || null;
}

export async function getApprovalsByRepo(repositoryId: string, status?: string) {
  const db = useDB();
  const conditions = [eq(schema.approvalRequests.repository_id, repositoryId)];
  if (status) {
    conditions.push(eq(schema.approvalRequests.status, status));
  }
  return db
    .select()
    .from(schema.approvalRequests)
    .where(and(...conditions))
    .orderBy(schema.approvalRequests.created_at);
}

// ─── 同步飞书审批状态 ────────────────────────────────────

/**
 * 从飞书查询审批实例状态并更新本地记录。
 * 在飞书事件回调或定期轮询时调用。
 */
export async function syncApprovalStatus(approvalId: string): Promise<{
  status: string;
  updated: boolean;
}> {
  const db = useDB();

  const [record] = await db
    .select()
    .from(schema.approvalRequests)
    .where(eq(schema.approvalRequests.id, approvalId))
    .limit(1);

  if (!record || !record.feishu_instance_code) {
    return { status: record?.status || "unknown", updated: false };
  }

  try {
    const feishuResult = await getFeishuApprovalInstance(record.feishu_instance_code);

    if (!feishuResult) {
      return { status: record.status, updated: false };
    }

    // 飞书审批状态映射
    const statusMap: Record<string, string> = {
      PENDING: "pending",
      APPROVED: "approved",
      REJECTED: "rejected",
      CANCELED: "cancelled",
      DELETED: "cancelled",
    };

    const newStatus = statusMap[feishuResult.status] || "unknown";

    if (newStatus !== record.status) {
      await db
        .update(schema.approvalRequests)
        .set({ status: newStatus, updated_at: new Date() })
        .where(eq(schema.approvalRequests.id, approvalId));

      return { status: newStatus, updated: true };
    }

    return { status: record.status, updated: false };
  } catch (err) {
    console.error("[approval] Failed to sync Feishu approval status:", err);
    return { status: record.status, updated: false };
  }
}

/**
 * 处理飞书审批事件回调。
 * 根据 instance_code 查找本地记录并更新状态。
 */
export async function handleFeishuApprovalEvent(eventData: {
  instance_code?: string;
  status?: string;
  approval_code?: string;
  operate_time?: string;
  type?: string;
}): Promise<void> {
  if (!eventData.instance_code) return;

  const db = useDB();

  const [record] = await db
    .select()
    .from(schema.approvalRequests)
    .where(eq(schema.approvalRequests.feishu_instance_code, eventData.instance_code))
    .limit(1);

  if (!record) {
    console.log("[approval] No local record for instance:", eventData.instance_code);
    return;
  }

  const statusMap: Record<string, string> = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    CANCELED: "cancelled",
    DELETED: "cancelled",
  };

  const newStatus = eventData.status ? (statusMap[eventData.status] || record.status) : record.status;

  if (newStatus !== record.status) {
    await db
      .update(schema.approvalRequests)
      .set({ status: newStatus, updated_at: new Date() })
      .where(eq(schema.approvalRequests.id, record.id));

    console.log(`[approval] Updated ${record.id}: ${record.status} → ${newStatus}`);

    // 通知请求者审批结果
    await notifyApprovalResult(record, newStatus);
  }
}

// ─── 审批结果通知 ─────────────────────────────────────────

async function notifyApprovalResult(
  record: { id: string; title: string; requester_id: string; type: string | null },
  newStatus: string,
): Promise<void> {
  try {
    const db = useDB();

    // 查找请求者的飞书绑定
    const [binding] = await db
      .select({ feishu_open_id: schema.userFeishu.feishu_open_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.user_id, record.requester_id))
      .limit(1);

    if (!binding?.feishu_open_id) return;

    const statusText: Record<string, string> = {
      approved: "✅ 已通过",
      rejected: "❌ 已拒绝",
      cancelled: "⚫ 已取消",
    };

    const template = newStatus === "approved" ? "green" : newStatus === "rejected" ? "red" : "grey";

    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: `审批结果: ${statusText[newStatus] || newStatus}` },
        template,
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**${record.title}**\n类型: ${record.type || "deploy"}\n状态: ${statusText[newStatus] || newStatus}`,
          },
        },
      ],
    };

    await sendFeishuCardMessage(binding.feishu_open_id, card, "open_id");
  } catch (err) {
    console.error("[approval] Failed to notify approval result:", err);
  }
}
