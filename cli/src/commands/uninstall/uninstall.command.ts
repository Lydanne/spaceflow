import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { UninstallService } from "./uninstall.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface UninstallCommandOptions {
  global?: boolean;
  verbose?: VerboseLevel;
}

/**
 * 卸载技能包命令
 *
 * 用法：
 *   spaceflow uninstall <name>
 *
 * 功能：
 * 1. 从 spaceflow.json 的 skills 中移除
 * 2. npm 包：执行 pnpm remove <package>
 * 3. git 仓库：执行 git submodule deinit 并删除目录
 */
@Command({
  name: "uninstall",
  arguments: "<name>",
  description: t("uninstall:description"),
})
export class UninstallCommand extends CommandRunner {
  constructor(private readonly uninstallService: UninstallService) {
    super();
  }

  async run(passedParams: string[], options: UninstallCommandOptions): Promise<void> {
    const name = passedParams[0];
    const isGlobal = options.global ?? false;
    const verbose = options.verbose ?? true;

    if (!name) {
      console.error(t("uninstall:noName"));
      process.exit(1);
    }

    try {
      await this.uninstallService.execute(name, isGlobal, verbose);
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("uninstall:uninstallFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("uninstall:uninstallFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-g, --global",
    description: t("uninstall:options.global"),
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
