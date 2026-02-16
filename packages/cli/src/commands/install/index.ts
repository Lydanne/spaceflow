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
      description: "安装 Extension（无参数时安装配置文件中的所有依赖）",
      aliases: ["i"],
      arguments: "[source]",
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
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const schemaGenerator = new SchemaGeneratorService();
        const installService = new InstallService(schemaGenerator);
        // 无参数时，安装配置文件中的所有依赖
        if (!source) {
          if (options?.global) {
            ctx.output.error("全局安装需要指定 source 参数");
            process.exit(1);
          }
          await installService.updateAllExtensions({ verbose });
          return;
        }
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
