import { z } from "zod";
import { createConfigLoader } from "./config-loader";

const schemaFactory = () =>
  z.object({
    /** 飞书应用 ID */
    appId: z
      .string()
      .default(process.env.FEISHU_APP_ID || "")
      .describe("飞书应用 ID"),
    /** 飞书应用密钥 */
    appSecret: z
      .string()
      .default(process.env.FEISHU_APP_SECRET || "")
      .describe("飞书应用密钥"),
    /** 应用类型：自建应用或商店应用 */
    appType: z
      .enum(["self_build", "store"])
      .default((process.env.FEISHU_APP_TYPE as "self_build" | "store") || "self_build")
      .describe("应用类型"),
    /** 域名：飞书或 Lark */
    domain: z
      .enum(["feishu", "lark"])
      .default((process.env.FEISHU_DOMAIN as "feishu" | "lark") || "feishu")
      .describe("域名"),
  });

/** 飞书配置类型 */
export type FeishuConfig = z.infer<ReturnType<typeof schemaFactory>>;

export const feishuConfig = createConfigLoader({
  configKey: "feishu",
  schemaFactory,
  description: "飞书 SDK 配置",
});
