import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { BuildService } from "../build/build.service";

/**
 * Dev 命令扩展
 */
export const devExtension = defineExtension({
  name: "dev",
  version: "1.0.0",
  description: "开发模式运行 Extension",
  commands: [
    {
      name: "dev",
      description: "开发模式（监听构建）",
      arguments: "[extension]",
      options: [
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, _ctx) => {
        const extensionName = args[0];
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const buildService = new BuildService();
        await buildService.watch(extensionName, verbose);
      },
    },
  ],
});
