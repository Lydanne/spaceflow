import { defineExtension, SchemaGeneratorService } from "@spaceflow/core";

/**
 * Schema 命令扩展
 */
export const schemaExtension = defineExtension({
  name: "schema",
  version: "1.0.0",
  description: "生成 schema",
  commands: [
    {
      name: "schema",
      description: "生成 JSON Schema 配置文件",
      options: [
        {
          flags: "-o, --output <path>",
          description: "输出路径",
        },
      ],
      run: async (_args, options, _ctx) => {
        const schemaGenerator = new SchemaGeneratorService();
        if (options?.output) {
          schemaGenerator.generateJsonSchema(options.output as string);
        } else {
          schemaGenerator.generate();
        }
      },
    },
  ],
});
