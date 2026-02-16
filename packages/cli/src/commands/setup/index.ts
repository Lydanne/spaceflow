import { defineExtension, SchemaGeneratorService } from "@spaceflow/core";
import { SetupService } from "./setup.service";

/**
 * Setup 命令扩展
 */
export const setupExtension = defineExtension({
  name: "setup",
  version: "1.0.0",
  description: "设置配置",
  commands: [
    {
      name: "setup",
      description: "设置配置",
      options: [
        {
          flags: "-g, --global",
          description: "全局设置",
        },
      ],
      run: async (_args, options, _ctx) => {
        const schemaGenerator = new SchemaGeneratorService();
        const setupService = new SetupService(schemaGenerator);
        if (options?.global) {
          await setupService.setupGlobal();
        } else {
          await setupService.setupLocal();
        }
      },
    },
  ],
});

export * from "./setup.service";
