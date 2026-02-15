import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { UpdateService } from "./update.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface UpdateCommandOptions {
  self?: boolean;
  verbose?: VerboseLevel;
}

/**
 * 更新依赖命令
 *
 * 用法：
 *   spaceflow update              # 更新所有依赖
 *   spaceflow update <name>       # 更新指定依赖
 *   spaceflow update --self       # 更新 CLI 自身
 *
 * 功能：
 * 1. npm 包：获取最新版本并安装
 * 2. git 仓库：拉取最新代码
 * 3. --self：更新 spaceflow CLI 自身
 */
@Command({
  name: "update",
  arguments: "[name]",
  description: t("update:description"),
})
export class UpdateCommand extends CommandRunner {
  constructor(private readonly updateService: UpdateService) {
    super();
  }

  async run(passedParams: string[], options: UpdateCommandOptions): Promise<void> {
    const name = passedParams[0];
    const verbose = options.verbose ?? 1;

    try {
      if (options.self) {
        await this.updateService.updateSelf(verbose);
        return;
      }

      if (name) {
        const success = await this.updateService.updateDependency(name, verbose);
        if (!success) {
          process.exit(1);
        }
      } else {
        await this.updateService.updateAll(verbose);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("update:updateFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("update:updateFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "--self",
    description: t("update:options.self"),
  })
  parseSelf(): boolean {
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
