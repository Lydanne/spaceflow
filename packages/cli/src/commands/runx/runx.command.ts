import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { RunxService } from "./runx.service";
import { parseRunxArgs } from "./runx.utils";
import type { VerboseLevel } from "@spaceflow/core";

export interface RunxCommandOptions {
  name?: string;
  verbose?: VerboseLevel;
}

/**
 * runx 命令：全局安装 + 运行命令
 *
 * 用法：
 *   spaceflow x <source> [args...]
 *   spaceflow x ./extensions/ci-scripts --help
 *
 * 功能：
 * 1. 全局安装指定的依赖（如果未安装）
 * 2. 运行该依赖提供的命令
 */
@Command({
  name: "runx",
  aliases: ["x"],
  arguments: "<source>",
  description: t("runx:description"),
})
export class RunxCommand extends CommandRunner {
  constructor(private readonly runxService: RunxService) {
    super();
  }

  async run(passedParams: string[], options: RunxCommandOptions): Promise<void> {
    // 使用工具函数解析参数
    const { source, args } = parseRunxArgs(process.argv);
    const verbose = options.verbose ?? true;
    if (!source) {
      console.error(t("runx:noSource"));
      console.error(t("runx:usage"));
      process.exit(1);
    }
    try {
      await this.runxService.execute({
        source,
        name: options.name,
        args,
        verbose,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("runx:runFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("runx:runFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-n, --name <name>",
    description: t("runx:options.name"),
  })
  parseName(val: string): string {
    return val;
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
