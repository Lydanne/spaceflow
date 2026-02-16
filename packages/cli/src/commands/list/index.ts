import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { ListService } from "./list.service";
import type { ExtensionLoader } from "../../extension-loader";

/**
 * List 命令扩展
 */
export const listExtension = defineExtension({
  name: "list",
  version: "1.0.0",
  description: "列出已安装的 Extension",
  commands: [
    {
      name: "list",
      description: "列出已安装的 Extension",
      aliases: ["ls"],
      options: [
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, ctx) => {
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const extensionLoader = ctx.getService<ExtensionLoader>("extensionLoader");
        const listService = new ListService(extensionLoader);
        await listService.execute(verbose);
      },
    },
  ],
});

export * from "./list.service";
