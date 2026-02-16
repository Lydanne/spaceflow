import "./locales";
import { defineExtension, t } from "@spaceflow/core";
import type { GitProviderService } from "@spaceflow/core";
import { ShellService } from "./shell.service";

export const extension = defineExtension({
  name: "shell",
  version: "1.0.0",
  description: t("shell:extensionDescription"),
  configKey: "shell",
  commands: [
    {
      name: "shell",
      description: t("shell:description"),
      arguments: "<command>",
      options: [
        {
          flags: "-d, --dry-run",
          description: t("common.options.dryRun"),
        },
      ],
      run: async (args, options, ctx) => {
        const command = args[0];
        if (!command) {
          ctx.output.error(t("shell:noCommand"));
          process.exit(1);
        }

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        if (!gitProvider) {
          ctx.output.error("shell 命令需要配置 Git Provider");
          process.exit(1);
        }

        const shellService = new ShellService(gitProvider, ctx.config);
        const context = shellService.getContextFromEnv({
          dryRun: !!options?.dryRun,
        });
        await shellService.execute(context, command);
      },
    },
  ],
});

export default extension;
