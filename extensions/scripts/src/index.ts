import "./locales";
import { defineExtension, t } from "@spaceflow/core";
import type { GitProviderService } from "@spaceflow/core";
import { ScriptsService } from "./scripts.service";

export const extension = defineExtension({
  name: "scripts",
  version: "1.0.0",
  description: t("scripts:extensionDescription"),
  configKey: "scripts",
  commands: [
    {
      name: "script",
      description: t("scripts:description"),
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
          ctx.output.error(t("scripts:noScript"));
          process.exit(1);
        }

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        if (!gitProvider) {
          ctx.output.error("script 命令需要配置 Git Provider");
          process.exit(1);
        }

        const scriptsService = new ScriptsService(gitProvider, ctx.config);
        const context = scriptsService.getContextFromEnv({
          dryRun: !!options?.dryRun,
        });
        await scriptsService.execute(context, script);
      },
    },
  ],
});

export default extension;
