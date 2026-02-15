/**
 * 飞书 SDK 类型定义
 */

// Module - 模块配置
export {
  FEISHU_MODULE_OPTIONS,
  type FeishuModuleOptions,
  type FeishuModuleAsyncOptions,
} from "./module";

// Common - 通用类型
export { type I18nLocale } from "./common";

// User - 用户相关
export { type UserIdType, type FeishuUser, type GetUserParams } from "./user";

// Message - 消息相关
export { type ReceiveIdType, type SendMessageResponse } from "./message";

// Card - 卡片消息
export {
  type CardContent,
  type SendCardParams,
  type ReplyCardParams,
  type UpdateCardParams,
  type CardDataRaw,
  type CardDataTemplate,
  type CardData,
} from "./card";

// CardAction - 卡片交互回调
export {
  FEISHU_CARD_ACTION_TRIGGER,
  type CardActionHeader,
  type CardActionOperator,
  type CardActionInfo,
  type CardActionContext,
  type CardActionEventData,
  type CardActionTriggerCallback,
  type CardActionToast,
  type CardActionTriggerResponse,
  type CardActionTriggerEventCallback,
  type CardActionTriggerEvent,
  type CardEvents,
} from "./card-action";
