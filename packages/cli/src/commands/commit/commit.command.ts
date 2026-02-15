import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { CommitService } from "./commit.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface CommitCommandOptions {
  verbose?: VerboseLevel;
  dryRun?: boolean;
  noVerify?: boolean;
  split?: boolean;
}

/**
 * Commit 命令
 *
 * 基于暂存区代码变更和历史 commit 自动生成规范的 commit message
 *
 * 用法：
 *   spaceflow commit              # 生成并提交
 *   spaceflow commit --dry-run    # 仅生成，不提交
 *   spaceflow commit --verbose    # 显示详细信息
 */
@Command({
  name: "commit",
  description: t("commit:description"),
})
export class CommitCommand extends CommandRunner {
  constructor(private readonly commitService: CommitService) {
    super();
  }

  async run(_passedParams: string[], options: CommitCommandOptions): Promise<void> {
    const verbose = options.verbose ?? 0;

    try {
      const result = await this.commitService.generateAndCommit({
        verbose,
        dryRun: options.dryRun,
        noVerify: options.noVerify,
        split: options.split,
      });

      if (result.success) {
        if (options.dryRun) {
          console.log(t("commit:dryRunMode"));
          console.log(result.message);
        } else {
          if (result.commitCount && result.commitCount > 1) {
            console.log(t("commit:splitSuccess", { count: result.commitCount }));
            // 分批提交时已经实时打印了每个 commit，不再重复打印
          } else {
            console.log(t("commit:commitSuccess"));
            if (result.message) {
              console.log(result.message);
            }
          }
        }
      } else {
        console.error(t("commit:commitFailed", { error: result.error }));
        process.exit(1);
      }
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
    description: t("commit:options.dryRun"),
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: "-v, --verbose",
    description: t("common.options.verbose"),
  })
  parseVerbose(_val: string, previous: VerboseLevel = 0): VerboseLevel {
    // 每次 -v 增加一级，最高为 2
    const current = typeof previous === "number" ? previous : previous ? 1 : 0;
    return Math.min(current + 1, 2) as VerboseLevel;
  }

  @Option({
    flags: "-n, --no-verify",
    description: t("commit:options.noVerify"),
  })
  parseNoVerify(): boolean {
    return true;
  }

  @Option({
    flags: "-s, --split",
    description: t("commit:options.split"),
  })
  parseSplit(): boolean {
    return true;
  }
}
