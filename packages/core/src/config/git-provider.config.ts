import { z } from "zod";
import { createConfigLoader } from "./config-loader";
import { detectProvider } from "../shared/git-provider/detect-provider";

/** 从环境自动检测的默认值 */
const detected = detectProvider();

/** Git Provider 配置 Schema */
const schemaFactory = () =>
  z.object({
    /** Git Provider 类型（自动检测或手动指定） */
    provider: z
      .enum(["gitea", "github", "gitlab"])
      .default(detected.provider)
      .describe("Git Provider 类型 (github | gitea | gitlab)，未指定时自动检测"),
    /** Git Provider 服务器 URL */
    serverUrl: z.string().default(detected.serverUrl).describe("Git Provider 服务器 URL"),
    /** Git Provider API Token */
    token: z.string().default(detected.token).describe("Git Provider API Token"),
  });

/** Git Provider 配置类型 */
export type GitProviderConfig = z.infer<ReturnType<typeof schemaFactory>>;

export const gitProviderConfig = createConfigLoader({
  configKey: "gitProvider",
  schemaFactory,
  description: "Git Provider 服务配置",
});
