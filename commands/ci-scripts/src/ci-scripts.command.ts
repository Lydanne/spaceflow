import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { CiScriptsService } from "./ci-scripts.service";

export interface CiScriptsOptions {
  dryRun: boolean;
}

@Command({
  name: "ci-script",
  description: t("ci-scripts:description"),
  arguments: "<script>",
  argsDescription: {
    script: t("ci-scripts:argsDescription.script"),
  },
})
export class CiScriptsCommand extends CommandRunner {
  constructor(protected readonly ciScriptsService: CiScriptsService) {
    super();
  }

  async run(passedParams: string[], options: CiScriptsOptions): Promise<void> {
    const script = passedParams.join(" ");

    if (!script) {
      console.error(t("ci-scripts:noScript"));
      process.exit(1);
    }

    console.log(`DRY-RUN mode: ${options.dryRun ? "enabled" : "disabled"}`);

    try {
      const context = this.ciScriptsService.getContextFromEnv(options);
      await this.ciScriptsService.execute(context, script);
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
