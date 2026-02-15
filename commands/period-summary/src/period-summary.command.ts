import { Command, CommandRunner, Option } from "nest-commander";
import { t, normalizeVerbose } from "@spaceflow/core";
import { PeriodSummaryService } from "./period-summary.service";
import type { PeriodSummaryOptions, OutputTarget, TimePreset } from "./types";
import type { VerboseLevel } from "@spaceflow/core";

/**
 * 周期统计命令
 *
 * 根据时间范围统计 PR 贡献情况，按人员汇总并排序
 *
 * 环境变量：
 * - GITHUB_TOKEN: GitHub API Token
 * - GITHUB_REPOSITORY: 仓库名称 (owner/repo 格式)
 */
@Command({
  name: "period-summary",
  description: t("period-summary:description"),
})
export class PeriodSummaryCommand extends CommandRunner {
  constructor(protected readonly periodSummaryService: PeriodSummaryService) {
    super();
  }

  async run(_passedParams: string[], options: PeriodSummaryOptions): Promise<void> {
    try {
      const context = this.periodSummaryService.getContextFromOptions(options);
      const result = await this.periodSummaryService.execute(context);
      const outputResult = await this.periodSummaryService.outputReport(context, result);
      if (outputResult.type !== "console" && outputResult.location) {
        console.log(t("period-summary:reportOutput", { location: outputResult.location }));
      }
    } catch (error) {
      console.error(
        t("common.executionFailed", { error: error instanceof Error ? error.message : error }),
      );
      process.exit(1);
    }
  }

  @Option({
    flags: "-p, --preset <preset>",
    description: t("period-summary:options.preset"),
    choices: [
      "this-week",
      "last-week",
      "this-month",
      "last-month",
      "last-7-days",
      "last-15-days",
      "last-30-days",
    ],
  })
  parsePreset(val: string): TimePreset {
    return val as TimePreset;
  }

  @Option({
    flags: "-s, --since <date>",
    description: t("period-summary:options.since"),
  })
  parseSince(val: string): string {
    return val;
  }

  @Option({
    flags: "-u, --until <date>",
    description: t("period-summary:options.until"),
  })
  parseUntil(val: string): string {
    return val;
  }

  @Option({
    flags: "-r, --repository <repo>",
    description: t("period-summary:options.repository"),
  })
  parseRepository(val: string): string {
    return val;
  }

  @Option({
    flags: "-c, --ci",
    description: t("common.options.ci"),
  })
  parseCi(val: boolean): boolean {
    return val;
  }

  @Option({
    flags: "-f, --format <format>",
    description: t("period-summary:options.format"),
    choices: ["table", "json", "markdown"],
  })
  parseFormat(val: string): "table" | "json" | "markdown" {
    return val as "table" | "json" | "markdown";
  }

  @Option({
    flags: "-o, --output <target>",
    description: t("period-summary:options.output"),
    choices: ["console", "issue", "file"],
    defaultValue: "console",
  })
  parseOutput(val: string): OutputTarget {
    return val as OutputTarget;
  }

  @Option({
    flags: "--output-file <path>",
    description: t("period-summary:options.outputFile"),
  })
  parseOutputFile(val: string): string {
    return val;
  }

  @Option({
    flags: "-v, --verbose [level]",
    description: t("period-summary:options.verbose"),
  })
  parseVerbose(val: string | boolean): VerboseLevel {
    if (val === true || val === "") {
      return 1;
    }
    const level = parseInt(val as string, 10);
    return normalizeVerbose(level as VerboseLevel);
  }
}
