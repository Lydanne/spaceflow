import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as lark from "@larksuiteoapi/node-sdk";
import {
  FeishuModuleOptions,
  FEISHU_MODULE_OPTIONS,
  FeishuUser,
  GetUserParams,
  FEISHU_CARD_ACTION_TRIGGER,
  type CardEvents,
  type CardActionTriggerResponse,
  type CardActionTriggerEvent,
} from "./types";

/**
 * 飞书 API 服务
 */
@Injectable()
export class FeishuSdkService implements OnModuleInit, OnModuleDestroy {
  protected readonly client: lark.Client;

  onModuleInit(): void {
    const eventDispatcher = new lark.EventDispatcher({
      encryptKey: "encrypt key",
    }).register<CardEvents>({
      [FEISHU_CARD_ACTION_TRIGGER]: async (data) => {
        let done: (result: CardActionTriggerResponse) => void = () => null;
        const p = new Promise<CardActionTriggerResponse>((resolve) => {
          done = resolve;
        });

        // 转换为事件监听器友好的格式
        const event: CardActionTriggerEvent = {
          ...data,
          done,
        };

        this.eventEmitter.emit(FEISHU_CARD_ACTION_TRIGGER, event);
        return await p;
      },
    });
  }

  onModuleDestroy(): void {
    this.eventEmitter.removeAllListeners();
  }

  constructor(
    @Inject(FEISHU_MODULE_OPTIONS)
    protected readonly options: FeishuModuleOptions,
    protected readonly eventEmitter: EventEmitter2,
  ) {
    this.client = new lark.Client({
      appId: options.appId,
      appSecret: options.appSecret,
      appType: options.appType === "store" ? lark.AppType.ISV : lark.AppType.SelfBuild,
      domain: options.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
    });
  }

  /**
   * 验证飞书配置
   */
  validateConfig(): void {
    if (!this.options?.appId) {
      throw new Error("缺少配置 feishu.appId (环境变量 FEISHU_APP_ID)");
    }

    if (!this.options?.appSecret) {
      throw new Error("缺少配置 feishu.appSecret (环境变量 FEISHU_APP_SECRET)");
    }
  }

  /**
   * 获取原始 Lark Client 实例
   * 用于调用 SDK 中未封装的 API
   */
  getClient(): lark.Client {
    return this.client;
  }

  /**
   * 获取用户信息
   * @param params 获取用户信息的参数
   * @returns 用户信息
   */
  async getUser(params: GetUserParams): Promise<FeishuUser | null> {
    const { userId, userIdType = "open_id", departmentIdType } = params;

    const response = await this.client.contact.user.get({
      path: {
        user_id: userId,
      },
      params: {
        user_id_type: userIdType,
        department_id_type: departmentIdType,
      },
    });

    if (response.code !== 0) {
      throw new Error(`飞书 API 错误: ${response.code} - ${response.msg}`);
    }

    return response.data?.user as FeishuUser | null;
  }

  /**
   * 批量获取用户信息
   * @param userIds 用户 ID 列表
   * @param userIdType 用户 ID 类型
   * @returns 用户信息列表
   */
  async batchGetUsers(
    userIds: string[],
    userIdType: "open_id" | "union_id" | "user_id" = "open_id",
  ): Promise<FeishuUser[]> {
    const response = await this.client.contact.user.batch({
      params: {
        user_ids: userIds,
        user_id_type: userIdType,
      },
    });

    if (response.code !== 0) {
      throw new Error(`飞书 API 错误: ${response.code} - ${response.msg}`);
    }

    return (response.data?.items || []) as FeishuUser[];
  }
}
