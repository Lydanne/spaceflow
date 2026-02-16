import { query, type SpawnOptions } from "@anthropic-ai/claude-agent-sdk";
import { spawn } from "child_process";
import type { LlmAdapter } from "./llm-adapter.interface";
import type {
  LlmMessage,
  LlmRequestOptions,
  LlmResponse,
  LlmStreamEvent,
  LlmProxyConfig,
} from "../interfaces";
import { ClaudeSetupService } from "../../claude-setup";
import { shouldLog } from "../../verbose";

export class ClaudeCodeAdapter implements LlmAdapter {
  readonly name = "claude-code";
  private readonly claudeSetupService: ClaudeSetupService;

  constructor(private readonly config: LlmProxyConfig) {
    // 创建 ClaudeSetupService 实例，传入 LLM 配置
    this.claudeSetupService = new ClaudeSetupService(config);
  }

  isConfigured(): boolean {
    return !!this.config.claudeCode;
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
    // 备份原有配置
    await this.claudeSetupService.backup();

    try {
      // 应用临时配置
      await this.claudeSetupService.configure(options?.verbose);

      const claudeConf = this.config.claudeCode;

      if (!claudeConf) {
        yield {
          type: "error",
          message: "[LLMProxy.ClaudeCodeAdapter.chatStream] 未配置 claude 设置",
        };
        return;
      }

      const model = options?.model || claudeConf.model || "claude-sonnet-4-5";
      const systemPrompt = this.extractSystemPrompt(messages);
      const userPrompt = this.extractUserPrompt(messages);

      if (shouldLog(options?.verbose, 1)) {
        console.log(
          `[LLMProxy.ClaudeCodeAdapter.chatStream] 配置: Model=${model}, BaseURL=${claudeConf.baseUrl || "(默认)"}`,
        );
      }

      const handleUncaughtError = (err: Error) => {
        if ((err as any).code === "EPIPE") {
          console.error(
            "[LLMProxy.ClaudeCodeAdapter.chatStream] EPIPE 错误: Claude CLI 子进程意外退出",
          );
          throw err;
        }
      };
      process.on("uncaughtException", handleUncaughtError);

      try {
        const spawnEnv = { ...process.env };
        if (claudeConf.baseUrl) spawnEnv.ANTHROPIC_BASE_URL = claudeConf.baseUrl;
        if (claudeConf.authToken) spawnEnv.ANTHROPIC_AUTH_TOKEN = claudeConf.authToken;

        const spawnClaudeCodeProcess = (spawnOptions: SpawnOptions) => {
          if (shouldLog(options?.verbose, 2)) {
            console.log(
              `[LLMProxy.ClaudeCodeAdapter.chatStream] Spawning: ${spawnOptions.command} ${spawnOptions.args?.join(" ")}`,
            );
          }
          const child = spawn(spawnOptions.command, spawnOptions.args || [], {
            ...spawnOptions,
            stdio: ["pipe", "pipe", "pipe"],
            env: spawnEnv,
          });

          child.stderr?.on("data", (data) => {
            console.error(`[LLMProxy.ClaudeCodeAdapter.chatStream] CLI stderr: ${data.toString()}`);
          });

          return child;
        };

        const queryOptions: Parameters<typeof query>[0]["options"] = {
          model,
          systemPrompt,
          permissionMode: "default",
          spawnClaudeCodeProcess,
        };

        if (options?.allowedTools?.length) {
          queryOptions.allowedTools = options.allowedTools as any;
        }

        if (options?.jsonSchema) {
          queryOptions.outputFormat = {
            type: "json_schema",
            schema: options.jsonSchema.getSchema(),
          };
        }

        const response = query({
          prompt: userPrompt,
          options: queryOptions,
        });

        let finalContent = "";
        let structuredOutput: unknown = undefined;

        for await (const message of response) {
          if (message.type === "assistant") {
            const content = message.message.content;
            if (typeof content === "string") {
              yield { type: "text", content };
              finalContent += content;
            } else if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text") {
                  yield { type: "text", content: block.text };
                  finalContent += block.text;
                } else if (block.type === "tool_use") {
                  yield { type: "tool_use", name: block.name, input: block.input };
                } else if (block.type === ("thought" as any)) {
                  yield { type: "thought", content: (block as any).thought };
                }
              }
            }
          }

          if (message.type === "result") {
            if (message.subtype === "success") {
              if (message.structured_output) {
                structuredOutput = message.structured_output;
              }
              yield {
                type: "result",
                response: {
                  content: finalContent,
                  structuredOutput,
                },
              };
            } else {
              yield {
                type: "error",
                message: `[LLMProxy.ClaudeCodeAdapter.chatStream] ${message.errors?.join(", ") || "未知错误"}`,
              };
            }
          }
        }
      } catch (error: any) {
        if (error?.code === "EPIPE" || error?.message?.includes("EPIPE")) {
          yield {
            type: "error",
            message:
              "[LLMProxy.ClaudeCodeAdapter.chatStream] 连接中断 (EPIPE)。请检查：\n" +
              "1. ANTHROPIC_AUTH_TOKEN 环境变量是否正确设置\n" +
              "2. ANTHROPIC_BASE_URL 是否与 Claude Agent SDK 兼容\n" +
              "3. Claude CLI 是否已正确安装",
          };
        } else {
          throw error;
        }
      } finally {
        process.removeListener("uncaughtException", handleUncaughtError);
      }
    } finally {
      // 恢复原有配置
      await this.claudeSetupService.restore();
    }
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
    return true;
  }
}
