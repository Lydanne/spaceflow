import { Command, CommandRunner, Option, t } from "@spaceflow/core";
import type { LLMMode, VerboseLevel } from "@spaceflow/core";
import type { AnalyzeDeletionsMode } from "./review.config";
import type { ReportFormat } from "./review-report";
import { ReviewService } from "./review.service";

export interface ReviewOptions {
  dryRun: boolean;
  ci: boolean;
  prNumber?: number;
  base?: string;
  head?: string;
  references?: string[];
  verbose?: VerboseLevel;
  includes?: string[];
  llmMode?: LLMMode;
  files?: string[];
  commits?: string[];
  verifyFixes?: boolean;
  verifyConcurrency?: number;
  analyzeDeletions?: AnalyzeDeletionsMode;
  /** 仅执行删除代码分析，跳过常规代码审查 */
  deletionOnly?: boolean;
  /** 删除代码分析模式：openai 使用标准模式，claude-agent 使用 Agent 模式 */
  deletionAnalysisMode?: LLMMode;
  /** 输出格式：markdown, terminal, json。不指定则智能选择 */
  outputFormat?: ReportFormat;
  /** 是否使用 AI 生成 PR 功能描述 */
  generateDescription?: boolean;
  /** 显示所有问题，不过滤非变更行的问题 */
  showAll?: boolean;
  /** PR 事件类型（opened, synchronize, closed 等） */
  eventAction?: string;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Review 命令
 *
 * 在 GitHub Actions 中执行，用于自动代码审查
 *
 * 环境变量：
 * - GITHUB_TOKEN: GitHub API Token
 * - GITHUB_REPOSITORY: 仓库名称 (owner/repo 格式)
 * - GITHUB_REF_NAME: 当前分支名称
 * - GITHUB_EVENT_PATH: 事件文件路径（包含 PR 信息）
 */
@Command({
  name: "review",
  description: t("review:description"),
})
export class ReviewCommand extends CommandRunner {
  constructor(protected readonly reviewService: ReviewService) {
    super();
  }

  async run(_passedParams: string[], options: ReviewOptions): Promise<void> {
    try {
      const context = await this.reviewService.getContextFromEnv(options);
      await this.reviewService.execute(context);
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("common.executionFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("common.executionFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-d, --dry-run",
    description: t("review:options.dryRun"),
  })
  parseDryRun(val: boolean): boolean {
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
    flags: "-p, --pr-number <number>",
    description: t("review:options.prNumber"),
  })
  parsePrNumber(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: "-b, --base <ref>",
    description: t("review:options.base"),
  })
  parseBase(val: string): string {
    return val;
  }

  @Option({
    flags: "--head <ref>",
    description: t("review:options.head"),
  })
  parseHead(val: string): string {
    return val;
  }

  @Option({
    flags: "-v, --verbose",
    description: t("common.options.verboseDebug"),
  })
  parseVerbose(_val: string, previous: VerboseLevel = 0): VerboseLevel {
    const current = typeof previous === "number" ? previous : previous ? 1 : 0;
    return Math.min(current + 1, 3) as VerboseLevel;
  }

  @Option({
    flags: "-i, --includes <patterns...>",
    description: t("review:options.includes"),
  })
  parseIncludes(val: string, previous: string[] = []): string[] {
    return [...previous, val];
  }

  @Option({
    flags: "-l, --llm-mode <mode>",
    description: t("review:options.llmMode"),
    choices: ["claude-code", "openai", "gemini"],
  })
  parseLlmMode(val: string): LLMMode {
    return val as LLMMode;
  }

  @Option({
    flags: "-f, --files <files...>",
    description: t("review:options.files"),
  })
  parseFiles(val: string, previous: string[] = []): string[] {
    return [...previous, val];
  }

  @Option({
    flags: "--commits <commits...>",
    description: t("review:options.commits"),
  })
  parseCommits(val: string, previous: string[] = []): string[] {
    return [...previous, val];
  }

  @Option({
    flags: "--verify-fixes",
    description: t("review:options.verifyFixes"),
  })
  parseVerifyFixes(val: boolean): boolean {
    return val;
  }

  @Option({
    flags: "--no-verify-fixes",
    description: t("review:options.noVerifyFixes"),
  })
  parseNoVerifyFixes(val: boolean): boolean {
    return !val;
  }

  @Option({
    flags: "--verify-concurrency <number>",
    description: t("review:options.verifyConcurrency"),
  })
  parseVerifyConcurrency(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: "--analyze-deletions [mode]",
    description: t("review:options.analyzeDeletions"),
  })
  parseAnalyzeDeletions(val: string | boolean): AnalyzeDeletionsMode {
    if (val === true || val === "true") return true;
    if (val === false || val === "false") return false;
    if (val === "ci" || val === "pr" || val === "terminal") return val;
    // 默认为 true（当只传 --analyze-deletions 不带值时）
    return true;
  }

  @Option({
    flags: "--deletion-analysis-mode <mode>",
    description: t("review:options.deletionAnalysisMode"),
    choices: ["openai", "claude-code"],
  })
  parseDeletionAnalysisMode(val: string): LLMMode {
    return val as LLMMode;
  }

  @Option({
    flags: "--deletion-only",
    description: t("review:options.deletionOnly"),
  })
  parseDeletionOnly(val: boolean): boolean {
    return val;
  }

  @Option({
    flags: "-o, --output-format <format>",
    description: t("review:options.outputFormat"),
    choices: ["markdown", "terminal", "json"],
  })
  parseOutputFormat(val: string): ReportFormat {
    return val as ReportFormat;
  }

  @Option({
    flags: "--generate-description",
    description: t("review:options.generateDescription"),
  })
  parseGenerateDescription(val: boolean): boolean {
    return val;
  }

  @Option({
    flags: "--show-all",
    description: t("review:options.showAll"),
  })
  parseShowAll(val: boolean): boolean {
    return val;
  }

  @Option({
    flags: "--event-action <action>",
    description: t("review:options.eventAction"),
  })
  parseEventAction(val: string): string {
    return val;
  }
}
