import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { BuildService } from "./build.service";

/**
 * Build 命令扩展
 */
export const buildExtension = defineExtension({
  name: "build",
  version: "1.0.0",
  description: "构建 Extension 插件包",
  commands: [
    {
      name: "build",
      description: "构建指定或所有 Extension",
      arguments: "[extension]",
      options: [
        {
          flags: "-w, --watch",
          description: "监听模式",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, ctx) => {
        const extensionName = args[0];
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const buildService = new BuildService();
        try {
          if (options?.watch) {
            await buildService.watch(extensionName, verbose);
          } else {
            const results = await buildService.build(extensionName, verbose);
            const hasErrors = results.some((r) => !r.success);
            if (hasErrors) {
              process.exit(1);
            }
          }
        } catch (error) {
          ctx.output.error(`构建失败: ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
      },
    },
  ],
});

export * from "./build.service";
