import { defineExtension, type LlmProxyService } from "@spaceflow/core";
import { CommitService } from "./commit.service";
import { CommitScopeConfigSchema } from "./commit.config";

/**
 * Commit 命令扩展
 */
export const commitExtension = defineExtension({
  name: "commit",
  version: "1.0.0",
  description: "提交代码",
  configKey: "commit",
  configSchema: () => CommitScopeConfigSchema,
  commands: [
    {
      name: "commit",
      description: "AI 辅助生成 commit message",
      options: [
        {
          flags: "-m, --message <message>",
          description: "直接使用指定的提交信息",
        },
        {
          flags: "-s, --split",
          description: "自动拆分提交",
        },
        {
          flags: "--dry-run",
          description: "仅生成 message，不执行提交",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (_args, options, ctx) => {
        const configReader = ctx.config;
        const llmProxy = ctx.getService<LlmProxyService>("llmProxy");
        if (!llmProxy) {
          ctx.output.error("commit 命令需要配置 LLM 服务，请在 spaceflow.json 中配置 llm 字段");
          process.exit(1);
        }
        const commitService = new CommitService(configReader, llmProxy);
        const verbose = options?.verbose ? 2 : 1;
        if (options?.message) {
          await commitService.commit(options.message as string, { verbose });
        } else if (options?.split) {
          await commitService.commitInBatches({ verbose, dryRun: !!options?.dryRun });
        } else {
          await commitService.generateAndCommit({ verbose, dryRun: !!options?.dryRun });
        }
      },
    },
  ],
});

export * from "./commit.config";
export * from "./commit.service";
