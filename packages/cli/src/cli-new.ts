#!/usr/bin/env node
import { Command } from "commander";
import { initI18n } from "@spaceflow/core";
import { ServiceContainer } from "./service-container";
import { ExtensionLoader } from "./extension-loader-new";
import { internalExtensions } from "./internal-extensions-new";

// 初始化 i18n
initI18n();

// 注册内部命令的 i18n 资源
import "./locales";

async function bootstrap() {
  // 创建服务容器
  const container = new ServiceContainer();

  // 创建扩展加载器
  const extensionLoader = new ExtensionLoader(container);

  // 注册内部扩展
  for (const ext of internalExtensions) {
    extensionLoader.registerExtension(ext);
  }

  // 发现并加载外部扩展
  await extensionLoader.discoverAndLoad();

  // 创建 CLI 程序
  const program = new Command();
  program.name("spaceflow").description("Spaceflow CLI").version("1.0.0");

  // 注册所有命令
  const commands = extensionLoader.getCommands();
  for (const cmd of commands) {
    const command = program.command(cmd.name, cmd.description);

    // 添加参数
    if (cmd.arguments) {
      command.arguments(cmd.arguments);
    }

    // 添加选项
    if (cmd.options) {
      for (const opt of cmd.options) {
        command.option(opt.flags, opt.description, opt.default);
      }
    }

    // 添加子命令
    if (cmd.subcommands) {
      for (const sub of cmd.subcommands) {
        const subCmd = command.command(sub.name, sub.description);
        if (sub.options) {
          for (const opt of sub.options) {
            subCmd.option(opt.flags, opt.description, opt.default);
          }
        }
        subCmd.action(async (args, options) => {
          await sub.run([args], options, container);
        });
      }
    }

    // 添加执行函数
    command.action(async (args, options) => {
      await cmd.run(args, options, container);
    });
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
