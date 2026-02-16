import { defineExtension, SchemaGeneratorService, type VerboseLevel } from "@spaceflow/core";
import { InstallService } from "./install.service";

/**
 * Install 命令扩展
 */
export const installExtension = defineExtension({
  name: "install",
  version: "1.0.0",
  description: "安装 Extension",
  commands: [
    {
      name: "install",
      description: "安装 Extension",
      aliases: ["i"],
      arguments: "<source>",
      options: [
        {
          flags: "-n, --name <name>",
          description: "指定安装名称",
        },
        {
          flags: "-r, --ref <ref>",
          description: "指定版本/分支/tag",
        },
        {
          flags: "-g, --global",
          description: "全局安装",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, ctx) => {
        const source = args[0];
        if (!source) {
          ctx.output.error("请指定要安装的包名或 Git URL");
          process.exit(1);
        }
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const schemaGenerator = new SchemaGeneratorService();
        const installService = new InstallService(schemaGenerator);
        const installOptions = {
          source,
          name: options?.name as string,
          ref: options?.ref as string,
        };
        if (options?.global) {
          await installService.installGlobal(installOptions, verbose);
        } else {
          const context = installService.getContext(installOptions);
          await installService.execute(context, verbose);
        }
      },
    },
  ],
});

export * from "./install.service";
