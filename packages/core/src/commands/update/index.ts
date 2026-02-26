import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { UpdateService } from "./update.service";

/**
 * Update 命令扩展
 */
export const updateExtension = defineExtension({
  name: "update",
  version: "1.0.0",
  description: "更新 Extension",
  commands: [
    {
      name: "update",
      description: "更新 Extension",
      arguments: "[name]",
      options: [
        {
          flags: "-a, --all",
          description: "更新所有扩展",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, _ctx) => {
        const name = args[0];
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const updateService = new UpdateService();
        if (options?.all) {
          await updateService.updateAll(verbose);
        } else if (name) {
          await updateService.updateDependency(name, verbose);
        } else {
          await updateService.updateSelf(verbose);
        }
      },
    },
  ],
});

export * from "./update.service";
