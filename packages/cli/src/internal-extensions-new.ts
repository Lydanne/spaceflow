import { defineExtension } from "@spaceflow/core";

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
          ctx.output.info("build 命令暂未实现");
          // TODO: 实现 build 命令逻辑
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
    name: "install",
    version: "1.0.0",
    description: "安装 Extension",
    commands: [
      {
        name: "install",
        description: "安装 Extension",
        arguments: "<package>",
        run: async (args, options, ctx) => {
          ctx.output.info("install 命令暂未实现");
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
          ctx.output.info("list 命令暂未实现");
          // TODO: 实现 list 命令逻辑
        },
      },
    ],
  }),
];
