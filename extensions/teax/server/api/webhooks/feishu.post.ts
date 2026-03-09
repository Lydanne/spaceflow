import { verifyFeishuEventSignature } from "~~/server/utils/feishu-sdk";
import { handleBotCommand } from "~~/server/services/bot-command.service";
import { handleFeishuApprovalEvent } from "~~/server/services/approval.service";

interface FeishuEventPayload {
  schema?: string;
  header?: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event?: {
    sender?: {
      sender_id?: {
        open_id?: string;
        user_id?: string;
        union_id?: string;
      };
      sender_type?: string;
    };
    message?: {
      message_id: string;
      root_id?: string;
      parent_id?: string;
      create_time: string;
      chat_id: string;
      chat_type: string;
      message_type: string;
      content: string;
    };
  };
  // v1 URL 验证
  challenge?: string;
  token?: string;
  type?: string;
  // v2 签名验证
  encrypt?: string;
}

// 已处理的 event_id 缓存（防重放，保留 5 分钟）
const processedEvents = new Map<string, number>();
const EVENT_DEDUP_TTL = 5 * 60 * 1000;

function cleanupProcessedEvents() {
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > EVENT_DEDUP_TTL) {
      processedEvents.delete(id);
    }
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, "utf-8");
  if (!rawBody) {
    throw createError({ statusCode: 400, message: "Empty request body" });
  }

  let payload: FeishuEventPayload;
  try {
    payload = JSON.parse(rawBody) as FeishuEventPayload;
  } catch {
    throw createError({ statusCode: 400, message: "Invalid JSON payload" });
  }

  const config = useRuntimeConfig();

  // ─── v1 URL 验证（飞书配置事件回调时的验证请求） ──────────
  if (payload.type === "url_verification") {
    if (config.feishuVerificationToken && payload.token !== config.feishuVerificationToken) {
      throw createError({ statusCode: 401, message: "Invalid verification token" });
    }
    return { challenge: payload.challenge };
  }

  // ─── v2 签名验证 ──────────────────────────────────────────
  if (config.feishuEncryptKey) {
    const timestamp = getRequestHeader(event, "x-lark-request-timestamp") || "";
    const nonce = getRequestHeader(event, "x-lark-request-nonce") || "";
    const signature = getRequestHeader(event, "x-lark-signature") || "";

    if (signature && !verifyFeishuEventSignature(timestamp, nonce, config.feishuEncryptKey, rawBody, signature)) {
      throw createError({ statusCode: 401, message: "Invalid event signature" });
    }
  }

  // ─── verification token 校验 ─────────────────────────────
  if (config.feishuVerificationToken && payload.header?.token) {
    if (payload.header.token !== config.feishuVerificationToken) {
      throw createError({ statusCode: 401, message: "Invalid event token" });
    }
  }

  // ─── 事件去重 ─────────────────────────────────────────────
  const eventId = payload.header?.event_id;
  if (eventId) {
    cleanupProcessedEvents();
    if (processedEvents.has(eventId)) {
      return { code: 0, msg: "duplicate event ignored" };
    }
    processedEvents.set(eventId, Date.now());
  }

  // ─── 处理消息事件（机器人指令） ───────────────────────────
  const eventType = payload.header?.event_type;

  if (eventType === "im.message.receive_v1" && payload.event?.message) {
    const msg = payload.event.message;
    const senderId = payload.event.sender?.sender_id?.open_id;

    // 只处理文本消息
    if (msg.message_type === "text" && senderId) {
      let textContent = "";
      try {
        const parsed = JSON.parse(msg.content) as { text?: string };
        textContent = parsed.text || "";
      } catch {
        textContent = msg.content;
      }

      // 去除 @bot 的 mention 前缀
      textContent = textContent.replace(/@_user_\d+\s*/g, "").trim();

      if (textContent) {
        // 异步处理指令，不阻塞回调响应
        handleBotCommand({
          messageId: msg.message_id,
          chatId: msg.chat_id,
          chatType: msg.chat_type,
          senderOpenId: senderId,
          text: textContent,
        }).catch((e: unknown) => console.error("[feishu-bot] command error:", e));
      }
    }

    return { code: 0, msg: "ok" };
  }

  // ─── 处理审批事件 ─────────────────────────────────────────
  if (eventType === "approval_instance" || eventType === "approval") {
    const approvalData = (payload.event || {}) as Record<string, unknown>;
    handleFeishuApprovalEvent({
      instance_code: approvalData.instance_code as string | undefined,
      status: approvalData.status as string | undefined,
      approval_code: approvalData.approval_code as string | undefined,
      operate_time: approvalData.operate_time as string | undefined,
      type: approvalData.type as string | undefined,
    }).catch((e: unknown) => console.error("[feishu-bot] approval event error:", e));
    return { code: 0, msg: "ok" };
  }

  return { code: 0, msg: "unhandled event" };
});
