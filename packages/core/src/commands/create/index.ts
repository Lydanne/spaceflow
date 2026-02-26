import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { CreateService } from "./create.service";

/**
 * Create 命令扩展
 */
export const createExtension = defineExtension({
  name: "create",
  version: "1.0.0",
  description: "创建 Extension",
  commands: [
    {
      name: "create",
      description: "创建 Extension",
      arguments: "<name>",
      options: [
        {
          flags: "-t, --template <template>",
          description: "模板类型 (command, mcp, skills)",
          default: "command",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, ctx) => {
        const name = args[0];
        if (!name) {
          ctx.output.error("请指定扩展名称");
          process.exit(1);
        }
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const createService = new CreateService();
        const template = (options?.template as string) || "command";
        await createService.createFromTemplate(template, name, {}, verbose);
      },
    },
  ],
});

export * from "./create.service";
