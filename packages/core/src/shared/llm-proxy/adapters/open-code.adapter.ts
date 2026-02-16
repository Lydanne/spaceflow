import { createOpencode } from "@opencode-ai/sdk";
import type { LlmAdapter } from "./llm-adapter.interface";
import type {
  LlmMessage,
  LlmRequestOptions,
  LlmResponse,
  LlmStreamEvent,
  LlmProxyConfig,
  OpenCodeAdapterConfig,
} from "../interfaces";
import { shouldLog } from "../../verbose";

export class OpenCodeAdapter implements LlmAdapter {
  readonly name = "open-code";

  constructor(private readonly config: LlmProxyConfig) {}

  isConfigured(): boolean {
    return !!this.config.openCode;
  }

  async chat(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse> {
    let result: LlmResponse = { content: "" };

    for await (const event of this.chatStream(messages, options)) {
      if (event.type === "result") {
        result = event.response;
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    return result;
  }

  async *chatStream(
    messages: LlmMessage[],
    options?: LlmRequestOptions,
  ): AsyncIterable<LlmStreamEvent> {
    const openCodeConf = this.config.openCode;

    if (!openCodeConf) {
      yield {
        type: "error",
        message: "[LLMProxy.OpenCodeAdapter.chatStream] 未配置 openCode 设置",
      };
      return;
    }

    const providerID = openCodeConf.providerID || "openai";
    const configModel = options?.model || openCodeConf.model || "gpt-4o";
    const model = configModel.includes("/") ? configModel : `${providerID}/${configModel}`;

    if (shouldLog(options?.verbose, 1)) {
      console.log(
        `[LLMProxy.OpenCodeAdapter.chatStream] 配置: Model=${model}, ProviderID=${providerID}, BaseURL=${openCodeConf.baseUrl || "默认"}`,
      );
    }

    // 创建 OpenCode 实例（自动启动服务器，使用动态端口避免冲突）
    let opencode: Awaited<ReturnType<typeof createOpencode>> | null = null;
    const port = 4096 + Math.floor(Math.random() * 1000);

    // 确保进程退出时关闭服务器
    const cleanup = () => {
      if (opencode?.server) {
        opencode.server.close();
        opencode = null;
      }
    };
    process.once("exit", cleanup);
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);

    try {
      opencode = await createOpencode({
        port,
        config: this.buildOpenCodeConfig(openCodeConf, model),
      });

      const { client } = opencode;

      // 设置 provider 认证（使用自定义 provider ID）
      const customProviderID = "custom-openai";
      if (openCodeConf.apiKey) {
        await client.auth.set({
          path: { id: customProviderID },
          body: { type: "api", key: openCodeConf.apiKey },
        });
      }

      const session = await client.session.create({
        body: { title: `spaceflow-${Date.now()}` },
      });

      if (!session.data?.id) {
        yield {
          type: "error",
          message: "[LLMProxy.OpenCodeAdapter.chatStream] 创建 session 失败",
        };
        return;
      }

      const sessionId = session.data.id;
      const systemPrompt = this.extractSystemPrompt(messages);
      const userPrompt = this.extractUserPrompt(messages);

      if (systemPrompt) {
        await client.session.prompt({
          path: { id: sessionId },
          body: {
            noReply: true,
            parts: [{ type: "text", text: systemPrompt }],
          },
        });
      }

      // 从原始 model 中提取 modelID，但使用自定义 provider ID
      const [, modelID] = model.includes("/") ? model.split("/", 2) : [customProviderID, model];

      if (shouldLog(options?.verbose, 2)) {
        console.log(
          `[LLMProxy.OpenCodeAdapter.chatStream] 发送 prompt: model=${customProviderID}/${modelID}, userPrompt长度=${userPrompt.length}`,
        );
      }

      const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
          model: { providerID: customProviderID, modelID },
          parts: [{ type: "text", text: userPrompt }],
        },
      });

      if (shouldLog(options?.verbose, 2)) {
        console.log(
          `[LLMProxy.OpenCodeAdapter.chatStream] 完整响应对象:\n${JSON.stringify(result, null, 2)}`,
        );
        console.log(
          `[LLMProxy.OpenCodeAdapter.chatStream] result.data:\n${JSON.stringify(result.data, null, 2)}`,
        );
      }

      let finalContent = "";

      if (result.data?.parts) {
        for (const part of result.data.parts) {
          const partType = part.type;

          switch (partType) {
            case "text": {
              const text = (part as any).text || "";
              yield { type: "text", content: text };
              finalContent += text;
              break;
            }

            case "tool": {
              // 工具调用（ToolPart）
              const toolPart = part as any;
              const state = toolPart.state || {};
              yield {
                type: "tool_use",
                name: toolPart.tool || "unknown",
                input: state.input || {},
                status: state.status,
                output: state.output,
                title: state.title,
              };
              break;
            }

            case "agent": {
              // 子代理调用（AgentPart）
              const agentPart = part as any;
              yield {
                type: "agent",
                name: agentPart.name || "unknown",
                source: agentPart.source?.value,
              };
              break;
            }

            case "subtask": {
              // 子任务
              const subtaskPart = part as any;
              yield {
                type: "subtask",
                agent: subtaskPart.agent,
                prompt: subtaskPart.prompt,
                description: subtaskPart.description,
              };
              break;
            }

            case "step-start": {
              yield {
                type: "step_start",
                snapshot: (part as any).snapshot,
              };
              break;
            }

            case "step-finish": {
              const stepPart = part as any;
              yield {
                type: "step_finish",
                reason: stepPart.reason,
                tokens: stepPart.tokens,
                cost: stepPart.cost,
              };
              break;
            }

            case "reasoning": {
              const reasoningPart = part as any;
              yield {
                type: "reasoning",
                content: reasoningPart.text || "",
              };
              break;
            }

            default:
              // 其他类型（file, snapshot, patch, retry, compaction 等）暂不处理
              if (shouldLog(options?.verbose, 2)) {
                console.log(
                  `[LLMProxy.OpenCodeAdapter.chatStream] 未处理的 part 类型: ${partType}`,
                );
              }
              break;
          }
        }
      }

      if (shouldLog(options?.verbose, 1) && !finalContent) {
        console.warn(
          `[LLMProxy.OpenCodeAdapter.chatStream] 警告: 响应内容为空，parts=${JSON.stringify(result.data?.parts)}`,
        );
      }

      yield {
        type: "result",
        response: {
          content: finalContent,
        },
      };

      try {
        await client.session.delete({ path: { id: sessionId } });
      } catch {
        // ignore cleanup errors
      }
    } catch (error: any) {
      yield {
        type: "error",
        message:
          `[LLMProxy.OpenCodeAdapter.chatStream] 错误: ${error.message}\n` +
          `请检查：\n` +
          `1. baseUrl 配置是否正确\n` +
          `2. apiKey 是否有效\n` +
          `3. 模型配置是否有效`,
      };
    } finally {
      // 移除事件监听器
      process.removeListener("exit", cleanup);
      process.removeListener("SIGINT", cleanup);
      process.removeListener("SIGTERM", cleanup);
      // 关闭服务器
      cleanup();
    }
  }

  /**
   * 构建 OpenCode 配置
   */
  private buildOpenCodeConfig(
    openCodeConf: OpenCodeAdapterConfig,
    model: string,
  ): Record<string, any> {
    // 使用自定义 provider ID（如 custom-openai）而不是 openai
    // 因为 OpenCode 会根据 providerID 决定使用哪个 SDK 方法
    // openai provider 会调用 sdk.responses()，而自定义 provider 使用 @ai-sdk/openai-compatible
    const customProviderID = "custom-openai";
    const [, modelID] = model.includes("/") ? model.split("/", 2) : [customProviderID, model];

    // 使用 @ai-sdk/openai-compatible，使用 Chat Completions API (/chat/completions)
    const config: Record<string, any> = {
      model: `${customProviderID}/${modelID}`,
      provider: {
        [customProviderID]: {
          npm: "@ai-sdk/openai-compatible",
          name: "Custom OpenAI Compatible",
        },
      },
    };

    // 配置 provider baseURL
    if (openCodeConf.baseUrl) {
      config.provider[customProviderID].options = {
        baseURL: openCodeConf.baseUrl,
      };
    }

    // 注册自定义模型
    config.provider[customProviderID].models = {
      [modelID]: {
        name: modelID,
        attachment: true,
        reasoning: false,
        temperature: true,
        tool_call: true,
        cost: {
          input: 0,
          output: 0,
        },
        limit: {
          context: 128000,
          output: 16000,
        },
      },
    };

    return config;
  }

  private extractSystemPrompt(messages: LlmMessage[]): string {
    const systemMessage = messages.find((m) => m.role === "system");
    return systemMessage?.content || "";
  }

  private extractUserPrompt(messages: LlmMessage[]): string {
    const userMessages = messages.filter((m) => m.role === "user");
    return userMessages.map((m) => m.content).join("\n\n");
  }

  isSupportJsonSchema(): boolean {
    return false;
  }
}
