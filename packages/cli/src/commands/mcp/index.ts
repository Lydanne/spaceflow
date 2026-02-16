import { defineExtension, type VerboseLevel } from "@spaceflow/core";
import { McpService } from "./mcp.service";
import type { ExtensionLoader } from "../../extension-loader";

/**
 * MCP 命令扩展
 */
export const mcpExtension = defineExtension({
  name: "mcp",
  version: "1.0.0",
  description: "MCP 工具",
  commands: [
    {
      name: "mcp",
      description: "启动 MCP Server",
      options: [
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
        {
          flags: "--inspector",
          description: "启动 MCP Inspector",
        },
      ],
      run: async (_args, options, ctx) => {
        const verbose = (options?.verbose ? 2 : 1) as VerboseLevel;
        const extensionLoader = ctx.getService<ExtensionLoader>("extensionLoader");
        const mcpService = new McpService(extensionLoader);
        await mcpService.startServer(verbose);
      },
    },
  ],
});

export * from "./mcp.service";
