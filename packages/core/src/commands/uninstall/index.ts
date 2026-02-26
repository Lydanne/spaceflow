import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { UninstallService } from "./uninstall.service";

/**
 * Uninstall 命令扩展
 */
export const uninstallExtension = defineExtension({
  name: "uninstall",
  version: "1.0.0",
  description: "卸载 Extension",
  commands: [
    {
      name: "uninstall",
      description: "卸载 Extension",
      aliases: ["un"],
      arguments: "<name>",
      options: [
        {
          flags: "-g, --global",
          description: "全局卸载",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, ctx) => {
        const name = args[0];
        if (!name) {
          ctx.output.error("请指定要卸载的扩展名称");
          process.exit(1);
        }
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const isGlobal = !!options?.global;
        const uninstallService = new UninstallService();
        await uninstallService.execute(name, isGlobal, verbose);
      },
    },
  ],
});

export * from "./uninstall.service";
