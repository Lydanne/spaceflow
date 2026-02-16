#!/usr/bin/env node
import { Command } from "commander";
import { initI18n } from "@spaceflow/core";
import { ServiceContainer, initializeContainer } from "./di";
import { ExtensionLoader } from "./extension-loader";
import { internalExtensions } from "./internal-extensions";

// 初始化 i18n
initI18n();

// 注册内部命令的 i18n 资源
import "./locales";

async function bootstrap() {
  // 创建并初始化服务容器
  const container = new ServiceContainer();
  initializeContainer(container);

  // 创建扩展加载器
  const extensionLoader = new ExtensionLoader(container);

  // 注册 extensionLoader 到服务容器
  container.registerService("extensionLoader", extensionLoader);

  // 注册内部扩展
  for (const ext of internalExtensions) {
    extensionLoader.registerExtension(ext);
  }

  // 发现并加载外部扩展
  await extensionLoader.discoverAndLoad();

  // 创建 CLI 程序
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

  // 注册所有命令
  const commands = extensionLoader.getCommands();
  for (const cmd of commands) {
    const command = new Command(cmd.name).description(cmd.description);

    // 添加参数
    if (cmd.arguments) {
      command.arguments(cmd.arguments);
    }

    // 添加选项（排除已定义的全局选项）
    if (cmd.options) {
      for (const opt of cmd.options) {
        if (!globalOptions.some((go) => opt.flags.startsWith(go.split(",")[0].trim()))) {
          if (opt.isCount) {
            // 计数选项：-v -v -v 或 -vvv 会累加
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
    // commander 的 action 回调：有位置参数时是 (arg1, arg2, ..., options, command)
    // 无位置参数时是 (options, command)
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

    // 将命令添加到 program
    program.addCommand(command);
  }

  // 解析命令行参数
  await program.parseAsync(process.argv);

  // 清理
  await container.destroy();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
