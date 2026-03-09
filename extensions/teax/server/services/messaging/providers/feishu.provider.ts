/**
 * 飞书消息服务提供者
 * 直接封装飞书 SDK，保持原始 API 结构
 */

import type {
  IMessagingProvider,
  FeishuInteractiveCard,
  SendMessageResult,
  BatchSendResult,
  ReceiveIdType,
} from "../types";
import {
  sendFeishuMessage,
  sendFeishuCardMessage,
  updateCardMessage,
  replyFeishuMessage,
  replyFeishuCardMessage,
  sendFeishuBatchMessage,
  createFeishuApprovalInstance,
  getFeishuApprovalInstance,
  verifyFeishuEventSignature,
  buildFeishuAuthUrl,
  exchangeFeishuCode,
  getFeishuUserInfo,
} from "~~/server/utils/feishu-sdk";

export class FeishuProvider implements IMessagingProvider {
  readonly name = "feishu";

  async sendTextMessage(
    receiveId: string,
    content: string,
    receiveIdType: ReceiveIdType = "open_id",
  ): Promise<SendMessageResult> {
    return sendFeishuMessage(receiveId, content, receiveIdType);
  }

  async sendCardMessage(
    receiveId: string,
    card: FeishuInteractiveCard,
    receiveIdType: ReceiveIdType = "open_id",
  ): Promise<SendMessageResult> {
    return sendFeishuCardMessage(receiveId, card, receiveIdType);
  }

  async sendBatchCardMessage(
    receiveIds: string[],
    card: FeishuInteractiveCard,
  ): Promise<BatchSendResult> {
    return sendFeishuBatchMessage(receiveIds, card);
  }

  async replyTextMessage(messageId: string, content: string): Promise<void> {
    await replyFeishuMessage(messageId, content);
  }

  async replyCardMessage(messageId: string, card: FeishuInteractiveCard): Promise<void> {
    await replyFeishuCardMessage(messageId, card);
  }

  async updateCardMessage(messageId: string, card: FeishuInteractiveCard): Promise<void> {
    await updateCardMessage(messageId, card);
  }

  async createApproval(params: {
    approval_code: string;
    open_id: string;
    form: Array<{ id: string; type: string; value: string }>;
  }): Promise<string> {
    return createFeishuApprovalInstance(params);
  }

  async getApprovalStatus(instanceCode: string): Promise<{ status: string; form?: string }> {
    return getFeishuApprovalInstance(instanceCode);
  }

  verifyEventSignature(params: {
    timestamp: string;
    nonce: string;
    body: string;
    signature: string;
  }): boolean {
    const config = useRuntimeConfig();
    return verifyFeishuEventSignature(
      params.timestamp,
      params.nonce,
      config.feishuEncryptKey,
      params.body,
      params.signature,
    );
  }

  buildAuthUrl(state: string): string {
    return buildFeishuAuthUrl(state);
  }

  async exchangeAuthCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const result = await exchangeFeishuCode(code);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expires_in,
    };
  }

  async getUserInfo(accessToken: string): Promise<{
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  }> {
    const info = await getFeishuUserInfo(accessToken);
    return {
      id: info.open_id,
      name: info.name,
      email: info.email,
      avatar: info.avatar_url,
    };
  }
}
