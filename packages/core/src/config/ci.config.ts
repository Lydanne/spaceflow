import { z } from "zod";
import { createEnvConfigLoader } from "./config-loader";

/** CI 配置 Schema */
const schemaFactory = () =>
  z.object({
    /** 仓库名称 (owner/repo 格式) */
    repository: z
      .string()
      .default(process.env.GITHUB_REPOSITORY || "")
      .describe("仓库名称 (owner/repo 格式)"),
    /** 当前分支名称 */
    refName: z
      .string()
      .default(process.env.GITHUB_REF_NAME || "")
      .describe("当前分支名称"),
    actor: z
      .string()
      .default(process.env.GITHUB_ACTOR || "")
      .describe("当前操作者"),
  });

/** CI 配置类型 */
export type CiConfig = z.infer<ReturnType<typeof schemaFactory>>;

export const ciConfig = createEnvConfigLoader({
  configKey: "ci",
  schemaFactory,
});
