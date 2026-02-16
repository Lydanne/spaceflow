import { EventEmitter } from "events";
import * as lark from "@larksuiteoapi/node-sdk";
import {
  FeishuModuleOptions,
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
export class FeishuSdkService {
  protected readonly client: lark.Client;
  protected readonly eventEmitter: EventEmitter;
  private eventDispatcher: lark.EventDispatcher | null = null;

  constructor(protected readonly options: FeishuModuleOptions) {
    this.eventEmitter = new EventEmitter();
    this.client = new lark.Client({
      appId: options.appId,
      appSecret: options.appSecret,
      appType: options.appType === "store" ? lark.AppType.ISV : lark.AppType.SelfBuild,
      domain: options.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
    });

    this.initEventDispatcher();
  }

  /**
   * 注册事件监听器
   */
  on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  /**
   * 移除事件监听器
   */
  off(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(eventName, listener);
  }

  private initEventDispatcher(): void {
    this.eventDispatcher = new lark.EventDispatcher({
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

  destroy(): void {
    this.eventEmitter.removeAllListeners();
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
