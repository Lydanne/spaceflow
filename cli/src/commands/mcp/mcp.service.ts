import { Injectable, t } from "@spaceflow/core";
import type { VerboseLevel } from "@spaceflow/core";
import { shouldLog, type McpToolMetadata } from "@spaceflow/core";
import { ModuleRef } from "@nestjs/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ExtensionLoaderService } from "../../extension-loader/extension-loader.service";

@Injectable()
export class McpService {
  constructor(
    private readonly extensionLoader: ExtensionLoaderService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * 启动 MCP Server
   * 扫描所有已安装的扩展，收集 MCP 工具并启动服务
   */
  async startServer(verbose?: VerboseLevel): Promise<void> {
    if (shouldLog(verbose, 1)) {
      console.error(t("mcp:scanning"));
    }

    // 加载所有扩展
    const extensions = await this.extensionLoader.discoverAndLoad();
    const allTools: Array<{ tool: McpToolMetadata; provider: any }> = [];

    if (shouldLog(verbose, 2)) {
      console.error(t("mcp:foundExtensions", { count: extensions.length }));
      for (const ext of extensions) {
        const exportKeys = ext.exports ? Object.keys(ext.exports) : [];
        console.error(`   - ${ext.name}: exports=[${exportKeys.join(", ")}]`);
      }
    }

    // 收集所有扩展的 MCP 工具
    for (const ext of extensions) {
      try {
        // 使用包的完整导出（而不是 NestJS 模块）
        const packageExports = ext.exports || {};

        // 扫描模块导出，查找带有 @McpServer 装饰器的类
        for (const key of Object.keys(packageExports)) {
          const exported = packageExports[key];

          // 直接检查静态属性（跨模块可访问）
          const hasMcpServer = !!(exported as any)?.__mcp_server__;

          if (shouldLog(verbose, 2) && typeof exported === "function") {
            console.error(t("mcp:checkingExport", { key, hasMcpServer }));
          }

          // 检查是否是带有 @McpServer 装饰器的类
          if (typeof exported === "function" && hasMcpServer) {
            try {
              // 优先从 NestJS 容器获取实例（支持依赖注入）
              let instance: any;
              try {
                instance = this.moduleRef.get(exported, { strict: false });
                if (shouldLog(verbose, 2)) {
                  console.error(t("mcp:containerSuccess", { key }));
                }
              } catch (diError) {
                // 容器中没有，尝试直接实例化（可能缺少依赖）
                if (shouldLog(verbose, 2)) {
                  console.error(
                    t("mcp:containerFailed", {
                      key,
                      error: diError instanceof Error ? diError.message : diError,
                    }),
                  );
                }
                instance = new (exported as any)();
              }

              // 直接读取静态属性获取工具和元数据
              const tools: McpToolMetadata[] = (exported as any).__mcp_tools__ || [];
              const serverMeta = (exported as any).__mcp_server__;

              for (const tool of tools) {
                allTools.push({ tool, provider: instance });
              }

              if (shouldLog(verbose, 1) && tools.length > 0) {
                const serverName = serverMeta?.name || ext.name;
                console.error(`   📦 ${serverName}: ${tools.map((t) => t.name).join(", ")}`);
              }
            } catch {
              // 实例化失败
            }
          }
        }
      } catch (error) {
        if (shouldLog(verbose, 2)) {
          console.error(t("mcp:loadToolsFailed", { name: ext.name }), error);
        }
      }
    }

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
