import type { LlmAdapter } from "./adapters";
import { ClaudeCodeAdapter } from "./adapters/claude-code.adapter";
import { OpenAIAdapter } from "./adapters/openai.adapter";
import { OpenCodeAdapter } from "./adapters/open-code.adapter";
import { LlmSessionImpl } from "./llm-session";
import type {
  LlmMessage,
  LlmRequestOptions,
  LlmResponse,
  LlmSession,
  SessionOptions,
  LlmProxyConfig,
  LLMMode,
} from "./interfaces";
import type { LlmJsonPut } from "../llm-jsonput";

export interface ChatOptions extends LlmRequestOptions {
  adapter?: LLMMode;
}

export class LlmProxyService {
  private adapters: Map<LLMMode, LlmAdapter> = new Map();

  constructor(private readonly config: LlmProxyConfig) {
    // 适配器接收完整配置，内部自行读取所需部分
    const claudeCodeAdapter = new ClaudeCodeAdapter(config);
    const openaiAdapter = new OpenAIAdapter(config);
    const openCodeAdapter = new OpenCodeAdapter(config);
    this.adapters.set("claude-code", claudeCodeAdapter);
    this.adapters.set("openai", openaiAdapter);
    this.adapters.set("open-code", openCodeAdapter);
  }

  createSession(adapterType?: LLMMode, options?: SessionOptions): LlmSession {
    const type = adapterType || this.getDefaultAdapterType();
    const adapter = this.getAdapter(type);

    return new LlmSessionImpl(adapter, options);
  }

  async chat(messages: LlmMessage[], options?: ChatOptions): Promise<LlmResponse> {
    const adapterType = options?.adapter || this.getDefaultAdapterType();
    const adapter = this.getAdapter(adapterType);

    if (!adapter.isSupportJsonSchema() && options?.jsonSchema) {
      messages = this.appendJsonSchemaSystemPrompt(messages, options.jsonSchema);
    }

    const response = await adapter.chat(messages, options);

    if (options?.jsonSchema && response.content && !response.structuredOutput) {
      response.structuredOutput = await options.jsonSchema.parse(response.content);
    }

    return response;
  }

  async *chatStream(
    messages: LlmMessage[],
    options?: ChatOptions,
  ): AsyncIterable<import("./interfaces").LlmStreamEvent> {
    const adapterType = options?.adapter || this.getDefaultAdapterType();
    const adapter = this.getAdapter(adapterType);

    if (!adapter.isSupportJsonSchema() && options?.jsonSchema) {
      messages = this.appendJsonSchemaSystemPrompt(messages, options.jsonSchema);
    }

    for await (const event of adapter.chatStream(messages, options)) {
      if (
        event.type === "result" &&
        options?.jsonSchema &&
        event.response.content &&
        !event.response.structuredOutput
      ) {
        try {
          event.response.structuredOutput = await options.jsonSchema.parse(event.response.content);
        } catch (error: any) {
          // JSON 解析失败，保持 structuredOutput 为 undefined
          console.error("[LLMProxyService.chatStream] JSON 解析失败:", error);
        }
      }
      yield event;
    }
  }

  appendJsonSchemaSystemPrompt(messages: LlmMessage[], jsonSchema: LlmJsonPut): LlmMessage[] {
    const systemMsg = messages.find((msg) => msg.role === "system");
    if (jsonSchema.isMatched(systemMsg?.content || "")) {
      return messages;
    }
    if (systemMsg) {
      systemMsg.content += `\n\n${jsonSchema.jsonFormatInstruction}`;
    } else {
      messages.unshift({ role: "system", content: jsonSchema.jsonFormatInstruction });
    }
    return messages;
  }

  getAvailableAdapters(): LLMMode[] {
    const available: LLMMode[] = [];

    for (const [type, adapter] of this.adapters) {
      if (adapter.isConfigured()) {
        available.push(type);
      }
    }

    return available;
  }

  private getDefaultAdapterType(): LLMMode {
    return this.config.defaultAdapter || "openai";
  }

  private getAdapter(type: LLMMode): LlmAdapter {
    const adapter = this.adapters.get(type);

    if (!adapter) {
      throw new Error(`[LLMProxy.getAdapter] 不支持的 LLM 类型: ${type}`);
    }

    if (!adapter.isConfigured()) {
      throw new Error(`[LLMProxy.getAdapter] 适配器 "${type}" 未配置`);
    }

    return adapter;
  }
}
