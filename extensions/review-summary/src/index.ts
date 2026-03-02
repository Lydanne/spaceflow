import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";
import type { GitProviderService } from "@spaceflow/core";
import { parseVerbose } from "@spaceflow/core";
import { PeriodSummaryService } from "./review-summary.service";
import type { PeriodSummaryOptions, TimePreset, OutputTarget } from "./types";

export const extension = defineExtension({
  name: "review-summary",
  version: "1.0.0",
  description: t("review-summary:extensionDescription"),
  configKey: "review-summary",
  commands: [
    {
      name: "review-summary",
      description: t("review-summary:description"),
      options: [
        {
          flags: "-p, --preset <preset>",
          description: t("review-summary:options.preset"),
        },
        {
          flags: "-s, --since <date>",
          description: t("review-summary:options.since"),
        },
        {
          flags: "-u, --until <date>",
          description: t("review-summary:options.until"),
        },
        {
          flags: "-r, --repository <repo>",
          description: t("review-summary:options.repository"),
        },
        {
          flags: "-f, --format <format>",
          description: t("review-summary:options.format"),
        },
        {
          flags: "-o, --output <target>",
          description: t("review-summary:options.output"),
        },
        {
          flags: "--output-file <path>",
          description: t("review-summary:options.outputFile"),
        },
        {
          flags: "-c, --ci",
          description: t("common.options.ci"),
        },
        {
          flags: "-v, --verbose",
          description: t("review-summary:options.verbose"),
          isCount: true,
        },
      ],
      run: async (_args, options, ctx) => {
        if (!ctx.hasService("gitProvider")) {
          ctx.output.error(
            "review-summary 命令需要配置 Git Provider，请在 spaceflow.json 中配置 gitProvider 字段",
          );
          process.exit(1);
        }

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        const service = new PeriodSummaryService(gitProvider, ctx.config);

        const summaryOptions: PeriodSummaryOptions = {
          preset: options?.preset as TimePreset,
          since: options?.since as string,
          until: options?.until as string,
          repository: options?.repository as string,
          format: options?.format as "table" | "json" | "markdown",
          output: options?.output as OutputTarget,
          outputFile: options?.outputFile as string,
          ci: !!options?.ci,
          verbose: parseVerbose(options?.verbose as string | boolean | undefined),
        };

        try {
          const context = service.getContextFromOptions(summaryOptions);
          const result = await service.execute(context);
          const report = await service.outputReport(context, result);
          if (report.location) {
            ctx.output.success(t("review-summary:reportOutput", { location: report.location }));
          }
        } catch (error) {
          if (error instanceof Error) {
            ctx.output.error(error.message);
          } else {
            ctx.output.error(String(error));
          }
          process.exit(1);
        }
      },
    },
  ],
});

export default extension;
