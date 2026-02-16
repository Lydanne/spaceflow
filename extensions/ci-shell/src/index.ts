import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";

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
        ctx.output.info(`DRY-RUN mode: ${options.dryRun ? "enabled" : "disabled"}`);
        ctx.output.info("ci-shell 命令暂未实现");
        // TODO: 实现 ci-shell 命令逻辑
      },
    },
  ],
});

export default extension;
