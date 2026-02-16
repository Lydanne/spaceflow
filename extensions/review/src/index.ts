import "./locales";
import { defineExtension, t } from "@spaceflow/core";
import type {
  GitProviderService,
  ConfigReaderService,
  LlmProxyService,
  GitSdkService,
  LLMMode,
} from "@spaceflow/core";
import { parseVerbose } from "@spaceflow/core";
import { reviewSchema, type AnalyzeDeletionsMode } from "./review.config";
import { ReviewService } from "./review.service";
import { ReviewSpecService } from "./review-spec";
import { ReviewReportService, type ReportFormat } from "./review-report";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { reviewMcpServer } from "./mcp";

export const extension = defineExtension({
  name: "review",
  version: "1.0.0",
  description: t("review:extensionDescription"),
  configKey: "review",
  configSchema: reviewSchema,
  mcp: reviewMcpServer,
  commands: [
    {
      name: "review",
      description: t("review:description"),
      options: [
        { flags: "-d, --dry-run", description: t("review:options.dryRun") },
        { flags: "-c, --ci", description: t("common.options.ci") },
        { flags: "-p, --pr-number <number>", description: t("review:options.prNumber") },
        { flags: "-b, --base <ref>", description: t("review:options.base") },
        { flags: "--head <ref>", description: t("review:options.head") },
        { flags: "-i, --includes <patterns...>", description: t("review:options.includes") },
        { flags: "-l, --llm-mode <mode>", description: t("review:options.llmMode") },
        { flags: "-f, --files <files...>", description: t("review:options.files") },
        { flags: "--commits <commits...>", description: t("review:options.commits") },
        { flags: "--verify-fixes", description: t("review:options.verifyFixes") },
        { flags: "--no-verify-fixes", description: t("review:options.noVerifyFixes") },
        { flags: "--analyze-deletions [mode]", description: t("review:options.analyzeDeletions") },
        {
          flags: "--deletion-analysis-mode <mode>",
          description: t("review:options.deletionAnalysisMode"),
        },
        { flags: "--deletion-only", description: t("review:options.deletionOnly") },
        { flags: "-o, --output-format <format>", description: t("review:options.outputFormat") },
        { flags: "--generate-description", description: t("review:options.generateDescription") },
        { flags: "--show-all", description: t("review:options.showAll") },
        { flags: "--event-action <action>", description: t("review:options.eventAction") },
      ],
      run: async (_args, options, ctx) => {
        if (!ctx.hasService("gitProvider")) {
          ctx.output.error(
            "review 命令需要配置 Git Provider，请在 spaceflow.json 中配置 gitProvider 字段",
          );
          process.exit(1);
        }
        if (!ctx.hasService("llmProxy")) {
          ctx.output.error("review 命令需要配置 LLM 服务，请在 spaceflow.json 中配置 llm 字段");
          process.exit(1);
        }

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        const configReader = ctx.getService<ConfigReaderService>("config");
        const llmProxy = ctx.getService<LlmProxyService>("llmProxy");
        const gitSdk = ctx.hasService("gitSdk")
          ? ctx.getService<GitSdkService>("gitSdk")
          : undefined;

        const reviewSpecService = new ReviewSpecService(gitProvider);
        const reviewReportService = new ReviewReportService();
        const issueVerifyService = new IssueVerifyService(llmProxy, reviewSpecService);
        const deletionImpactService = new DeletionImpactService(llmProxy, gitProvider);

        const reviewService = new ReviewService(
          gitProvider,
          ctx.config,
          configReader,
          reviewSpecService,
          llmProxy,
          reviewReportService,
          issueVerifyService,
          deletionImpactService,
          gitSdk!,
        );

        const reviewOptions = {
          dryRun: !!options?.dryRun,
          ci: !!options?.ci,
          prNumber: options?.prNumber ? parseInt(options.prNumber as string, 10) : undefined,
          base: options?.base as string,
          head: options?.head as string,
          verbose: parseVerbose(options?.verbose as string | boolean | undefined),
          includes: options?.includes as string[],
          llmMode: options?.llmMode as LLMMode,
          files: options?.files as string[],
          commits: options?.commits as string[],
          verifyFixes: options?.verifyFixes as boolean,
          analyzeDeletions: options?.analyzeDeletions as AnalyzeDeletionsMode,
          deletionAnalysisMode: options?.deletionAnalysisMode as LLMMode,
          deletionOnly: !!options?.deletionOnly,
          outputFormat: options?.outputFormat as ReportFormat,
          generateDescription: !!options?.generateDescription,
          showAll: !!options?.showAll,
          eventAction: options?.eventAction as string,
        };

        try {
          const context = await reviewService.getContextFromEnv(reviewOptions);
          await reviewService.execute(context);
        } catch (error) {
          if (error instanceof Error) {
            ctx.output.error(t("common.executionFailed", { error: error.message }));
          } else {
            ctx.output.error(t("common.executionFailed", { error: String(error) }));
          }
          process.exit(1);
        }
      },
    },
  ],
});

export default extension;
