import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { SpaceflowConfigSchema } from "./spaceflow.config";

/** Schema 注册信息 */
export interface SchemaRegistry {
  /** 配置 key */
  configKey: string;
  /** zod schema 工厂函数 */
  schemaFactory: () => z.ZodType;
  /** 描述 */
  description?: string;
}

/** 全局 schema 注册表 */
const schemaRegistry = new Map<string, SchemaRegistry>();

/**
 * 注册插件配置 schema（由插件加载器调用）
 */
export function registerPluginSchema(registry: SchemaRegistry): void {
  schemaRegistry.set(registry.configKey, registry);
}

/**
 * 获取所有已注册的 schema
 */
export function getRegisteredSchemas(): Map<string, SchemaRegistry> {
  return schemaRegistry;
}

function toConfigInputSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, {
    target: "draft-07",
    io: "input",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema instanceof z.core.$ZodTuple) {
        const { items, rest } = zodSchema._zod.def;
        // draft-07 的 items 数组只约束各位置的类型，仍需显式声明长度。
        const requiredLength = items.reduce(
          (length, item, index) => (item._zod.optin === "optional" ? length : index + 1),
          0,
        );
        jsonSchema.minItems = Math.max(jsonSchema.minItems ?? 0, requiredLength);
        if (!rest)
          jsonSchema.maxItems = Math.min(jsonSchema.maxItems ?? items.length, items.length);
      }
    },
  });
}

/**
 * Schema 生成服务
 * 用于生成 JSON Schema 文件
 */
export class SchemaGeneratorService {
  /**
   * 生成完整的 spaceflow.json 的 JSON Schema
   * @param outputPath 输出路径
   */
  generateJsonSchema(outputPath: string): void {
    // 从 SpaceflowConfigSchema 生成基础 JSON Schema
    const baseSchema = toConfigInputSchema(SpaceflowConfigSchema) as {
      properties?: Record<string, unknown>;
      [key: string]: unknown;
    };

    const properties: Record<string, unknown> = { ...baseSchema.properties };

    // 添加所有插件的 schema（扩展插件配置）
    for (const [configKey, registry] of schemaRegistry) {
      try {
        const schema = registry.schemaFactory();
        const jsonSchema = toConfigInputSchema(schema);
        properties[configKey] = {
          ...jsonSchema,
          description: registry.description || `${configKey} 插件配置`,
        };
      } catch (error) {
        console.warn(`⚠️ 无法转换 ${configKey} 的 schema:`, error);
      }
    }

    const fullSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Spaceflow Configuration",
      description: "Spaceflow 配置文件 schema",
      type: "object",
      properties,
      additionalProperties: true,
    };

    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(outputPath, JSON.stringify(fullSchema, null, 2), "utf-8");

    // 自动添加到 .gitignore
    this.addToGitignore(dir, path.basename(outputPath));
  }

  /**
   * 生成 JSON Schema 到默认路径 (.spaceflow/config-schema.json)
   */
  generate(): void {
    const cwd = process.env.SPACEFLOW_CWD || process.cwd();
    const outputPath = path.join(cwd, ".spaceflow", "config-schema.json");
    this.generateJsonSchema(outputPath);
  }

  /**
   * 将文件添加到 .gitignore（如果不存在）
   */
  private addToGitignore(dir: string, filename: string): void {
    const gitignorePath = path.join(dir, ".gitignore");
    let content = "";

    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, "utf-8");
      // 检查是否已存在
      const lines = content.split("\n").map((line) => line.trim());
      if (lines.includes(filename)) {
        return;
      }
    } else {
      content = "# 自动生成的 .gitignore\n";
    }

    // 追加文件名
    const newContent = content.endsWith("\n")
      ? `${content}${filename}\n`
      : `${content}\n${filename}\n`;

    fs.writeFileSync(gitignorePath, newContent, "utf-8");
  }
}
