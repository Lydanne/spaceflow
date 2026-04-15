import "./locales";
export * from "./review-spec";
export * from "./review-report";
export { PullRequestModel } from "./pull-request-model";
export { ReviewResultModel } from "./review-result-model";
export type { ReviewResultModelDeps, ReviewResultSaveOptions } from "./review-result-model";
import { defineExtension, t } from "@spaceflow/core";
import type {
  GitProviderService,
  LlmProxyService,
  GitSdkService,
  LLMMode,
  LocalReviewMode,
} from "@spaceflow/core";
import { parseVerbose } from "@spaceflow/core";
import { reviewSchema, type AnalyzeDeletionsMode, type ReviewConfig } from "./review.config";
import { ReviewService } from "./review.service";
import { ReviewSpecService } from "./review-spec";
import { ReviewReportService, type ReportFormat } from "./review-report";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { tools } from "./mcp";

export const extension = defineExtension({
  name: "review",
  version: "1.0.0",
  description: t("review:extensionDescription"),
  configKey: "review",
  configSchema: reviewSchema,
  tools,
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
        { flags: "--llm-model <model>", description: t("review:options.llmModel") },
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
        { flags: "--flush", description: t("review:options.flush") },
        { flags: "--event-action <action>", description: t("review:options.eventAction") },
        { flags: "--local [mode]", description: t("review:options.local") },
        { flags: "--no-local", description: t("review:options.noLocal") },
        { flags: "--fail-on-issues [mode]", description: t("review:options.failOnIssues") },
      ],
      run: async (_args, options, ctx) => {
        const isFlush = !!options?.flush;
        if (!ctx.hasService("gitProvider")) {
          ctx.output.error(
            "review 命令需要配置 Git Provider，请在 spaceflow.json 中配置 gitProvider 字段",
          );
          process.exit(1);
        }
        if (!isFlush && !ctx.hasService("llmProxy")) {
          ctx.output.error("review 命令需要配置 LLM 服务，请在 spaceflow.json 中配置 llm 字段");
          process.exit(1);
        }

        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        const llmProxy = ctx.hasService("llmProxy")
          ? ctx.getService<LlmProxyService>("llmProxy")
          : (undefined as unknown as LlmProxyService);
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
          llmModel: options?.llmModel as string | undefined,
          files: options?.files as string[],
          commits: options?.commits as string[],
          verifyFixes: options?.verifyFixes as boolean,
          analyzeDeletions: options?.analyzeDeletions as AnalyzeDeletionsMode,
          deletionAnalysisMode: options?.deletionAnalysisMode as LLMMode,
          deletionOnly: !!options?.deletionOnly,
          outputFormat: options?.outputFormat as ReportFormat,
          generateDescription: options?.generateDescription ? true : undefined,
          showAll: !!options?.showAll,
          flush: isFlush,
          eventAction: options?.eventAction as string,
          local: parseLocalOption(options?.local),
          failOnIssues: parseFailOnIssues(options?.failOnIssues),
        };

        function parseFailOnIssues(
          value: unknown,
        ): "off" | "warn" | "error" | "warn+error" | undefined {
          if (value === true || value === "") return "error";
          if (value === "warn" || value === "error" || value === "off" || value === "warn+error")
            return value;
          return undefined;
        }

        function parseLocalOption(value: unknown): LocalReviewMode | undefined {
          if (value === false) return false;
          if (value === true || value === undefined || value === "") return undefined;
          if (value === "staged" || value === "uncommitted") return value;
          return undefined;
        }

        try {
          const context = await reviewService.getContextFromEnv(reviewOptions);
          const result = await reviewService.execute(context);
          const effectiveFailOnIssues: "off" | "warn" | "error" | "warn+error" =
            reviewOptions.failOnIssues ??
            ctx.config.getPluginConfig<ReviewConfig>("review")?.failOnIssues ??
            "off";
          if (effectiveFailOnIssues !== "off") {
            const blockers = result.issues.filter((issue) => {
              if (issue.fixed || issue.resolved || issue.valid === "false") return false;
              if (effectiveFailOnIssues === "warn") return issue.severity === "warn";
              if (effectiveFailOnIssues === "error") return issue.severity === "error";
              return issue.severity === "error" || issue.severity === "warn"; // warn+error
            });
            if (blockers.length > 0) {
              ctx.output.error(
                `审核不通过：存在 ${blockers.length} 个未解决的问题（模式: ${effectiveFailOnIssues}）`,
              );
              process.exit(1);
            }
          }
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
