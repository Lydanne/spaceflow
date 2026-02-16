import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";

export const extension = defineExtension({
  name: "ci-scripts",
  version: "1.0.0",
  description: t("ci-scripts:extensionDescription"),
  configKey: "ci-scripts",
  commands: [
    {
      name: "ci-script",
      description: t("ci-scripts:description"),
      arguments: "<script>",
      options: [
        {
          flags: "-d, --dry-run",
          description: t("common.options.dryRun"),
        },
      ],
      run: async (args, options, ctx) => {
        const script = args[0];
        if (!script) {
          ctx.output.error(t("ci-scripts:noScript"));
          process.exit(1);
        }
        ctx.output.info(`DRY-RUN mode: ${options.dryRun ? "enabled" : "disabled"}`);
        ctx.output.info("ci-script 命令暂未实现");
        // TODO: 实现 ci-script 命令逻辑
      },
    },
  ],
});

export default extension;
