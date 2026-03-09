import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { verifyFeishuEventSignature } from "~~/server/utils/feishu-sdk";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();

  const signature = getHeader(event, "x-lark-signature");
  const timestamp = getHeader(event, "x-lark-request-timestamp");
  const nonce = getHeader(event, "x-lark-request-nonce");

  if (
    signature &&
    timestamp &&
    nonce &&
    config.feishuEncryptKey &&
    !verifyFeishuEventSignature(
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
      interaction,
      actionValue,
      action.form_value,
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
  interaction: CardInteractionRecord,
  actionValue: CardActionValue,
  formValue?: Record<string, unknown>,
) {
  const { card_type, business_id } = interaction;

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
  _approvalId: string,
  action: CardActionValue,
) {
  const db = useDB();
  const [actionType, id] = (action.action || "").split(":");

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

async function handleConfigForm(_formId: string, _formValue?: Record<string, unknown>) {
  return {
    toast: {
      type: "success",
      content: "配置已保存",
    },
  };
}

async function handleAgentConfirm(_sessionId: string, action: CardActionValue) {
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
