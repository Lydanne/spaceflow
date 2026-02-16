/**
 * MCP (Model Context Protocol) 支持模块
 *
 * 提供装饰器和基础设施，用于在服务中定义 MCP 工具
 *
 * 使用方式：
 * ```typescript
 * class ListRulesInput {
 *   @ApiPropertyOptional({ description: "项目目录" })
 *   @IsString()
 *   @IsOptional()
 *   cwd?: string;
 * }
 *
 * @McpServer({ name: "review-rules", version: "1.0.0" })
 * export class ReviewMcpService {
 *   @McpTool({
 *     name: "list_rules",
 *     description: "获取所有审查规则",
 *     dto: ListRulesInput,
 *   })
 *   async listRules(input: ListRulesInput) {
 *     return { rules: [...] };
 *   }
 * }
 * ```
 */

import "reflect-metadata";

/** MCP 服务元数据 key（使用 Symbol 确保唯一性） */
export const MCP_SERVER_METADATA = Symbol.for("spaceflow:mcp:server");

/** MCP 工具元数据 key（使用 Symbol 确保唯一性） */
export const MCP_TOOL_METADATA = Symbol.for("spaceflow:mcp:tool");

/** JSON Schema 类型 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema & { description?: string }>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
}

/** MCP 服务定义 */
export interface McpServerDefinition {
  /** 服务名称 */
  name: string;
  /** 服务版本 */
  version?: string;
  /** 服务描述 */
  description?: string;
}

/** Swagger 元数据常量 */
const SWAGGER_API_MODEL_PROPERTIES = "swagger/apiModelProperties";
const SWAGGER_API_MODEL_PROPERTIES_ARRAY = "swagger/apiModelPropertiesArray";

/**
 * 从 @nestjs/swagger 的 @ApiProperty / @ApiPropertyOptional 元数据生成 JSON Schema
 * 直接读取 swagger 装饰器存储的 reflect-metadata，无需自定义装饰器
 */
export function dtoToJsonSchema(dtoClass: new (...args: any[]) => any): JsonSchema {
  const prototype = dtoClass.prototype;

  // 读取属性名列表（swagger 存储格式为 ":propertyName"）
  const propertyKeys: string[] = (
    Reflect.getMetadata(SWAGGER_API_MODEL_PROPERTIES_ARRAY, prototype) || []
  ).map((key: string) => key.replace(/^:/, ""));

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const key of propertyKeys) {
    const meta = Reflect.getMetadata(SWAGGER_API_MODEL_PROPERTIES, prototype, key) || {};

    // 推断 JSON Schema type
    const typeMap: Record<string, string> = {
      String: "string",
      Number: "number",
      Boolean: "boolean",
      Array: "array",
      Object: "object",
    };

    let schemaType = meta.type;
    // meta.type 可能是构造函数（如 Boolean）或字符串（如 "boolean"）
    if (typeof schemaType === "function") {
      schemaType = typeMap[schemaType.name] || "string";
    }
    // 如果 swagger 没有显式 type，从 class-validator 元数据推断
    if (!schemaType) {
      try {
        const { getMetadataStorage } = require("class-validator");
        const validationMetas = getMetadataStorage().getTargetValidationMetadatas(
          dtoClass,
          "",
          false,
          false,
        );
        const validatorTypeMap: Record<string, string> = {
          isString: "string",
          isNumber: "number",
          isBoolean: "boolean",
          isArray: "array",
          isObject: "object",
          isInt: "number",
          isEnum: "string",
        };
        const propMeta = validationMetas.find(
          (m: any) => m.propertyName === key && validatorTypeMap[m.name],
        );
        if (propMeta) {
          schemaType = validatorTypeMap[propMeta.name];
        }
      } catch {
        // class-validator 不可用时忽略
      }
    }
    // 最后从 reflect-metadata 的 design:type 推断
    if (!schemaType) {
      const reflectedType = Reflect.getMetadata("design:type", prototype, key);
      if (reflectedType) {
        schemaType = typeMap[reflectedType.name] || "string";
      }
    }

    const prop: Record<string, any> = {};
    if (schemaType) prop.type = schemaType;
    if (meta.description) prop.description = meta.description;
    if (meta.default !== undefined) prop.default = meta.default;
    if (meta.enum) prop.enum = meta.enum;
    if (meta.example !== undefined) prop.example = meta.example;

    properties[key] = prop;

    // required 判断：swagger 的 @ApiProperty 默认 required=true，@ApiPropertyOptional 为 false
    if (meta.required !== false) {
      required.push(key);
    }
  }

  const schema: JsonSchema = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

