/**
 * 消息服务抽象层 - 类型定义
 * 保持飞书 SDK 的原始结构，只抽象接收者类型和发送方法
 */

// ─── 飞书卡片类型（保持原始结构） ─────────────────────
export interface FeishuInteractiveCard {
  header?: {
    title: { tag: string; content: string };
    template?: string;
  };
  elements?: Array<{
    tag: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ─── 接收者类型定义 ───────────────────────────────────
export type ReceiveIdType = "open_id" | "user_id" | "union_id" | "email" | "chat_id";

// ─── 消息发送结果 ─────────────────────────────────────
export interface SendMessageResult {
  message_id?: string;
}

export interface BatchSendResult {
  sent: number;
  failed: number;
}

// ─── 审批流程 ─────────────────────────────────────────
export interface ApprovalForm {
  id: string;
  type: string;
  value: string;
}

export interface ApprovalRequest {
  approvalCode: string;
  userId: string;
  form: ApprovalForm[];
}

export interface ApprovalStatus {
  status: string;
  form?: string;
}

// ─── 消息服务提供者接口 ───────────────────────────────
export interface IMessagingProvider {
  /** 提供者名称 */
  readonly name: string;

  /** 发送文本消息 */
  sendTextMessage(
    receiveId: string,
    content: string,
    receiveIdType?: ReceiveIdType,
  ): Promise<SendMessageResult>;

  /** 发送卡片消息 */
  sendCardMessage(
    receiveId: string,
    card: FeishuInteractiveCard,
    receiveIdType?: ReceiveIdType,
  ): Promise<SendMessageResult>;

  /** 批量发送卡片消息 */
  sendBatchCardMessage(
    receiveIds: string[],
    card: FeishuInteractiveCard,
  ): Promise<BatchSendResult>;

  /** 回复文本消息 */
  replyTextMessage(messageId: string, content: string): Promise<void>;

  /** 回复卡片消息 */
  replyCardMessage(messageId: string, card: FeishuInteractiveCard): Promise<void>;

  /** 更新卡片消息 */
  updateCardMessage(messageId: string, card: FeishuInteractiveCard): Promise<void>;

  /** 创建审批实例（可选） */
  createApproval?(params: {
    approval_code: string;
    open_id: string;
    form: Array<{ id: string; type: string; value: string }>;
  }): Promise<string>;

  /** 查询审批状态（可选） */
  getApprovalStatus?(instanceCode: string): Promise<{ status: string; form?: string }>;

  /** 验证事件签名（可选） */
  verifyEventSignature?(params: {
    timestamp: string;
    nonce: string;
    body: string;
    signature: string;
  }): boolean;

  /** 构建 OAuth 授权 URL（可选） */
  buildAuthUrl?(state: string): string;

  /** 交换授权码获取 token（可选） */
  exchangeAuthCode?(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }>;

  /** 获取用户信息（可选） */
  getUserInfo?(accessToken: string): Promise<{
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  }>;
}
