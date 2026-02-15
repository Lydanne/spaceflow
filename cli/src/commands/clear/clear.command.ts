import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { ClearService } from "./clear.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface ClearCommandOptions {
  global?: boolean;
  verbose?: VerboseLevel;
}

/**
 * 清理所有安装的技能包
 *
 * 用法：
 *   spaceflow clear           # 清理本地安装的所有 skills
 *   spaceflow clear -g        # 清理全局安装的所有 skills
 *
 * 功能：
 * 1. 删除 .spaceflow/deps 目录下的所有依赖
 * 2. 删除各编辑器 skills 目录下的所有安装内容
 * 3. 删除各编辑器 commands 目录下的所有生成的 .md 文件
 */
@Command({
  name: "clear",
  description: t("clear:description"),
})
export class ClearCommand extends CommandRunner {
  constructor(private readonly clearService: ClearService) {
    super();
  }

  async run(_passedParams: string[], options: ClearCommandOptions): Promise<void> {
    const isGlobal = options.global ?? false;
    const verbose = options.verbose ?? true;

    try {
      await this.clearService.execute(isGlobal, verbose);
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("clear:clearFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("clear:clearFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-g, --global",
    description: t("clear:options.global"),
  })
  parseGlobal(): boolean {
    return true;
  }

  @Option({
    flags: "-v, --verbose",
    description: t("common.options.verbose"),
  })
  parseVerbose(_val: string, previous: VerboseLevel = 0): VerboseLevel {
    const current = typeof previous === "number" ? previous : previous ? 1 : 0;
    return Math.min(current + 1, 2) as VerboseLevel;
  }
}
