/**
 * 飞书 SDK 卡片交互回调相关类型
 */

import type { I18nLocale } from "./common";
import type { CardData } from "./card";

/** 卡片交互事件名称常量 */
export const FEISHU_CARD_ACTION_TRIGGER = "card.action.trigger" as const;

/** 回调基本信息 (header) */
export interface CardActionHeader {
  /** 回调的唯一标识 */
  event_id: string;
  /** 应用的 Verification Token */
  token: string;
  /** 回调发送的时间，微秒级时间戳 */
  create_time: string;
  /** 回调类型，固定为 "card.action.trigger" */
  event_type: typeof FEISHU_CARD_ACTION_TRIGGER;
  /** 应用归属的 tenant key */
  tenant_key: string;
  /** 应用的 App ID */
  app_id: string;
}

/** 操作者信息 */
export interface CardActionOperator {
  /** 回调触发者的 tenant key */
  tenant_key: string;
  /** 回调触发者的 user_id (需开启权限) */
  user_id?: string;
  /** 回调触发者的 open_id */
  open_id: string;
  /** 回调触发者的 union_id */
  union_id?: string;
}

/** 交互信息 */
export interface CardActionInfo {
  /** 交互组件绑定的开发者自定义回传数据 */
  value?: Record<string, unknown> | string;
  /** 交互组件的标签 */
  tag: string;
  /** 用户当前所在地区的时区 */
  timezone?: string;
  /** 组件的自定义唯一标识 */
  name?: string;
  /** 表单容器内用户提交的数据 */
  form_value?: Record<string, unknown>;
  /** 输入框组件提交的数据 (未内嵌在表单中时) */
  input_value?: string;
  /** 单选组件的选项回调值 */
  option?: string;
  /** 多选组件的选项回调值 */
  options?: string[];
  /** 勾选器组件的回调数据 */
  checked?: boolean;
}

/** 展示场景上下文 */
export interface CardActionContext {
  /** 链接地址 (适用于链接预览场景) */
  url?: string;
  /** 链接预览的 token */
  preview_token?: string;
  /** 消息 ID */
  open_message_id: string;
  /** 会话 ID */
  open_chat_id: string;
}

/** 回调详细信息 (event) */
export interface CardActionEventData {
  /** 回调触发者信息 */
  operator: CardActionOperator;
  /** 更新卡片用的凭证，有效期 30 分钟，最多可更新 2 次 */
  token: string;
  /** 交互信息 */
  action: CardActionInfo;
  /** 卡片展示场景 */
  host?: string;
  /** 卡片分发类型，链接预览卡片时为 url_preview */
  delivery_type?: "url_preview";
  /** 展示场景上下文 */
  context: CardActionContext;
}

/** 回调结构体 (schema 2.0) */
export interface CardActionTriggerCallback {
  /** 回调版本，固定为 "2.0" */
  schema: "2.0";
  /** 回调基本信息 */
  header: CardActionHeader;
  /** 回调详细信息 */
  event: CardActionEventData;
}

/** Toast 提示配置 */
export interface CardActionToast {
  /** 弹窗提示的类型 */
  type?: "info" | "success" | "error" | "warning";
  /** 单语言提示文案 */
  content?: string;
  /** 多语言提示文案 */
  i18n?: Partial<Record<I18nLocale, string>>;
}

/** 响应回调的结构体 */
export interface CardActionTriggerResponse {
  /** Toast 弹窗提示 */
  toast?: CardActionToast;
  /** 卡片数据 (用于更新卡片) */
  card?: CardData;
}

/** 交互事件回调接口 */
export interface CardActionTriggerEventCallback {
  /** 完成回调，返回响应结果 */
  done: (result: CardActionTriggerResponse) => void;
}

/** 交互事件 (用于事件监听器)，包含回调数据和 done 方法 */
export interface CardActionTriggerEvent
  extends CardActionTriggerEventCallback, CardActionTriggerCallback {}

/** 事件注册类型 */
export interface CardEvents {
  [FEISHU_CARD_ACTION_TRIGGER]: (
    data: CardActionTriggerCallback,
  ) => Promise<CardActionTriggerResponse>;
}
