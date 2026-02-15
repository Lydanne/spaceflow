import { Injectable, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { existsSync, realpathSync } from "fs";
import { spawn } from "child_process";
import { InstallService } from "../install/install.service";
import { CommandFactory } from "nest-commander";
import type { SpaceflowExtension, VerboseLevel } from "@spaceflow/core";
import {
  configLoaders,
  getEnvFilePaths,
  StorageModule,
  OutputModule,
  extractName,
  getSourceType,
  t,
} from "@spaceflow/core";

export interface RunxOptions {
  source: string;
  name?: string;
  args: string[];
  verbose?: VerboseLevel;
}

/**
 * Runx 服务
 * 全局安装依赖后运行命令
 */
@Injectable()
export class RunxService {
  constructor(private readonly installService: InstallService) {}

  /**
   * 执行 runx：全局安装 + 运行命令
   */
  async execute(options: RunxOptions): Promise<void> {
    const { source, args } = options;
    const verbose = options.verbose ?? true;
    const name = options.name || extractName(source);
    const sourceType = getSourceType(source);

    // npm 包直接使用 npx 执行
    if (sourceType === "npm") {
      if (verbose)
        console.log(t("runx:runningCommand", { command: `npx ${source} ${args.join(" ")}` }));
      await this.runWithNpx(source, args);
      return;
    }

    // 第一步：全局安装（静默模式）
    await this.installService.installGlobal(
      {
        source,
        name: options.name,
      },
      false,
    );
    // 第二步：运行命令
    if (verbose) console.log(t("runx:runningCommand", { command: `${name} ${args.join(" ")}` }));
    await this.runCommand(name, args);
  }

  /**
   * 使用 npx 运行 npm 包
   */
  private runWithNpx(packageName: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("npx", [packageName, ...args], {
        stdio: "inherit",
        shell: true,
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(t("runx:npxExitCode", { package: packageName, code })));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * 运行已安装的命令
   * 创建包含共享模块的新实例并运行
   */
  protected async runCommand(name: string, args: string[]): Promise<void> {
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    const depPath = join(home, ".spaceflow", "node_modules", name);
    // 检查命令是否存在
    if (!existsSync(depPath)) {
      throw new Error(t("runx:commandNotInstalled", { name }));
    }
    // 解析符号链接获取真实路径
    const realDepPath = realpathSync(depPath);
    // 检查是否有 dist/index.js
    const distPath = join(realDepPath, "dist", "index.js");
    if (!existsSync(distPath)) {
      throw new Error(t("runx:commandNotBuilt", { name }));
    }
    // 动态加载插件（使用 Function 构造器绕过 rspack 转换）
    const importUrl = `file://${distPath}`;
    const dynamicImport = new Function("url", "return import(url)");
    const pluginModule = await dynamicImport(importUrl);
    const PluginClass = pluginModule.default;
    if (!PluginClass) {
      throw new Error(t("runx:pluginNoExport", { name }));
    }
    const extension: SpaceflowExtension = new PluginClass();
    const metadata = extension.getMetadata();
    const commandModule = extension.getModule();
    // 如果插件只有一个命令，且用户没有指定子命令，自动补充
    const finalArgs = this.autoCompleteCommand(args, metadata.commands);
    // 创建动态模块并运行（包含配置和共享模块）
    @Module({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: configLoaders,
          envFilePath: getEnvFilePaths(),
        }),
        StorageModule.forFeature(),
        OutputModule,
        commandModule,
      ],
    })
    class DynamicRunxModule {}
    // 修改 process.argv 以传递参数
    const originalArgv = process.argv;
    process.argv = ["node", "runx", ...finalArgs];
    try {
      await CommandFactory.run(DynamicRunxModule, {
        logger: false,
      });
    } finally {
      process.argv = originalArgv;
    }
  }

  /**
   * 自动补充命令名
   * 如果插件只有一个命令，且用户没有指定子命令，自动在参数前补充命令名
   */
  private autoCompleteCommand(args: string[], commands?: string[]): string[] {
    // 没有命令列表或为空，直接返回
    if (!commands || commands.length === 0) {
      return args;
    }
    // 如果只有一个命令
    if (commands.length === 1) {
      const cmdName = commands[0];
      // 检查用户是否已经指定了该命令
      if (args.length === 0 || args[0] !== cmdName) {
        // 如果第一个参数是选项（以 - 开头），说明用户没有指定子命令
        if (args.length === 0 || args[0].startsWith("-")) {
          return [cmdName, ...args];
        }
      }
    }
    return args;
  }
}
