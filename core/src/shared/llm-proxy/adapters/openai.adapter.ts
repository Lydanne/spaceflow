import { Injectable, Inject } from "@nestjs/common";
import OpenAI from "openai";
import type { LlmAdapter } from "./llm-adapter.interface";
import type {
  LlmMessage,
  LlmRequestOptions,
  LlmResponse,
  LlmStreamEvent,
  LlmProxyConfig,
} from "../interfaces";
import { shouldLog } from "../../verbose";

@Injectable()
export class OpenAIAdapter implements LlmAdapter {
  readonly name = "openai";

  private client: OpenAI | null = null;

  constructor(@Inject("LLM_PROXY_CONFIG") private readonly config: LlmProxyConfig) {}

  isConfigured(): boolean {
    return !!this.config.openai;
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const openaiConf = this.config.openai;

    if (!openaiConf) {
      throw new Error("[LLMProxy.OpenAIAdapter.getClient] 未配置 openai 设置");
    }

    this.client = new OpenAI({
      apiKey: openaiConf.apiKey,
      baseURL: openaiConf.baseUrl || undefined,
    });

    return this.client;
  }

  async chat(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse> {
    const openaiConf = this.config.openai;

    if (!openaiConf) {
      throw new Error("[LLMProxy.OpenAIAdapter.chat] 未配置 openai 设置");
    }

    const client = this.getClient();
    const model = options?.model || openaiConf.model;

    if (shouldLog(options?.verbose, 1)) {
      console.log(
        `[LLMProxy.OpenAIAdapter.chat] 配置: Model=${model}, BaseURL=${openaiConf.baseUrl || "(默认)"}`,
      );
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages: messages,
      });

      const content = response.choices[0]?.message?.content || "";

      if (shouldLog(options?.verbose, 1)) {
        console.log(
          `[LLMProxy.OpenAIAdapter.chat] 响应: Model=${response.model}, Usage=${response.usage?.total_tokens} tokens`,
        );
      }

      return {
        content,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(
          `[LLMProxy.OpenAIAdapter.chat] API 错误 (${error.status}): ${error.message}\n` +
            `请检查：\n` +
            `1. API Key 是否正确\n` +
            `2. Base URL 是否正确\n` +
            `3. 模型名称是否有效`,
        );
      }
      throw error;
    }
  }

  async *chatStream(
    messages: LlmMessage[],
    options?: LlmRequestOptions,
  ): AsyncIterable<LlmStreamEvent> {
    const openaiConf = this.config.openai;

    if (!openaiConf) {
      yield { type: "error", message: "[LLMProxy.OpenAIAdapter.chatStream] 未配置 openai 设置" };
      return;
    }

    const client = this.getClient();
    const model = options?.model || openaiConf.model;

    if (shouldLog(options?.verbose, 1)) {
      console.log(`[LLMProxy.OpenAIAdapter.chatStream] 配置: Model=${model}`);
    }
    try {
      const stream = await client.chat.completions.create({
        model,
        messages: messages,
        stream: true,
      });

      let fullContent = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "text", content: delta };
          fullContent += delta;
        }
      }

      yield {
        type: "result",
        response: {
          content: fullContent,
        },
      };
    } catch (error: any) {
      if (error instanceof OpenAI.APIError) {
        yield {
          type: "error",
          message: `[LLMProxy.OpenAIAdapter.chatStream] API 错误 (${error.status}): ${error.message}`,
        };
      } else {
        throw error;
      }
    }
  }

  isSupportJsonSchema(): boolean {
    return false;
  }
}
