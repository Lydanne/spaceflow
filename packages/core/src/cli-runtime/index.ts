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
export async function exec(extensions: ExtensionDefinition[] = []): Promise<void> {
  // 1. 初始化 i18n
  initCliI18n();

  // 2. 创建并初始化服务容器
  const container = new ServiceContainer();
  initializeContainer(container);

  // 3. 创建扩展加载器
  const extensionLoader = new ExtensionLoader(container);
  container.registerService("extensionLoader", extensionLoader);

  // 4. 注册内部扩展
  for (const ext of internalExtensions) {
    extensionLoader.registerExtension(ext);
  }

  // 5. 注册外部扩展（由 CLI 壳子加载并传入）
  for (const ext of extensions) {
    extensionLoader.registerExtension(ext);
  }

  // 6. 创建 CLI 程序
  const program = new Command();
  program.name("spaceflow").description("Spaceflow CLI").version("1.0.0");

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
  const commands = extensionLoader.getCommands();
  for (const cmd of commands) {
    const command = new Command(cmd.name).description(cmd.description);

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

  // 9. 解析命令行参数
  await program.parseAsync(process.argv);

  // 10. 清理
  await container.destroy();
}
