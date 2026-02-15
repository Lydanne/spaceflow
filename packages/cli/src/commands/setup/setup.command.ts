import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { SetupService } from "./setup.service";

export interface SetupCommandOptions {
  global?: boolean;
}

@Command({
  name: "setup",
  description: t("setup:description"),
})
export class SetupCommand extends CommandRunner {
  constructor(private readonly setupService: SetupService) {
    super();
  }

  async run(_passedParams: string[], options: SetupCommandOptions): Promise<void> {
    const isGlobal = options.global ?? false;

    try {
      if (isGlobal) {
        await this.setupService.setupGlobal();
      } else {
        await this.setupService.setupLocal();
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("setup:setupFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("setup:setupFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-g, --global",
    description: t("setup:options.global"),
  })
  parseGlobal(): boolean {
    return true;
  }
}
