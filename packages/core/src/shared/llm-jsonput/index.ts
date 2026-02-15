import { jsonrepair } from "jsonrepair";
import type { LlmJsonPutSchema, LlmJsonSchema } from "./types";

export type { LlmJsonPutSchema, LlmJsonSchema, LlmJsonSchemaType } from "./types";

export interface ParseOptions {
  disableRequestRetry?: boolean;
}

export interface LlmJsonPutOptions {
  llmRequest?: (prompt: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  systemPrompt?: string;
}

const JSON_FORMAT_INSTRUCTION = `请严格以 JSON 格式输出结果，不要输出任何其他内容，格式如下：`;

export class LlmJsonPut<T = any> {
  public readonly jsonFormatInstruction: string;
  constructor(
    protected schema: LlmJsonPutSchema,
    protected opts?: LlmJsonPutOptions,
  ) {
    this.jsonFormatInstruction = this.getJsonFormatInstruction(schema);
  }

  isMatched(prompt: string): boolean {
    return prompt.includes(JSON_FORMAT_INSTRUCTION);
  }

  getSchema(): Record<string, unknown> {
    return this.schema as unknown as Record<string, unknown>;
  }

  getJsonFormatInstruction(schema: LlmJsonPutSchema): string {
    const generateExample = (s: LlmJsonSchema): any => {
      if (s.type === "object") {
        const obj: any = {};
        for (const [key, value] of Object.entries(s.properties || {})) {
          obj[key] = generateExample(value);
        }
        return obj;
      } else if (s.type === "array") {
        return [generateExample(s.items!)];
      }
      return s.description || `<${s.type}>`;
    };

    const example = JSON.stringify(generateExample(schema), null, 2);

    return `${JSON_FORMAT_INSTRUCTION}\n\`\`\`json\n${example}\`\`\`\n注意：只输出 JSON，不要包含 markdown 代码块或其他文字。`;
  }

  async parse(input: string, opts?: ParseOptions): Promise<T> {
    let content = input.trim();

    // 尝试移除 markdown 代码块
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      try {
        return JSON.parse(content);
      } catch {
        // 如果原生解析失败，尝试修复
        const repaired = jsonrepair(content);
        return JSON.parse(repaired);
      }
    } catch (err) {
      // 如果以上都不行就都丢给大模型，然后在重新走parse，但是要记录重新执行的次数，最多5次
      let retryCount = 0;
      while (retryCount < 5 && !opts?.disableRequestRetry) {
        const response = await this.request(input);
        return response;
      }
      throw new Error(
        `无法解析或修复 LLM 返回的 JSON: ${err instanceof Error ? err.message : String(err)}\n原始内容: ${input}`,
      );
    }
  }

  async request(userPrompt: string): Promise<T> {
    if (!this.opts?.llmRequest) {
      throw new Error("未配置 llmRequest 方法，无法发起请求");
    }

    const systemPrompt = `${this.opts.systemPrompt ? this.opts.systemPrompt + "\n" : ""}${this.jsonFormatInstruction}`;
    const response = await this.opts.llmRequest({
      systemPrompt,
      userPrompt,
    });
    return this.parse(response, { disableRequestRetry: true });
  }
}
