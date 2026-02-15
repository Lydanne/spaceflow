import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { CreateService } from "./create.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface CreateOptions {
  directory?: string;
  list?: boolean;
  from?: string;
  ref?: string;
  verbose?: VerboseLevel;
}

/**
 * 创建插件命令
 *
 * 用法：
 *   spaceflow create <template> <name> [--directory <dir>]
 *   spaceflow create --from <repo> <template> <name>  使用远程模板仓库
 *   spaceflow create --list  查看可用模板
 *
 * 模板类型动态读取自 templates/ 目录或远程仓库
 */
@Command({
  name: "create",
  arguments: "[template] [name]",
  description: t("create:description"),
})
export class CreateCommand extends CommandRunner {
  constructor(protected readonly createService: CreateService) {
    super();
  }

  async run(passedParams: string[], options: CreateOptions): Promise<void> {
    const verbose = options.verbose ?? true;
    // 列出可用模板
    if (options.list) {
      await this.listTemplates(options, verbose);
      return;
    }

    const template = passedParams[0];
    const name = passedParams[1];

    // 无参数时显示帮助
    if (!template) {
      await this.showHelp();
      return;
    }

    if (!name) {
      console.error(t("create:noName"));
      console.error(t("create:usage"));
      process.exit(1);
    }

    try {
      // 如果指定了远程仓库，先获取模板
      if (options.from) {
        await this.createService.ensureRemoteTemplates(options.from, options.ref, verbose);
      }
      await this.createService.createFromTemplate(template, name, options, verbose);
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("create:createFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("create:createFailed", { error }));
      }
      process.exit(1);
    }
  }

  @Option({
    flags: "-d, --directory <dir>",
    description: t("create:options.directory"),
  })
  parseDirectory(val: string): string {
    return val;
  }

  @Option({
    flags: "-l, --list",
    description: t("create:options.list"),
  })
  parseList(): boolean {
    return true;
  }

  @Option({
    flags: "-f, --from <repo>",
    description: t("create:options.from"),
  })
  parseFrom(val: string): string {
    return val;
  }

  @Option({
    flags: "-r, --ref <ref>",
    description: t("create:options.ref"),
  })
  parseRef(val: string): string {
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

  protected async listTemplates(options: CreateOptions, verbose: VerboseLevel): Promise<void> {
    if (options.from) {
      await this.createService.ensureRemoteTemplates(options.from, options.ref, verbose);
    }
    const templates = await this.createService.getAvailableTemplates(options);
    console.log(t("create:availableTemplates"));
    for (const tpl of templates) {
      console.log(`  - ${tpl}`);
    }
  }

  protected async showHelp(): Promise<void> {
    const templates = await this.createService.getAvailableTemplates();
    console.log("Usage: spaceflow create <template> <name> [options]");
    console.log("");
    console.log(t("create:availableTemplates"));
    for (const tpl of templates) {
      console.log(`  - ${tpl}`);
    }
    console.log("");
    console.log("Options:");
    console.log(`  -d, --directory <dir>  ${t("create:options.directory")}`);
    console.log(`  -l, --list             ${t("create:options.list")}`);
    console.log(`  -f, --from <repo>      ${t("create:options.from")}`);
    console.log(`  -r, --ref <ref>        ${t("create:options.ref")}`);
    console.log("");
    console.log("Examples:");
    console.log("  spaceflow create command my-cmd");
    console.log("  spaceflow create skills my-skill");
    console.log("  spaceflow create command my-cmd -d ./plugins/my-cmd");
    console.log("  spaceflow create -f https://github.com/user/templates command my-cmd");
    console.log("  spaceflow create -f git@gitea.example.com:org/tpl.git -r v1.0 api my-api");
  }
}
