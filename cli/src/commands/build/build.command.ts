import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { BuildService } from "./build.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface BuildOptions {
  skill?: string;
  watch?: boolean;
  verbose?: VerboseLevel;
}

/**
 * 构建命令
 *
 * 用于构建 skills 目录下的插件包
 *
 * 用法：
 *   spaceflow build [skill]        # 构建指定或所有插件
 *   spaceflow build --watch        # 监听模式
 */
@Command({
  name: "build",
  arguments: "[skill]",
  description: t("build:description"),
})
export class BuildCommand extends CommandRunner {
  constructor(private readonly buildService: BuildService) {
    super();
  }

  async run(passedParams: string[], options: BuildOptions): Promise<void> {
    const skill = passedParams[0];
    const verbose = options.verbose ?? true;

    try {
      if (options.watch) {
        await this.buildService.watch(skill, verbose);
      } else {
        const results = await this.buildService.build(skill, verbose);
        const hasErrors = results.some((r) => !r.success);
        if (hasErrors) {
          process.exit(1);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("build:buildFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("build:buildFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-w, --watch",
    description: t("build:options.watch"),
  })
  parseWatch(val: boolean): boolean {
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
