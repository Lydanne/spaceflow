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
    console.warn(
      "[feishu-ws] Missing app credentials, long connection disabled",
    );
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
        "im.message.receive_v1": async (
          data: Parameters<typeof handleMessageEvent>[0],
        ) => {
          await handleMessageEvent(data);
        },
        // 卡片交互事件
        "card.action.trigger": async (
          data: Parameters<typeof handleCardActionEvent>[0],
        ) => {
          return await handleCardActionEvent(data);
        },
        // 审批事件
        approval_instance: async (
          data: Parameters<typeof handleApprovalEvent>[0],
        ) => {
          await handleApprovalEvent(data);
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
 * 从飞书富文本(post)消息中提取纯文本
 */
function extractPostText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    const textParts: string[] = [];
    const contentBlocks: unknown[][] = parsed.content || [];
    for (const block of contentBlocks) {
      if (Array.isArray(block)) {
        for (const element of block) {
          const el = element as Record<string, unknown>;
          if (el.tag === "text" || el.tag === "a") {
            textParts.push(String(el.text || ""));
          }
          // 跳过 at 标签（@mention）
        }
      }
    }
    return textParts.join("");
  } catch {
    return "";
  }
}

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
    mentions?: Array<{
      key: string;
      id: { open_id?: string; user_id?: string; union_id?: string };
      name: string;
      tenant_key?: string;
    }>;
  };
}): Promise<void> {
  try {
    const message = data.message;
    const sender = data.sender;

    if (!message || !sender) {
      return;
    }

    // 确定消息类型：text 和 post 可处理，其他忽略
    const isTextMessage = message.message_type === "text";
    const isPostMessage = message.message_type === "post";
    if (!isTextMessage && !isPostMessage) {
      return;
    }

    const senderId = sender.sender_id?.open_id;
    if (!senderId) {
      return;
    }

    // 群聊中必须 @ 机器人才响应
    const isGroupChat = message.chat_type === "group";
    const isMentioned = data.message.mentions?.some(
      (m) => m.name === "Teax" || m.name === "TeaxBot",
    );

    if (isGroupChat && !isMentioned) {
      // 群聊中没有 @ 机器人，忽略
      return;
    }

    // 提取文本内容
    let textContent = "";
    if (isPostMessage) {
      textContent = extractPostText(message.content);
    } else {
      try {
        const parsed = JSON.parse(message.content);
        textContent = parsed.text || "";
      } catch {
        textContent = message.content;
      }
    }

    // 去除 @bot 的 mention 前缀
    textContent = textContent.replace(/@_user_\d+\s*/g, "").trim();

    console.log(
      `[feishu-ws] 📨 Message from ${senderId}: ${textContent || "(empty)"}`,
    );

    // 1. 优先尝试链接处理器（支持 text 和 post 消息）
    const { handleLinkMessage } = await import("~~/server/utils/link-handler");
    // 确保 link handlers 已注册（触发 bot-link-handlers 模块加载）
    await import("~~/server/services/bot-link-handlers");

    const linkHandled = await handleLinkMessage({
      text: textContent,
      senderOpenId: senderId,
      messageId: message.message_id,
      chatId: message.chat_id,
      chatType: message.chat_type,
    });

    if (linkHandled) {
      return;
    }

    // 2. 仅文本消息继续走命令处理
    if (!isTextMessage) {
      return;
    }

    // 调用指令处理(空文本也处理,用于显示控制面板)
    const { handleBotCommand }
      = await import("~~/server/services/bot-command.service");
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
 * 返回值会被飞书用于更新卡片
 */
async function handleCardActionEvent(
  data: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  try {
    const action = data.action as Record<string, unknown> | undefined;
    const operator = data.operator as
      | { open_id?: string; user_id?: string }
      | undefined;
    const token = data.token as string | undefined;
    // 消息 ID 在 context.open_message_id 中
    const context = data.context as
      | { open_message_id?: string; open_chat_id?: string }
      | undefined;
    const openMessageId = context?.open_message_id;

    if (!action || !operator || !token) {
      return {};
    }

    const openId = operator.open_id;
    if (!openId) {
      return {};
    }

    console.log(`[feishu-ws] 🎯 Card action from ${openId}`);

    // 使用卡片更新器
    let cardUpdater:
      | Awaited<
        ReturnType<
            typeof import("~~/server/utils/feishu-card-updater").createCardUpdater
        >
      >
      | undefined;
    if (openMessageId) {
      const { createCardUpdater }
        = await import("~~/server/utils/feishu-card-updater");
      cardUpdater = createCardUpdater("long", openMessageId);
    }

    const { handleCardAction }
      = await import("~~/server/services/bot-command.service");
    const { sendFeishuCardMessage }
      = await import("~~/server/utils/feishu-sdk");

    // handleCardAction 内部会通过 updateCard 回调更新卡片，
    // 其返回值可能是 toast 等响应对象，需要透传给飞书。
    const result = await handleCardAction({
      action: action as Record<string, unknown>,
      openId,
      token,
      updateCard: cardUpdater?.updateCard,
      sendCard: async (card) => {
        await sendFeishuCardMessage(openId, card);
      },
    });

    // 有显式返回值则透传（如 toast），否则返回空对象告诉飞书不做额外处理
    return result ?? {};
  } catch (error) {
    console.error("[feishu-ws] Error handling card action:", error);
    return {};
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

    const { handleFeishuApprovalEvent }
      = await import("~~/server/services/approval.service");
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
 * 获取长连接状态
 */
export function getLongConnectionStatus(): {
  enabled: boolean;
  connected: boolean;
} {
  return {
    enabled: wsClient !== null,
    connected: wsClient !== null,
  };
}
