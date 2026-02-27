import { t } from "@spaceflow/core";
import type { VerboseLevel } from "@spaceflow/core";
import { shouldLog, type McpToolMetadata } from "@spaceflow/core";
import type { ExtensionLoader } from "../../cli-runtime/extension-loader";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";

export class McpService {
  constructor(private readonly extensionLoader: ExtensionLoader) {}

  /**
   * 启动 MCP Server
   * 收集所有扩展的 MCP 工具并启动服务
   */
  async startServer(verbose?: VerboseLevel, inspector?: boolean): Promise<void> {
    // 如果启用 inspector 模式，使用 npx 启动 inspector
    if (inspector) {
      await this.startWithInspector();
      return;
    }
    if (shouldLog(verbose, 1)) {
      const cwd = process.env.SPACEFLOW_CWD || process.cwd();
      console.error(t("mcp:cwdInfo", { cwd }));
      if (!process.env.SPACEFLOW_CWD) {
        console.error(t("mcp:cwdEnvHint"));
      }
      console.error(t("mcp:scanning"));
    }

    const extensions = this.extensionLoader.getExtensions();
    const extensionTools = this.extensionLoader.getTools();

    if (shouldLog(verbose, 2)) {
      console.error(t("mcp:foundExtensions", { count: extensions.length }));
    }

    const allTools: Array<{ tool: McpToolMetadata; handler: any; ctx: any }> = [];
    for (const { extensionName, tools } of extensionTools) {
      if (shouldLog(verbose, 2)) {
        console.error(`   扩展 ${extensionName} 提供 ${tools.length} 个 MCP 工具`);
      }
      for (const tool of tools) {
        if (shouldLog(verbose, 3)) {
          console.error(`      - ${tool.name}: ${tool.description}`);
        }
        allTools.push({
          tool: {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
              ? (this.zodToJsonSchema(tool.inputSchema) as any)
              : undefined,
            methodName: "handler",
          },
          handler: tool.handler,
          ctx: this.extensionLoader["ctx"],
        });
      }
    }

    if (allTools.length === 0) {
      console.error(t("mcp:noToolsFound"));
      console.error(t("mcp:noToolsHint"));
      process.exit(1);
    }

    if (shouldLog(verbose, 1)) {
      console.error(t("mcp:toolsFound", { count: allTools.length }));
      for (const { tool } of allTools) {
        console.error(`   - ${tool.name}`);
      }
    }

    // 如果 stdin 是 TTY（用户手动在终端运行），只打印信息不阻塞
    if (process.stdin.isTTY) {
      console.error("");
      console.error(t("mcp:ttyHint"));
      return;
    }

    // 被 MCP 客户端通过管道调用，正常启动 stdio server
    await this.runServer(allTools, verbose);
  }

  /**
   * 运行 MCP Server
   */
  private async runServer(
    allTools: Array<{ tool: McpToolMetadata; handler: any; ctx: any }>,
    verbose?: VerboseLevel,
  ): Promise<void> {
    const server = new McpServer({ name: "spaceflow", version: "1.0.0" });

    // 注册所有工具（使用 v2 API: server.registerTool）
    for (const { tool, handler, ctx } of allTools) {
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
            const result = await handler(args || {}, ctx);
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

    // 保持进程运行
    await new Promise<void>((resolve) => {
      process.stdin.on("close", resolve);
      process.on("SIGINT", resolve);
      process.on("SIGTERM", resolve);
    });
  }

  /**
   * 使用 MCP Inspector 启动
   */
  private async startWithInspector(): Promise<void> {
    const args = process.argv.slice(2).filter((arg) => arg !== "--inspector");
    const child = spawn(
      "npx",
      ["-y", "@modelcontextprotocol/inspector", "node", process.argv[1], ...args],
      {
        stdio: "inherit",
        env: { ...process.env, FORCE_COLOR: "1" },
      },
    );
    child.on("exit", (code) => {
      process.exit(code || 0);
    });
  }

  /**
   * 将 Zod schema 转换为 JSON Schema
   */
  private zodToJsonSchema(zodSchema: any): Record<string, any> {
    if (!zodSchema || typeof zodSchema.shape !== "object") {
      return {};
    }
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(zodSchema.shape)) {
      const zodType = value as any;
      let type = "string";
      let description = zodType._def?.description;
      // 检查是否可选
      const isOptional = zodType._def?.typeName === "ZodOptional";
      const innerType = isOptional ? zodType._def?.innerType : zodType;
      // 获取类型
      switch (innerType?._def?.typeName) {
        case "ZodString":
          type = "string";
          break;
        case "ZodNumber":
          type = "number";
          break;
        case "ZodBoolean":
          type = "boolean";
          break;
        case "ZodArray":
          type = "array";
          break;
        default:
          type = "string";
      }
      properties[key] = { type };
      if (description) {
        properties[key].description = description;
      }
      if (!isOptional) {
        required.push(key);
      }
    }
    return { properties, required };
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
