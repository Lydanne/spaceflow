declare const __CORE_VERSION__: string;

import { Command } from "commander";
import type { ExtensionDefinition } from "@spaceflow/core";
import { ServiceContainer, initializeContainer } from "./di";
import { ExtensionLoader } from "./extension-loader";
import { internalExtensions } from "./internal-extensions";
import { initCliI18n } from "./i18n";

export { ServiceContainer } from "./di";
export { ExtensionLoader } from "./extension-loader";
export { initCliI18n } from "./i18n";
export { internalExtensions } from "./internal-extensions";

/**
 * Core.exec() — CLI 运行时入口
 * 接收外部扩展列表，结合内部扩展，构建并执行 commander 程序
 *
 * @param extensions 外部扩展定义列表（来自 .spaceflow/bin/index.js 的静态导入）
 */
export interface ExecOptions {
  cliVersion?: string;
}

export async function exec(
  extensions: ExtensionDefinition[] = [],
  options: ExecOptions = {},
): Promise<void> {
  // 1. 初始化 i18n（如果尚未初始化，由生成的 bin/index.js 提前调用）
  initCliI18n();

  // 2. 创建并初始化服务容器
  const container = new ServiceContainer();
  initializeContainer(container);

  // 3. 创建扩展加载器
  const extensionLoader = new ExtensionLoader(container);
  container.registerService("extensionLoader", extensionLoader);

  // 4. 注册内部扩展
  for (const ext of internalExtensions) {
    await extensionLoader.registerExtension(ext);
  }

  // 5. 注册外部扩展（由 CLI 壳子加载并传入）
  for (const ext of extensions) {
    await extensionLoader.registerExtension(ext);
  }

  // 6. 创建 CLI 程序
  const program = new Command();
  const cliVersion = options.cliVersion || "0.0.0";
  const coreVersion = typeof __CORE_VERSION__ !== "undefined" ? __CORE_VERSION__ : "0.0.0";
  const versionOutput = `spaceflow/${cliVersion} core/${coreVersion}`;

  program.name("spaceflow").description("Spaceflow CLI");

  // 在路由子命令之前处理根级 -V/--version（不注册 .version() 以免拦截子命令的 -V）
  const rawArgs = process.argv.slice(2);
  const hasVersionFlag = rawArgs.includes("-V") || rawArgs.includes("--version");
  const firstSubCmd = rawArgs.find((a) => !a.startsWith("-"));
  if (hasVersionFlag && !firstSubCmd) {
    console.log(versionOutput);
    await extensionLoader.destroy();
    await container.destroy();
    process.exit(0);
  }

  // 定义全局 verbose 选项（支持计数：-v, -vv, -vvv）
  program.option(
    "-v, --verbose",
    "详细输出（可叠加：-v, -vv, -vvv）",
    (_, prev: number) => prev + 1,
    0,
  );

  // 全局选项列表
  const globalOptions = ["-h, --help", "-V, --version", "-v, --verbose"];

  // 8. 注册所有命令
  // 建立命令名 -> 扩展版本的映射（用于给子命令注入 --version）
  const cmdVersionMap = new Map<string, string>();
  for (const ext of extensionLoader.getExtensions()) {
    if (ext.version) {
      for (const cmd of ext.commands) {
        cmdVersionMap.set(cmd.name, `${ext.name}/${ext.version}`);
      }
    }
  }

  const commands = extensionLoader.getCommands();
  for (const cmd of commands) {
    const command = new Command(cmd.name).description(cmd.description);

    // 注入扩展版本（pnpm space review --version）
    const extVersion = cmdVersionMap.get(cmd.name);
    if (extVersion) {
      command.option("-V, --version", "显示扩展版本");
      command.hook("preAction", (thisCommand) => {
        if (thisCommand.opts().version) {
          console.log(extVersion);
          process.exit(0);
        }
      });
    }

    // 添加别名
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        command.alias(alias);
      }
    }

    // 添加参数
    if (cmd.arguments) {
      command.arguments(cmd.arguments);
    }

    // 添加选项（排除已定义的全局选项）
    if (cmd.options) {
      for (const opt of cmd.options) {
        if (!globalOptions.some((go) => opt.flags.startsWith(go.split(",")[0].trim()))) {
          if (opt.isCount) {
            command.option(
              opt.flags as string,
              opt.description as string,
              (_, prev: number) => prev + 1,
              0,
            );
          } else {
            const defaultValue = opt.default as string | boolean | string[] | undefined;
            command.option(opt.flags as string, opt.description as string, defaultValue);
          }
        }
      }
    }

    // 添加子命令
    if (cmd.subcommands) {
      for (const sub of cmd.subcommands) {
        const subCmd = new Command(sub.name).description(sub.description);
        if (sub.options) {
          for (const opt of sub.options) {
            if (!globalOptions.some((go) => opt.flags.startsWith(go.split(",")[0].trim()))) {
              const defaultValue = opt.default as string | boolean | string[] | undefined;
              subCmd.option(opt.flags as string, opt.description as string, defaultValue);
            }
          }
        }
        subCmd.action(async (args, options) => {
          await sub.run([args], options, container);
        });
        command.addCommand(subCmd);
      }
    }

    // 添加执行函数
    command.action(async (...actionArgs) => {
      const opts = actionArgs[actionArgs.length - 2] || {};
      const positionalArgs = actionArgs.slice(0, -2);
      // 合并全局 verbose 选项
      const globalOpts = program.opts();
      if (globalOpts.verbose && !opts.verbose) {
        opts.verbose = globalOpts.verbose;
      }
      await cmd.run(positionalArgs, opts, container);
    });

    program.addCommand(command);
  }

  // 9. 解析命令行参数，并在退出前清理扩展和服务
  try {
    await program.parseAsync(process.argv);
  } finally {
    await extensionLoader.destroy();
    await container.destroy();
  }
}
