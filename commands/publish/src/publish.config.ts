import { z } from "@spaceflow/core";

/** publish 命令配置 schema */
export const publishSchema = z.object({
  /** monorepo 发布模式配置 */
  monorepo: z
    .object({
      /** 是否启用 monorepo 发布模式 */
      enabled: z.boolean().default(false),
      /** 是否传递依赖变更（依赖的包变更时，依赖方也发布） */
      propagateDeps: z.boolean().default(true),
    })
    .optional(),
  changelog: z
    .object({
      /** changelog 文件输出目录 */
      infileDir: z.string().default(".").optional(),
      preset: z
        .object({
          /** preset 名称，默认 conventionalcommits */
          name: z.string().default("conventionalcommits").optional(),
          /** commit type 到 section 的映射 */
          type: z
            .array(
              z.object({
                type: z.string(),
                section: z.string(),
              }),
            )
            .default([]),
        })
        .optional(),
    })
    .optional(),
  /** npm 发布配置 */
  npm: z
    .object({
      /** 是否发布到 npm registry */
      publish: z.boolean().default(false),
      /** 包管理器，npm 或 pnpm */
      packageManager: z.enum(["npm", "pnpm"]).default("npm"),
      /** npm registry 地址 */
      registry: z.string().optional(),
      /** npm tag，如 latest、beta、next */
      tag: z.string().default("latest"),
      /** 是否忽略 package.json 中的版本号 */
      ignoreVersion: z.boolean().default(true),
      /** npm version 命令额外参数 */
      versionArgs: z.array(z.string()).default(["--workspaces false"]),
      /** npm/pnpm publish 命令额外参数 */
      publishArgs: z.array(z.string()).default([]),
    })
    .optional(),
  release: z
    .object({
      host: z.string().default("localhost"),
      assetSourcemap: z
        .object({
          path: z.string(),
          name: z.string(),
        })
        .optional(),
      assets: z
        .array(
          z.object({
            path: z.string(),
            name: z.string(),
            type: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),
  /** git 配置 */
  git: z
    .object({
      /** 允许发布的分支列表 */
      requireBranch: z.array(z.string()).default(["main", "dev", "develop"]),
      /** 分支锁定时允许推送的用户名白名单（如 CI 机器人） */
      pushWhitelistUsernames: z.array(z.string()).default([]),
      /** 是否在发布时锁定分支 */
      lockBranch: z.boolean().default(true),
    })
    .optional(),
  /** release-it hooks 配置，如 before:bump, after:bump 等 */
  hooks: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
});

/** publish 配置类型（从 schema 推导） */
export type PublishConfig = z.infer<typeof publishSchema>;
