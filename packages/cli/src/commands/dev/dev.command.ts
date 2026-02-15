import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { BuildService } from "../build/build.service";
import type { VerboseLevel } from "@spaceflow/core";

/**
 * 开发命令
 *
 * 用于开发 Extension 插件包（监听模式）
 *
 * 用法：
 *   spaceflow dev [extension]    # 监听并构建指定或所有 Extension
 */
export interface DevOptions {
  verbose?: VerboseLevel;
}

@Command({
  name: "dev",
  arguments: "[extension]",
  description: t("dev:description"),
})
export class DevCommand extends CommandRunner {
  constructor(private readonly buildService: BuildService) {
    super();
  }

  async run(passedParams: string[], options: DevOptions): Promise<void> {
    const extensionName = passedParams[0];
    const verbose = options.verbose ?? true;

    try {
      await this.buildService.watch(extensionName, verbose);
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("dev:startFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("dev:startFailed", { error }));
      }
      process.exit(1);
    }
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
