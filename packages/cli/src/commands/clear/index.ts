import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { ClearService } from "./clear.service";

/**
 * Clear 命令扩展
 */
export const clearExtension = defineExtension({
  name: "clear",
  version: "1.0.0",
  description: "清除缓存",
  commands: [
    {
      name: "clear",
      description: "清除缓存",
      options: [
        {
          flags: "-g, --global",
          description: "清除全局缓存",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, _ctx) => {
        const isGlobal = !!options?.global;
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const clearService = new ClearService();
        await clearService.execute(isGlobal, verbose);
      },
    },
  ],
});

export * from "./clear.service";
