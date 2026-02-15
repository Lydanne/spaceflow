/**
 * 飞书 SDK 卡片消息相关类型
 */

import type { ReceiveIdType } from "./message";

/** 卡片消息内容，可以是 JSON 对象或 JSON 字符串 */
export type CardContent = Record<string, unknown> | string;

/** 发送卡片消息参数 */
export interface SendCardParams {
  /** 接收者 ID */
  receiveId: string;
  /** 接收者 ID 类型 */
  receiveIdType: ReceiveIdType;
  /** 卡片内容 (JSON 对象或字符串) */
  card: CardContent;
  /** 可选的 UUID，用于幂等性控制 */
  uuid?: string;
}

/** 回复卡片消息参数 */
export interface ReplyCardParams {
  /** 要回复的消息 ID */
  messageId: string;
  /** 卡片内容 (JSON 对象或字符串) */
  card: CardContent;
  /** 可选的 UUID，用于幂等性控制 */
  uuid?: string;
}

/** 更新卡片消息参数 */
export interface UpdateCardParams {
  /** 要更新的消息 ID */
  messageId: string;
  /** 新的卡片内容 (JSON 对象或字符串) */
  card: CardContent;
}

/** 卡片数据 - 使用 JSON 代码 */
export interface CardDataRaw {
  /** 卡片类型: raw 表示 JSON 构建的卡片 */
  type: "raw";
  /** 卡片的 JSON 数据 */
  data: Record<string, unknown>;
}

/** 卡片数据 - 使用卡片模板 */
export interface CardDataTemplate {
  /** 卡片类型: template 表示卡片模板 */
  type: "template";
  /** 卡片模板数据 */
  data: {
    /** 卡片模板 ID */
    template_id: string;
    /** 卡片模板版本号 */
    template_version_name?: string;
    /** 卡片模板变量 */
    template_variable?: Record<string, unknown>;
  };
}

/** 卡片数据类型 */
export type CardData = CardDataRaw | CardDataTemplate;
