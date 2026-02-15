/**
 * 飞书 SDK 消息相关类型
 */

/** 消息接收者类型 */
export type ReceiveIdType = "open_id" | "user_id" | "union_id" | "email" | "chat_id";

/** 发送/回复消息的响应 */
export interface SendMessageResponse {
  /** 消息 ID */
  messageId: string;
  /** 根消息 ID (用于消息链) */
  rootId?: string;
  /** 父消息 ID */
  parentId?: string;
  /** 消息类型 */
  msgType: string;
  /** 创建时间 (毫秒时间戳) */
  createTime: string;
  /** 更新时间 (毫秒时间戳) */
  updateTime: string;
  /** 是否被撤回 */
  deleted: boolean;
  /** 是否被更新 */
  updated: boolean;
  /** 会话 ID */
  chatId: string;
  /** 发送者信息 */
  sender: {
    id: string;
    idType: string;
    senderType: string;
    tenantKey?: string;
  };
}
