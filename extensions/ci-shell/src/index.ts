import "./locales";
import { defineExtension, t } from "@spaceflow/core";
import type { GitProviderService } from "@spaceflow/core";
import { CiShellService } from "./ci-shell.service";

export const extension = defineExtension({
  name: "ci-shell",
  version: "1.0.0",
  description: t("ci-shell:extensionDescription"),
  configKey: "ci-shell",
  commands: [
    {
      name: "ci-shell",
      description: t("ci-shell:description"),
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
          ctx.output.error(t("ci-shell:noCommand"));
          process.exit(1);
        }

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        if (!gitProvider) {
          ctx.output.error("ci-shell 命令需要配置 Git Provider");
          process.exit(1);
        }

        const ciShellService = new CiShellService(gitProvider, ctx.config);
        const context = ciShellService.getContextFromEnv({
          dryRun: !!options?.dryRun,
        });
        await ciShellService.execute(context, command);
      },
    },
  ],
});

export default extension;
