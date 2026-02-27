import { t } from "@spaceflow/core";
import type { VerboseLevel, McpResourceDefinition, SpaceflowContext } from "@spaceflow/core";
import { shouldLog, type McpToolMetadata } from "@spaceflow/core";
import { readConfigSync } from "@spaceflow/shared";
import type { ExtensionLoader } from "../../cli-runtime/extension-loader";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";

/** 内部 resource 收集结构 */
interface CollectedResource {
  resource: McpResourceDefinition;
  ctx: SpaceflowContext;
}

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
      const cwd = this.extensionLoader.cwd;
      console.error(t("mcp:cwdInfo", { cwd }));
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
          ctx: this.extensionLoader.getContext(),
        });
      }
    }

    // 收集扩展 resources + 内置 resources
    const allResources = this.collectResources(verbose);

    if (allTools.length === 0 && allResources.length === 0) {
      console.error(t("mcp:noToolsFound"));
      console.error(t("mcp:noToolsHint"));
      process.exit(1);
    }

    if (shouldLog(verbose, 1)) {
      if (allTools.length > 0) {
        console.error(t("mcp:toolsFound", { count: allTools.length }));
        for (const { tool } of allTools) {
          console.error(`   - ${tool.name}`);
        }
      }
      if (allResources.length > 0) {
        console.error(t("mcp:resourcesFound", { count: allResources.length }));
        for (const { resource } of allResources) {
          console.error(`   - ${resource.name} (${resource.uri})`);
        }
      }
    }

    // 如果 stdin 是 TTY（用户手动在终端运行），只打印信息不阻塞
    if (process.stdin.isTTY) {
      console.error("");
      console.error(t("mcp:ttyHint"));
      return;
    }

    // 被 MCP 客户端通过管道调用，正常启动 stdio server
    await this.runServer(allTools, allResources, verbose);
  }

  /**
   * 收集所有 MCP 资源（扩展 + 内置）
   */
  private collectResources(verbose?: VerboseLevel): CollectedResource[] {
    const ctx = this.extensionLoader.getContext();
    const allResources: CollectedResource[] = [];

    // 1. 收集扩展声明的 resources
    const extensionResources = this.extensionLoader.getResources();
    for (const { extensionName, resources } of extensionResources) {
      if (shouldLog(verbose, 2)) {
        console.error(`   扩展 ${extensionName} 提供 ${resources.length} 个 MCP 资源`);
      }
      for (const resource of resources) {
        allResources.push({ resource, ctx });
      }
    }

    // 2. 内置资源：项目配置（过滤敏感字段）
    allResources.push({
      resource: {
        name: "spaceflow-config",
        uri: "spaceflow://config",
        title: "Spaceflow Configuration",
        description: "当前项目的 Spaceflow 配置（已过滤敏感字段）",
        mimeType: "application/json",
        handler: async (_uri, ctx) => {
          const config = readConfigSync(ctx.cwd);
          return JSON.stringify(this.sanitizeConfig(config), null, 2);
        },
      },
      ctx,
    });

    // 3. 内置资源：扩展列表
    allResources.push({
      resource: {
        name: "spaceflow-extensions",
        uri: "spaceflow://extensions",
        title: "Installed Extensions",
        description: "当前项目已安装的 Spaceflow 扩展及其工具/资源",
        mimeType: "application/json",
        handler: async () => {
          const extensions = this.extensionLoader.getExtensions();
          const summary = extensions.map((ext) => ({
            name: ext.name,
            version: ext.version,
            description: ext.description,
            commands: ext.commands.map((c) => c.name),
            tools: (ext.tools || []).map((t) => ({ name: t.name, description: t.description })),
            resources: (ext.resources || []).map((r) => ({
              name: r.name,
              uri: r.uri,
              description: r.description,
            })),
          }));
          return JSON.stringify(summary, null, 2);
        },
      },
      ctx,
    });

    return allResources;
  }

  /**
   * 过滤配置中的敏感字段
   */
  private sanitizeConfig(config: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ["token", "apiKey", "appSecret", "authToken", "apikey", "secret"];
    const sanitize = (obj: any): any => {
      if (obj === null || obj === undefined || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
          result[key] = value ? "***" : "";
        } else {
          result[key] = sanitize(value);
        }
      }
      return result;
    };
    return sanitize(config);
  }

  /**
   * 运行 MCP Server
   */
  private async runServer(
    allTools: Array<{ tool: McpToolMetadata; handler: any; ctx: any }>,
    allResources: CollectedResource[],
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

    // 注册所有资源（使用 v2 API: server.registerResource）
    for (const { resource, ctx } of allResources) {
      server.registerResource(
        resource.name,
        resource.uri,
        {
          title: resource.title,
          description: resource.description,
          mimeType: resource.mimeType || "application/json",
        },
        async (uri) => {
          try {
            const text = await resource.handler(uri.href, ctx);
            return {
              contents: [
                {
                  uri: uri.href,
                  mimeType: resource.mimeType || "application/json",
                  text,
                },
              ],
            };
          } catch (error) {
            return {
              contents: [
                {
                  uri: uri.href,
                  mimeType: "text/plain",
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
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
