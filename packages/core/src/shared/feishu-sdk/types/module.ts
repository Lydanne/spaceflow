/**
 * 飞书 SDK 模块配置类型
 */

export const FEISHU_MODULE_OPTIONS = "FEISHU_MODULE_OPTIONS";

export interface FeishuModuleOptions {
  /** 应用 ID */
  appId: string;
  /** 应用密钥 */
  appSecret: string;
  /** 应用类型：自建应用或商店应用 */
  appType?: "self_build" | "store";
  /** 域名：飞书或 Lark */
  domain?: "feishu" | "lark";
}

export interface FeishuModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<FeishuModuleOptions> | FeishuModuleOptions;
  inject?: any[];
}
