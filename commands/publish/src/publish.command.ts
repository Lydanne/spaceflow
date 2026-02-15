import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { PublishService } from "./publish.service";

export interface PublishOptions {
  dryRun: boolean;
  ci: boolean;
  prerelease?: string;
  /** 预演模式：执行 hooks 但不修改文件/git */
  rehearsal: boolean;
}

@Command({
  name: "publish",
  description: t("publish:description"),
})
export class PublishCommand extends CommandRunner {
  constructor(protected readonly publishService: PublishService) {
    super();
  }

  async run(_passedParams: string[], options: PublishOptions): Promise<void> {
    if (options.rehearsal) {
      console.log(t("publish:rehearsalMode"));
    } else if (options.dryRun) {
      console.log(t("publish:dryRunMode"));
    }

    try {
      const context = this.publishService.getContextFromEnv(options);
      await this.publishService.execute(context);
    } catch (error) {
      console.error(
        t("common.executionFailed", { error: error instanceof Error ? error.message : error }),
      );
      process.exit(1);
    }
  }

  @Option({
    flags: "-d, --dry-run",
    description: t("common.options.dryRun"),
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
    flags: "-p, --prerelease <tag>",
    description: t("publish:options.prerelease"),
  })
  parsePrerelease(val: string): string {
    return val;
  }

  @Option({
    flags: "-r, --rehearsal",
    description: t("publish:options.rehearsal"),
  })
  parseRehearsal(val: boolean): boolean {
    return val;
  }
}
