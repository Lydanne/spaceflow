import { t } from "@spaceflow/core";
import type { VerboseLevel } from "@spaceflow/core";
import { shouldLog, type McpToolMetadata } from "@spaceflow/core";
import type { ExtensionLoader } from "../../extension-loader-new.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export class McpService {
  constructor(private readonly extensionLoader: ExtensionLoader) {}

  /**
   * 启动 MCP Server
   * 收集所有扩展的 MCP 工具并启动服务
   */
  async startServer(verbose?: VerboseLevel): Promise<void> {
    if (shouldLog(verbose, 1)) {
      console.error(t("mcp:scanning"));
    }

    // 加载所有扩展
    await this.extensionLoader.discoverAndLoad();

    // 获取所有命令（包含扩展的 MCP 工具）
    const commands = this.extensionLoader.getCommands();
    const allTools: Array<{ tool: McpToolMetadata; provider: any }> = [];

    if (shouldLog(verbose, 2)) {
      console.error(t("mcp:foundExtensions", { count: commands.length }));
    }

    // 收集所有扩展的 MCP 工具
    // 注意：新的架构中，MCP 工具通过扩展的 mcp 字段定义
    // 这里需要重新实现以适配新架构
    // TODO: 实现 MCP 工具收集逻辑

    if (allTools.length === 0) {
      console.error(t("mcp:noToolsFound"));
      console.error(t("mcp:noToolsHint"));
      process.exit(1);
    }

    if (shouldLog(verbose, 1)) {
      console.error(t("mcp:toolsFound", { count: allTools.length }));
    }

    // 启动 MCP Server
    await this.runServer(allTools, verbose);
  }

  /**
   * 运行 MCP Server
   */
  private async runServer(
    allTools: Array<{ tool: McpToolMetadata; provider: any }>,
    verbose?: VerboseLevel,
  ): Promise<void> {
    const server = new McpServer({ name: "spaceflow", version: "1.0.0" });

    // 注册所有工具（使用 v2 API: server.registerTool）
    for (const { tool, provider } of allTools) {
      // 将 JSON Schema 转换为 Zod schema
      const schema = this.jsonSchemaToZod(tool.inputSchema);
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: Object.keys(schema).length > 0 ? z.object(schema) : z.object({}),
        },
        async (args: any) => {
          try {
            const result = await provider[tool.methodName](args || {});
            return {
              content: [
                {
                  type: "text" as const,
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      );
    }

    // 启动 stdio 传输
    const transport = new StdioServerTransport();
    await server.connect(transport);

    if (shouldLog(verbose, 1)) {
      console.error(t("mcp:serverStarted", { count: allTools.length }));
    }

    if (process.env.MODELCONTEXT_PROTOCOL_INSPECTOR) {
      await new Promise<void>((resolve) => {
        process.stdin.on("close", resolve);
        process.on("SIGINT", resolve);
        process.on("SIGTERM", resolve);
      });
    }
  }

  /**
   * 将 JSON Schema 转换为 Zod schema
   */
  private jsonSchemaToZod(jsonSchema?: Record<string, any>): Record<string, any> {
    if (!jsonSchema || !jsonSchema.properties) {
      return {};
    }

    const zodShape: Record<string, any> = {};
    for (const [key, prop] of Object.entries(jsonSchema.properties as Record<string, any>)) {
      const isRequired = jsonSchema.required?.includes(key);
      let zodType: any;

      switch (prop.type) {
        case "string":
          zodType = z.string();
          break;
        case "number":
          zodType = z.number();
          break;
        case "boolean":
          zodType = z.boolean();
          break;
        case "array":
          zodType = z.array(z.any());
          break;
        default:
          zodType = z.any();
      }

      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      zodShape[key] = isRequired ? zodType : zodType.optional();
    }

    return zodShape;
  }
}