/** MCP 工具定义 */
export interface McpToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数 schema (JSON Schema 格式，与 dto 二选一) */
  inputSchema?: JsonSchema;
  /** 输入参数 DTO 类（与 inputSchema 二选一，优先级高于 inputSchema） */
  dto?: new (...args: any[]) => any;
}

/** 存储的工具元数据 */
export interface McpToolMetadata extends McpToolDefinition {
  /** 方法名 */
  methodName: string;
}

/**
 * MCP 服务装饰器
 * 标记一个类为 MCP 服务，内部自动应用 @Injectable()
 *
 * @example
 * ```typescript
 * @McpServer({ name: "review-rules", version: "1.0.0" })
 * export class ReviewMcpService {
 *   @McpTool({ name: "list_rules", description: "获取规则" })
 *   async listRules() { ... }
 * }
 * ```
 */
export function McpServer(definition: McpServerDefinition): ClassDecorator {
  return (target: Function) => {
    // 使用静态属性存储元数据（跨模块可访问）
    (target as any).__mcp_server__ = definition;
  };
}

/**
 * MCP 工具装饰器
 * 标记一个方法为 MCP 工具
 */
export function McpTool(definition: McpToolDefinition): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const constructor = target.constructor as any;
    // 使用静态属性存储工具列表（跨模块可访问）
    if (!constructor.__mcp_tools__) {
      constructor.__mcp_tools__ = [];
    }

    // 如果提供了 dto，自动从 swagger 元数据生成 inputSchema
    const resolvedDefinition = { ...definition };
    if (resolvedDefinition.dto) {
      resolvedDefinition.inputSchema = dtoToJsonSchema(resolvedDefinition.dto);
    }

    constructor.__mcp_tools__.push({
      ...resolvedDefinition,
      methodName: String(propertyKey),
    });
  };
}

/**
 * 检查一个类是否是 MCP 服务
 */
export function isMcpServer(target: any): boolean {
  const constructor = target?.constructor || target;
  return !!constructor?.__mcp_server__;
}

/**
 * 获取 MCP 服务元数据
 */
export function getMcpServerMetadata(target: any): McpServerDefinition | undefined {
  const constructor = target?.constructor || target;
  return constructor?.__mcp_server__;
}

/**
 * 从服务类获取所有 MCP 工具定义
 */
export function getMcpTools(target: any): McpToolMetadata[] {
  const constructor = target?.constructor || target;
  return constructor?.__mcp_tools__ || [];
}

/**
 * MCP Server 运行器
 * 收集服务中的 MCP 工具并启动 stdio 服务
 */
export async function runMcpServer(
  service: any,
  serverInfo: { name: string; version: string },
): Promise<void> {
  const tools = getMcpTools(service);

  if (tools.length === 0) {
    console.error("没有找到 MCP 工具定义");
    process.exit(1);
  }

  // 动态导入 MCP SDK（避免在不需要时加载）
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

  const server = new McpServer(serverInfo);

  // 注册所有工具（使用 v1 API: server.tool）
  for (const tool of tools) {
    // v1 API: server.tool(name, description, schema, callback)
    // 使用工具定义中的 inputSchema 转为 zod，如果没有则传空对象
    const schema = tool.inputSchema ? jsonSchemaToZod(tool.inputSchema) : {};
    server.tool(tool.name, tool.description, schema, async (args: any) => {
      try {
        const result = await service[tool.methodName](args || {});
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
    });
  }

  /**
   * 将 JSON Schema 转换为简单的 zod 对象（MCP SDK 需要 zod）
   * 仅处理顶层 properties，满足 MCP 工具注册需求
   */
  function jsonSchemaToZod(jsonSchema: JsonSchema): Record<string, any> {
    const { z } = require("zod") as typeof import("zod");
    if (!jsonSchema.properties) return {};

    const shape: Record<string, any> = {};
    const requiredFields = jsonSchema.required || [];

    for (const [key, prop] of Object.entries(jsonSchema.properties)) {
      let field: any;
      switch (prop.type) {
        case "number":
          field = z.number();
          break;
        case "boolean":
          field = z.boolean();
          break;
        case "array":
          field = z.array(z.any());
          break;
        case "object":
          field = z.object({});
          break;
        default:
          field = z.string();
      }
      if (prop.description) field = field.describe(prop.description);
      if (!requiredFields.includes(key)) field = field.optional();
      shape[key] = field;
    }

    return shape;
  }

  // 启动 stdio 传输
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`MCP Server "${serverInfo.name}" started with ${tools.length} tools`);
}
