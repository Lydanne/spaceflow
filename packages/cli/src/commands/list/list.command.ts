import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { ListService } from "./list.service";
import type { VerboseLevel } from "@spaceflow/core";

/**
 * 列出已安装的技能包
 *
 * 用法：
 *   spaceflow list
 *
 * 输出已安装的所有命令包及其信息
 */
export interface ListOptions {
  verbose?: VerboseLevel;
}

@Command({
  name: "list",
  description: t("list:description"),
})
export class ListCommand extends CommandRunner {
  constructor(private readonly listService: ListService) {
    super();
  }

  async run(passedParams: string[], options: ListOptions): Promise<void> {
    const verbose = options.verbose ?? true;
    await this.listService.execute(verbose);
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
