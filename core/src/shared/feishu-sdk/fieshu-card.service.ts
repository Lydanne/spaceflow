import { Injectable } from "@nestjs/common";
import { FeishuSdkService } from "./feishu-sdk.service";
import {
  SendCardParams,
  ReplyCardParams,
  UpdateCardParams,
  SendMessageResponse,
  CardContent,
  type CardActionTriggerCallback,
} from "./types";
import { OnEvent, type EventEmitter2 } from "@nestjs/event-emitter";
import { FEISHU_CARD_ACTION_TRIGGER } from "./types";

/**
 * 飞书卡片消息服务
 * 提供卡片消息的发送、回复、更新功能
 */
@Injectable()
export class FeishuCardService {
  constructor(
    protected readonly feishuSdkService: FeishuSdkService,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(FEISHU_CARD_ACTION_TRIGGER)
  async handleCardActionTrigger(event: CardActionTriggerCallback) {
    const event_hook = event.header.event_type ?? event.event.action.tag;

    // console.log(event_hook);
  }

  /**
   * 将卡片内容转换为字符串
   */
  protected serializeCard(card: CardContent): string {
    return typeof card === "string" ? card : JSON.stringify(card);
  }

  /**
   * 转换 API 响应为统一格式
   */
  protected transformMessageResponse(data: any): SendMessageResponse {
    return {
      messageId: data.message_id,
      rootId: data.root_id,
      parentId: data.parent_id,
      msgType: data.msg_type,
      createTime: data.create_time,
      updateTime: data.update_time,
      deleted: data.deleted,
      updated: data.updated,
      chatId: data.chat_id,
      sender: {
        id: data.sender?.id,
        idType: data.sender?.id_type,
        senderType: data.sender?.sender_type,
        tenantKey: data.sender?.tenant_key,
      },
    };
  }

  /**
   * 发送卡片消息
   * @param params 发送卡片消息的参数
   * @returns 发送结果
   */
  async sendCard(params: SendCardParams): Promise<SendMessageResponse> {
    const { receiveId, receiveIdType, card, uuid } = params;
    const client = this.feishuSdkService.getClient();

    const response = await client.im.message.create({
      params: {
        receive_id_type: receiveIdType,
      },
      data: {
        receive_id: receiveId,
        msg_type: "interactive",
        content: this.serializeCard(card),
        uuid,
      },
    });

    if (response.code !== 0) {
      throw new Error(`飞书发送卡片失败: ${response.code} - ${response.msg}`);
    }

    return this.transformMessageResponse(response.data);
  }

  /**
   * 回复卡片消息
   * @param params 回复卡片消息的参数
   * @returns 回复结果
   */
  async replyCard(params: ReplyCardParams): Promise<SendMessageResponse> {
    const { messageId, card, uuid } = params;
    const client = this.feishuSdkService.getClient();

    const response = await client.im.message.reply({
      path: {
        message_id: messageId,
      },
      data: {
        msg_type: "interactive",
        content: this.serializeCard(card),
        uuid,
      },
    });

    if (response.code !== 0) {
      throw new Error(`飞书回复卡片失败: ${response.code} - ${response.msg}`);
    }

    return this.transformMessageResponse(response.data);
  }

  /**
   * 更新卡片消息
   * @param params 更新卡片消息的参数
   * @returns 更新是否成功
   */
  async updateCard(params: UpdateCardParams): Promise<void> {
    const { messageId, card } = params;
    const client = this.feishuSdkService.getClient();

    const response = await client.im.message.patch({
      path: {
        message_id: messageId,
      },
      data: {
        content: this.serializeCard(card),
      },
    });

    if (response.code !== 0) {
      throw new Error(`飞书更新卡片失败: ${response.code} - ${response.msg}`);
    }
  }
}
