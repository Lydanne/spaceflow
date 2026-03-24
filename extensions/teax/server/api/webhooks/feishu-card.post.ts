import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { verifyFeishuEventSignature } from "~~/server/utils/feishu-sdk";
import { approveFlow, rejectFlow } from "~~/server/services/approval-flow/service";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();

  const signature = getHeader(event, "x-lark-signature");
  const timestamp = getHeader(event, "x-lark-request-timestamp");
  const nonce = getHeader(event, "x-lark-request-nonce");

  if (
    signature
    && timestamp
    && nonce
    && config.feishuEncryptKey
    && !verifyFeishuEventSignature(
      timestamp,
      nonce,
      config.feishuEncryptKey,
      JSON.stringify(body),
      signature,
    )
  ) {
    throw createError({ statusCode: 401, message: "Invalid signature" });
  }

  if (body.type === "url_verification") {
    return { challenge: body.challenge };
  }

  if (body.type === "card.action.trigger") {
    const { open_id, open_message_id, action } = body;
    const actionValue = JSON.parse(action.value);

    const db = useDB();

    const [interaction] = await db
      .select()
      .from(schema.cardInteractions)
      .where(eq(schema.cardInteractions.message_id, open_message_id))
      .limit(1);

    if (!interaction) {
      return { error: "Card interaction not found" };
    }

    await db
      .update(schema.cardInteractions)
      .set({
        interaction_data: action.form_value || actionValue,
        interacted_at: new Date(),
        status: "completed",
        open_id,
      })
      .where(eq(schema.cardInteractions.id, interaction.id));

    const result = await handleCardAction(
      event,
      interaction,
      actionValue,
      action.form_value,
      open_id,
    );

    return result;
  }

  return { success: true };
});

interface CardInteractionRecord {
  id: string;
  card_type: string | null;
  business_id: string | null;
}

interface CardActionValue {
  action?: string;
  [key: string]: unknown;
}

async function handleCardAction(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  interaction: CardInteractionRecord,
  actionValue: CardActionValue,
  formValue?: Record<string, unknown>,
  openId?: string,
) {
  const { card_type, business_id } = interaction;

  // 处理通用审批流程卡片（action 格式: approval_flow:approve:flowId）
  if (actionValue.action?.startsWith("approval_flow:")) {
    return handleApprovalFlowAction(event, actionValue, openId);
  }

  switch (card_type) {
    case "deploy_approval":
      return handleDeployApproval(business_id, actionValue);

    case "config_form":
      return handleConfigForm(business_id, formValue);

    case "agent_confirm":
      return handleAgentConfirm(business_id, actionValue);

    default:
      return { error: "Unknown card type" };
  }
}

async function handleDeployApproval(
  _approvalId: string | null,
  action: CardActionValue,
) {
  const db = useDB();
  const [actionType, id] = (action.action || "").split(":");

  if (!id) {
    return { error: "Missing approval ID" };
  }

  if (actionType === "approve") {
    await db
      .update(schema.approvalRequests)
      .set({ status: "approved" })
      .where(eq(schema.approvalRequests.id, id));

    return {
      toast: {
        type: "success",
        content: "审批通过，发布流程已启动",
      },
    };
  } else if (actionType === "reject") {
    await db
      .update(schema.approvalRequests)
      .set({ status: "rejected" })
      .where(eq(schema.approvalRequests.id, id));

    return {
      toast: {
        type: "info",
        content: "已拒绝此发布请求",
      },
    };
  }

  return { success: true };
}

async function handleConfigForm(_formId: string | null, _formValue?: Record<string, unknown>) {
  return {
    toast: {
      type: "success",
      content: "配置已保存",
    },
  };
}

async function handleAgentConfirm(_sessionId: string | null, action: CardActionValue) {
  const [actionType] = (action.action || "").split(":");

  if (actionType === "start_agent") {
    return {
      toast: {
        type: "success",
        content: "Agent 已开始执行",
      },
    };
  }

  return { success: true };
}

async function handleApprovalFlowAction(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  actionValue: CardActionValue,
  openId?: string,
) {
  // action 格式: approval_flow:approve:flowId 或 approval_flow:reject:flowId
  const parts = (actionValue.action || "").split(":");
  if (parts.length < 3) {
    return { error: "Invalid action format" };
  }

  const [, actionType, flowId] = parts;

  if (!flowId) {
    return { error: "Missing flowId" };
  }

  if (!openId) {
    return { error: "Missing open_id" };
  }

  // 根据 open_id 查找用户
  const db = useDB();
  const [feishuBinding] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId))
    .limit(1);

  if (!feishuBinding?.user_id) {
    return {
      toast: {
        type: "error",
        content: "未找到关联的用户账号",
      },
    };
  }

  try {
    if (actionType === "approve") {
      await approveFlow(event, flowId, feishuBinding.user_id);
      return {
        toast: {
          type: "success",
          content: "审批已通过",
        },
      };
    } else if (actionType === "reject") {
      await rejectFlow(event, flowId, feishuBinding.user_id);
      return {
        toast: {
          type: "info",
          content: "审批已拒绝",
        },
      };
    }
  } catch (e) {
    console.error("[ApprovalFlow] Card action error:", e);
    return {
      toast: {
        type: "error",
        content: e instanceof Error ? e.message : "操作失败",
      },
    };
  }

  return { success: true };
}
