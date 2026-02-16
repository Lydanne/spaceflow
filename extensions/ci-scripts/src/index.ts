import "./locales";
import { defineExtension, t } from "@spaceflow/core";
import type { GitProviderService } from "@spaceflow/core";
import { CiScriptsService } from "./ci-scripts.service";

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

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        if (!gitProvider) {
          ctx.output.error("ci-script 命令需要配置 Git Provider");
          process.exit(1);
        }

        const ciScriptsService = new CiScriptsService(gitProvider, ctx.config);
        const context = ciScriptsService.getContextFromEnv({
          dryRun: !!options?.dryRun,
        });
        await ciScriptsService.execute(context, script);
      },
    },
  ],
});

export default extension;
