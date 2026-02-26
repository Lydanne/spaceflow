import "./locales";
import { defineExtension, t } from "@spaceflow/core";
import type { GitProviderService } from "@spaceflow/core";
import { publishSchema } from "./publish.config";
import { PublishService } from "./publish.service";
import { MonorepoService } from "./monorepo.service";

export const extension = defineExtension({
  name: "publish",
  version: "1.0.0",
  description: t("publish:extensionDescription"),
  configKey: "publish",
  configSchema: () => publishSchema,
  commands: [
    {
      name: "publish",
      description: t("publish:description"),
      options: [
        { flags: "-d, --dry-run", description: t("common.options.dryRun") },
        { flags: "-c, --ci", description: t("common.options.ci") },
        { flags: "-p, --prerelease <tag>", description: t("publish:options.prerelease") },
        { flags: "-r, --rehearsal", description: t("publish:options.rehearsal") },
      ],
      run: async (_args, options, ctx) => {
        const gitProvider = ctx.getService<GitProviderService>("gitProvider");

        if (!gitProvider) {
          ctx.output.error("publish 命令需要配置 Git Provider");
          process.exit(1);
        }

        const monorepoService = new MonorepoService();
        const publishService = new PublishService(gitProvider, ctx.config, monorepoService);

        const publishOptions = {
          dryRun: !!options?.dryRun,
          ci: !!options?.ci,
          prerelease: options?.prerelease as string,
          rehearsal: !!options?.rehearsal,
        };

        if (publishOptions.rehearsal) {
          console.log(t("publish:rehearsalMode"));
        } else if (publishOptions.dryRun) {
          console.log(t("publish:dryRunMode"));
        }

        try {
          const context = publishService.getContextFromEnv(publishOptions);
          await publishService.execute(context);
        } catch (error) {
          ctx.output.error(
            t("common.executionFailed", { error: error instanceof Error ? error.message : error }),
          );
          process.exit(1);
        }
      },
    },
  ],
});

export default extension;
