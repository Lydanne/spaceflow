/**
 * 飞书长连接插件
 * 使用 WebSocket 模式接收事件推送,无需公网 IP
 *
 * 官方文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/long-connection-mode
 */

import * as lark from "@larksuiteoapi/node-sdk";

let wsClient: lark.WSClient | null = null;

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig();

  // 检查配置
  if (!config.feishuAppId || !config.feishuAppSecret) {
    console.warn("[feishu-ws] Missing app credentials, long connection disabled");
    return;
  }

  // 可通过环境变量禁用长连接(开发时使用 Webhook)
  if (process.env.FEISHU_LONGCONNECTION_DISABLED === "true") {
    console.log("[feishu-ws] Long connection disabled by env");
    return;
  }

  console.log("[feishu-ws] 🚀 Starting long connection...");

  try {
    // 创建 WebSocket 客户端
    wsClient = new lark.WSClient({
      appId: config.feishuAppId,
      appSecret: config.feishuAppSecret,
      loggerLevel: lark.LoggerLevel.info,
    });

    // 启动长连接并注册事件处理器
    await wsClient.start({
      eventDispatcher: new lark.EventDispatcher({
        // 加密密钥(可选)
        encryptKey: config.feishuEncryptKey || undefined,
      }).register({
        // 消息接收事件
        "im.message.receive_v1": async (data: Parameters<typeof handleMessageEvent>[0]) => {
          await handleMessageEvent(data);
        },
        // 卡片交互事件
        "card.action.trigger": async (data: Parameters<typeof handleCardActionEvent>[0]) => {
          await handleCardActionEvent(data);
        },
        // 审批事件
        approval_instance: async (data: Parameters<typeof handleApprovalEvent>[0]) => {
          await handleApprovalEvent(data);
        },
        // 菜单点击事件
        "application.bot.menu_v6": async (data: Parameters<typeof handleMenuClickEvent>[0]) => {
          await handleMenuClickEvent(data);
        },
      }),
    });

    console.log("[feishu-ws] ✅ Long connection established successfully");
  } catch (error) {
    console.error("[feishu-ws] ❌ Failed to start long connection:", error);
    wsClient = null;
  }

  // 优雅关闭
  if (process.env.NODE_ENV === "production") {
    process.on("SIGTERM", async () => {
      console.log("[feishu-ws] Shutting down long connection...");
      if (wsClient) {
        // SDK 会自动处理关闭
        wsClient = null;
      }
    });
  }
});

/**
 * 处理消息事件
 */
async function handleMessageEvent(data: {
  sender: {
    sender_id?: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key?: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    update_time?: string;
    chat_id: string;
    thread_id?: string;
    chat_type: string;
    message_type: string;
    content: string;
  };
}): Promise<void> {
  try {
    const message = data.message;
    const sender = data.sender;

    if (!message || !sender) {
      return;
    }

    // 只处理文本消息
    if (message.message_type !== "text") {
      return;
    }

    const senderId = sender.sender_id?.open_id;
    if (!senderId) {
      return;
    }

    let textContent = "";
    try {
      const parsed = JSON.parse(message.content);
      textContent = parsed.text || "";
    } catch {
      textContent = message.content;
    }

    // 去除 @bot 的 mention 前缀
    textContent = textContent.replace(/@_user_\d+\s*/g, "").trim();

    if (!textContent) {
      return;
    }

    console.log(`[feishu-ws] 📨 Message from ${senderId}: ${textContent}`);

    // 调用指令处理
    const { handleBotCommand } = await import("~~/server/services/bot-command.service");
    await handleBotCommand({
      messageId: message.message_id,
      chatId: message.chat_id,
      chatType: message.chat_type,
      senderOpenId: senderId,
      text: textContent,
    });
  } catch (error) {
    console.error("[feishu-ws] Error handling message:", error);
  }
}

/**
 * 处理卡片交互事件
 */
async function handleCardActionEvent(data: {
  action?: Record<string, unknown>;
  operator?: {
    open_id?: string;
    user_id?: string;
  };
  token?: string;
}): Promise<void> {
  try {
    const action = data.action;
    const operator = data.operator;
    const token = data.token;

    if (!action || !operator || !token) {
      return;
    }

    const openId = operator.open_id;
    if (!openId) {
      return;
    }

    console.log(`[feishu-ws] 🎯 Card action from ${openId}`);

    const { handleCardAction } = await import("~~/server/services/bot-command.service");
    await handleCardAction({
      action: action as Record<string, unknown>,
      openId,
      token,
    });
  } catch (error) {
    console.error("[feishu-ws] Error handling card action:", error);
  }
}

/**
 * 处理审批事件
 */
async function handleApprovalEvent(data: {
  instance_code?: string;
  status?: string;
  approval_code?: string;
  operate_time?: string;
  type?: string;
}): Promise<void> {
  try {
    console.log("[feishu-ws] 📋 Approval event received");

    const { handleFeishuApprovalEvent } = await import("~~/server/services/approval.service");
    await handleFeishuApprovalEvent({
      instance_code: data.instance_code,
      status: data.status,
      approval_code: data.approval_code,
      operate_time: data.operate_time,
      type: data.type,
    });
  } catch (error) {
    console.error("[feishu-ws] Error handling approval:", error);
  }
}

/**
 * 处理菜单点击事件
 */
async function handleMenuClickEvent(data: {
  operator?: {
    operator_name?: string;
    operator_id?: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
  };
  event_key?: string;
}): Promise<void> {
  try {
    const operator = data.operator;
    const eventKey = data.event_key;

    if (!operator?.operator_id?.open_id || !eventKey) {
      return;
    }

    console.log(`[feishu-ws] 📱 Menu clicked: ${eventKey} by ${operator.operator_id.open_id}`);

    const { handleMenuClick } = await import("~~/server/services/bot-menu.service");
    await handleMenuClick(operator.operator_id.open_id, eventKey);
  } catch (error) {
    console.error("[feishu-ws] Error handling menu click:", error);
  }
}

/**
 * 获取长连接状态
 */
export function getLongConnectionStatus(): { enabled: boolean; connected: boolean } {
  return {
    enabled: wsClient !== null,
    connected: wsClient !== null,
  };
}
