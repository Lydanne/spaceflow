import { z } from "zod";
import { createConfigLoader } from "./config-loader";

/** Storage 配置 Schema */
const schemaFactory = () =>
  z.object({
    /** 适配器类型：memory 或 file */
    adapter: z
      .enum(["memory", "file"])
      .default((process.env.STORAGE_ADAPTER as "memory" | "file") || "memory")
      .describe("适配器类型"),
    /** 文件适配器的存储路径（仅 file 适配器需要） */
    filePath: z.string().optional().describe("文件存储路径"),
    /** 默认过期时间（毫秒），0 表示永不过期 */
    defaultTtl: z
      .number()
      .default(process.env.STORAGE_DEFAULT_TTL ? parseInt(process.env.STORAGE_DEFAULT_TTL, 10) : 0)
      .describe("默认过期时间（毫秒）"),
    /** 最大 key 数量，0 表示不限制 */
    maxKeys: z
      .number()
      .default(process.env.STORAGE_MAX_KEYS ? parseInt(process.env.STORAGE_MAX_KEYS, 10) : 0)
      .describe("最大 key 数量"),
  });

/** Storage 配置类型 */
export type StorageConfig = z.infer<ReturnType<typeof schemaFactory>>;

export const storageConfig = createConfigLoader({
  configKey: "storage",
  schemaFactory,
  description: "存储服务配置",
});
