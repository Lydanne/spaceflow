import { z } from "zod";
import { readConfigSync } from "./spaceflow.config";
import { registerPluginSchema } from "./schema-generator.service";

/**
 * 配置加载器选项
 */
export interface ConfigLoaderOptions<T extends z.ZodObject<z.ZodRawShape>> {
  /** 配置 key（用于从 spaceflow.json 读取） */
  configKey: string;
  /** zod schema（应包含 .default() 设置默认值） */
  schemaFactory: () => T;
  /** 配置描述（用于生成 JSON Schema） */
  description?: string;
}

/**
 * 创建配置加载器
 * 统一使用 zod 进行配置验证和默认值填充
 *
 * @example
 * ```ts
 * const GitProviderConfigSchema = z.object({
 *   serverUrl: z.string().default(process.env.GITHUB_SERVER_URL || ""),
 *   token: z.string().default(process.env.GITHUB_TOKEN || ""),
 * });
 *
 * export type GitProviderConfig = z.infer<typeof GitProviderConfigSchema>;
 *
 * export const gitProviderConfig = createConfigLoader({
 *   configKey: "gitProvider",
 *   schemaFactory: GitProviderConfigSchema,
 *   description: "Git Provider 服务配置",
 * });
 * ```
 */
export function createConfigLoader<T extends z.ZodObject<z.ZodRawShape>>(
  options: ConfigLoaderOptions<T>,
) {
  const { configKey, schemaFactory, description } = options;

  // 创建配置加载器
  return (): z.infer<T> => {
    const schema = schemaFactory();
    // 注册 schema 用于 JSON Schema 生成
    registerPluginSchema({
      configKey,
      schemaFactory: () => schema,
      description,
    });

    const fileConfig = readConfigSync();
    const rawConfig = fileConfig[configKey] ?? {};

    // 使用 zod 验证并填充默认值
    const result = schema.safeParse(rawConfig);

    if (!result.success) {
      const errors = result.error.issues
        .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
        .join("\n");
      throw new Error(`配置 "${configKey}" 验证失败:\n${errors}`);
    }

    return result.data;
  };
}

/**
 * 创建简单配置加载器（仅从环境变量读取，不读取配置文件）
 * 适用于 CI 等纯环境变量配置
 */
export function createEnvConfigLoader<T extends z.ZodObject<z.ZodRawShape>>(
  options: Omit<ConfigLoaderOptions<T>, "description"> & { description?: string },
) {
  const { configKey, schemaFactory, description } = options;

  return (): z.infer<T> => {
    const schema = schemaFactory();
    // 注册 schema（如果有描述）
    if (description) {
      registerPluginSchema({
        configKey,
        schemaFactory: () => schema,
        description,
      });
    }
    // 直接使用空对象，让 schema 的 default 值生效
    const result = schema.safeParse({});

    if (!result.success) {
      const errors = result.error.issues
        .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
        .join("\n");
      throw new Error(`配置 "${configKey}" 验证失败:\n${errors}`);
    }

    return result.data;
  };
}
