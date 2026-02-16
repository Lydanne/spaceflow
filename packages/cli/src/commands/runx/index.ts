import { defineExtension, SchemaGeneratorService, type VerboseLevel } from "@spaceflow/core";
import { RunxService } from "./runx.service";
import { InstallService } from "../install/install.service";

/**
 * Runx 命令扩展
 */
export const runxExtension = defineExtension({
  name: "runx",
  version: "1.0.0",
  description: "运行 x 命令",
  commands: [
    {
      name: "runx",
      description: "全局安装并运行扩展命令",
      aliases: ["x"],
      arguments: "<source> [args...]",
      options: [
        {
          flags: "-n, --name <name>",
          description: "指定安装名称",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, _ctx) => {
        const source = args[0];
        const cmdArgs = args.slice(1);
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const schemaGenerator = new SchemaGeneratorService();
        const installService = new InstallService(schemaGenerator);
        const runxService = new RunxService(installService);
        await runxService.execute({
          source,
          name: options?.name as string,
          args: cmdArgs,
          verbose,
        });
      },
    },
  ],
});

export * from "./runx.service";
export * from "./runx.utils";
