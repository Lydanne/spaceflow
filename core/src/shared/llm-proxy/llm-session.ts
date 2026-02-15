import { randomUUID } from "crypto";
import type { LlmAdapter } from "./adapters";
import type {
  LlmMessage,
  LlmRequestOptions,
  LlmResponse,
  LlmStreamEvent,
  LlmSession,
  SessionOptions,
} from "./interfaces";
import { type VerboseLevel, normalizeVerbose } from "../verbose";

export class LlmSessionImpl implements LlmSession {
  readonly id: string;
  readonly adapterName: string;

  private history: LlmMessage[] = [];
  private systemPrompt: string = "";
  private defaultModel?: string;
  private verbose: VerboseLevel = 0;

  constructor(
    private readonly adapter: LlmAdapter,
    options?: SessionOptions,
  ) {
    this.id = randomUUID();
    this.adapterName = adapter.name;

    if (options?.systemPrompt) {
      this.systemPrompt = options.systemPrompt;
    }
    if (options?.model) {
      this.defaultModel = options.model;
    }
    if (options?.verbose !== undefined) {
      this.verbose = normalizeVerbose(options.verbose);
    }
  }

  async send(content: string, options?: LlmRequestOptions): Promise<LlmResponse> {
    const userMessage: LlmMessage = { role: "user", content };
    this.history.push(userMessage);

    const messages = this.buildMessages();
    const mergedOptions = this.mergeOptions(options);

    const response = await this.adapter.chat(messages, mergedOptions);

    const assistantMessage: LlmMessage = { role: "assistant", content: response.content };
    this.history.push(assistantMessage);

    return response;
  }

  async *sendStream(content: string, options?: LlmRequestOptions): AsyncIterable<LlmStreamEvent> {
    const userMessage: LlmMessage = { role: "user", content };
    this.history.push(userMessage);

    const messages = this.buildMessages();
    const mergedOptions = this.mergeOptions(options);

    let fullContent = "";

    for await (const event of this.adapter.chatStream(messages, mergedOptions)) {
      yield event;

      if (event.type === "text") {
        fullContent += event.content;
      } else if (event.type === "result") {
        fullContent = event.response.content;
      }
    }

    const assistantMessage: LlmMessage = { role: "assistant", content: fullContent };
    this.history.push(assistantMessage);
  }

  getHistory(): LlmMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  private buildMessages(): LlmMessage[] {
    const messages: LlmMessage[] = [];

    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt });
    }

    messages.push(...this.history);

    return messages;
  }

  private mergeOptions(options?: LlmRequestOptions): LlmRequestOptions {
    return {
      model: options?.model || this.defaultModel,
      verbose: options?.verbose ?? this.verbose,
      ...options,
    };
  }
}
