import { Command, CommandRunner, Option } from "nest-commander";
import { t } from "@spaceflow/core";
import { InstallService } from "./install.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface InstallCommandOptions {
  name?: string;
  global?: boolean;
  verbose?: VerboseLevel;
  ignoreErrors?: boolean; // 忽略错误，不退出进程
}

/**
 * 安装技能包命令
 *
 * 用法：
 *   spaceflow install <source> [--name <名称>]
 *   spaceflow install                           # 更新所有已安装的 skills
 *
 * 支持的 source 类型：
 * - 本地路径: ./skills/publish, skills/my-plugin
 * - npm 包: @spaceflow/plugin-review, spaceflow-plugin-deploy
 * - git 仓库: git@git.example.com:org/plugin.git
 *
 * 功能：
 * 1. 本地路径：注册到 spaceflow.json
 * 2. npm 包：执行 pnpm add <package>
 * 3. git 仓库：克隆到 .spaceflow/skills/<name> 并关联到支持的编辑器目录
 * 4. 更新 spaceflow.json 的 skills 字段
 */
@Command({
  name: "install",
  arguments: "[source]",
  description: t("install:description"),
})
export class InstallCommand extends CommandRunner {
  constructor(protected readonly installService: InstallService) {
    super();
  }

  async run(passedParams: string[], options: InstallCommandOptions): Promise<void> {
    const source = passedParams[0];
    const isGlobal = options.global ?? false;
    const verbose = options.verbose ?? true;

    try {
      if (isGlobal) {
        // 全局安装：必须指定 source
        if (!source) {
          console.error(t("install:globalNoSource"));
          console.error(t("install:globalUsage"));
          process.exit(1);
        }
        await this.installService.installGlobal(
          {
            source,
            name: options.name,
          },
          verbose,
        );
      } else if (!source) {
        // 本地安装无参数：更新配置文件中的所有依赖
        await this.installService.updateAllSkills({ verbose });
      } else {
        // 本地安装有参数：安装指定的依赖
        const context = this.installService.getContext({
          source,
          name: options.name,
        });
        await this.installService.execute(context, verbose);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(t("install:installFailed", { error: error.message }));
        if (error.stack) {
          console.error(t("common.stackTrace", { stack: error.stack }));
        }
      } else {
        console.error(t("install:installFailed", { error }));
      }
      if (!options.ignoreErrors) {
        process.exit(1);
      }
    }
  }

  @Option({
    flags: "-n, --name <name>",
    description: t("install:options.name"),
  })
  parseName(val: string): string {
    return val;
  }

  @Option({
    flags: "-g, --global",
    description: t("install:options.global"),
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

  @Option({
    flags: "--ignore-errors",
    description: t("install:options.ignoreErrors"),
  })
  parseIgnoreErrors(): boolean {
    return true;
  }
}
