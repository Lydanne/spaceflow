import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { CiShellService } from "./ci-shell.service";

export interface CiShellOptions {
  dryRun: boolean;
}

@Command({
  name: "ci-shell",
  description: t("ci-shell:description"),
  arguments: "<command>",
  argsDescription: {
    command: t("ci-shell:argsDescription.command"),
  },
})
export class CiShellCommand extends CommandRunner {
  constructor(protected readonly ciShellService: CiShellService) {
    super();
  }

  async run(passedParams: string[], options: CiShellOptions): Promise<void> {
    const command = passedParams.join(" ");

    if (!command) {
      console.error(t("ci-shell:noCommand"));
      process.exit(1);
    }

    console.log(`DRY-RUN mode: ${options.dryRun ? "enabled" : "disabled"}`);

    try {
      const context = this.ciShellService.getContextFromEnv(options);
      await this.ciShellService.execute(context, command);
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
}
