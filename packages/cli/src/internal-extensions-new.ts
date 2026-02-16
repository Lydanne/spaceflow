import { defineExtension } from "@spaceflow/core";
import { BuildService } from "./commands/build/build.service";

/**
 * 内部扩展列表
 * 使用新的 defineExtension 格式
 */
export const internalExtensions = [
  defineExtension({
    name: "build",
    version: "1.0.0",
    description: "构建 Extension 插件包",
    commands: [
      {
        name: "build",
        description: "构建指定或所有 Extension",
        arguments: "[extension]",
        options: [
          {
            flags: "-w, --watch",
            description: "监听模式",
          },
          {
            flags: "-v, --verbose",
            description: "详细输出",
          },
        ],
        run: async (args, options, ctx) => {
          const extensionName = args[0];
          const verbose = (options?.verbose ? 1 : 0) as 0 | 1 | 2;
          const buildService = new BuildService();

          try {
            if (options?.watch) {
              await buildService.watch(extensionName, verbose);
            } else {
              const results = await buildService.build(extensionName, verbose);
              const hasErrors = results.some((r) => !r.success);
              if (hasErrors) {
                process.exit(1);
              }
            }
          } catch (error) {
            ctx.output.error(`构建失败: ${error instanceof Error ? error.message : error}`);
            process.exit(1);
          }
        },
      },
    ],
  }),
  defineExtension({
    name: "dev",
    version: "1.0.0",
    description: "开发模式运行 Extension",
    commands: [
      {
        name: "dev",
        description: "开发模式",
        arguments: "[extension]",
        options: [
          {
            flags: "-v, --verbose",
            description: "详细输出",
          },
        ],
        run: async (args, options, ctx) => {
          ctx.output.info("dev 命令暂未实现");
          // TODO: 实现 dev 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "clear",
    version: "1.0.0",
    description: "清除缓存",
    commands: [
      {
        name: "clear",
        description: "清除缓存",
        run: async (args, options, ctx) => {
          ctx.output.info("clear 命令暂未实现");
          // TODO: 实现 clear 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "runx",
    version: "1.0.0",
    description: "运行 x 命令",
    commands: [
      {
        name: "runx",
        description: "运行 x 命令",
        arguments: "<source> -- <command>",
        run: async (args, options, ctx) => {
          ctx.output.info("runx 命令暂未实现");
          // TODO: 实现 runx 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "schema",
    version: "1.0.0",
    description: "生成 schema",
    commands: [
      {
        name: "schema",
        description: "生成 schema",
        run: async (args, options, ctx) => {
          ctx.output.info("schema 命令暂未实现");
          // TODO: 实现 schema 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "commit",
    version: "1.0.0",
    description: "提交代码",
    commands: [
      {
        name: "commit",
        description: "提交代码",
        run: async (args, options, ctx) => {
          ctx.output.info("commit 命令暂未实现");
          // TODO: 实现 commit 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "setup",
    version: "1.0.0",
    description: "设置配置",
    commands: [
      {
        name: "setup",
        description: "设置配置",
        run: async (args, options, ctx) => {
          ctx.output.info("setup 命令暂未实现");
          // TODO: 实现 setup 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "mcp",
    version: "1.0.0",
    description: "MCP 工具",
    commands: [
      {
        name: "mcp",
        description: "MCP 工具",
        run: async (args, options, ctx) => {
          ctx.output.info("mcp 命令暂未实现");
          // TODO: 实现 mcp 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "install",
    version: "1.0.0",
    description: "安装 Extension",
    commands: [
      {
        name: "install",
        description: "安装 Extension",
        arguments: "<package>",
        run: async (args, options, ctx) => {
          const packageName = args[0];
          if (!packageName) {
            ctx.output.error("请指定要安装的包名");
            process.exit(1);
          }
          ctx.output.info(`安装 ${packageName} 命令暂未实现`);
          // TODO: 实现 install 命令逻辑
        },
      },
    ],
  }),
  defineExtension({
    name: "list",
    version: "1.0.0",
    description: "列出已安装的 Extension",
    commands: [
      {
        name: "list",
        description: "列出已安装的 Extension",
        run: async (args, options, ctx) => {
          ctx.output.info("已安装的 Extension:");
          ctx.output.info("- build");
          ctx.output.info("- dev");
          ctx.output.info("- install");
          ctx.output.info("- list");
          ctx.output.info("- ci-scripts");
          ctx.output.info("- ci-shell");
          ctx.output.info("- publish");
          ctx.output.info("- period-summary");
          ctx.output.info("- review");
        },
      },
    ],
  }),
];
