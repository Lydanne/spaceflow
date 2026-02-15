import { vi, type Mocked } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { LlmProxyService, ChatOptions } from "./llm-proxy.service";
import { ClaudeCodeAdapter } from "./adapters/claude-code.adapter";
import { OpenAIAdapter } from "./adapters/openai.adapter";
import { OpenCodeAdapter } from "./adapters/open-code.adapter";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("LlmProxyService", () => {
  let service: LlmProxyService;
  let claudeAdapter: Mocked<ClaudeCodeAdapter>;
  let openaiAdapter: Mocked<OpenAIAdapter>;
  let opencodeAdapter: Mocked<OpenCodeAdapter>;

  const mockConfig = {
    defaultAdapter: "claude-code" as const,
  };

  beforeEach(async () => {
    const mockClaude = {
      name: "claude-code",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
      isSupportJsonSchema: vi.fn().mockReturnValue(true),
    };
    const mockOpenAI = {
      name: "openai",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
      isSupportJsonSchema: vi.fn().mockReturnValue(true),
    };
    const mockOpenCode = {
      name: "open-code",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
      isSupportJsonSchema: vi.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmProxyService,
        { provide: "LLM_PROXY_CONFIG", useValue: mockConfig },
        { provide: ClaudeCodeAdapter, useValue: mockClaude },
        { provide: OpenAIAdapter, useValue: mockOpenAI },
        { provide: OpenCodeAdapter, useValue: mockOpenCode },
      ],
    }).compile();

    service = module.get<LlmProxyService>(LlmProxyService);
    claudeAdapter = module.get(ClaudeCodeAdapter);
    openaiAdapter = module.get(OpenAIAdapter);
    opencodeAdapter = module.get(OpenCodeAdapter);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createSession", () => {
    it("should create a session with default adapter", () => {
      const session = service.createSession();
      expect(session).toBeDefined();
      expect(session.adapterName).toBe("claude-code");
    });

    it("should create a session with specified adapter", () => {
      const session = service.createSession("openai");
      expect(session).toBeDefined();
      expect(session.adapterName).toBe("openai");
    });

    it("should throw error if adapter is not configured", () => {
      claudeAdapter.isConfigured.mockReturnValue(false);
      expect(() => service.createSession("claude-code")).toThrow('适配器 "claude-code" 未配置');
    });
  });

  describe("chat", () => {
    it("should call adapter.chat and return response", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockResponse = { content: "hi", role: "assistant" };
      claudeAdapter.chat.mockResolvedValue(mockResponse as any);

      const result = await service.chat(messages);

      expect(claudeAdapter.chat).toHaveBeenCalledWith(messages, undefined);
      expect(result).toEqual(mockResponse);
    });

    it("should use specified adapter", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const options: ChatOptions = { adapter: "openai" };
      openaiAdapter.chat.mockResolvedValue({ content: "hi" } as any);

      await service.chat(messages, options);

      expect(openaiAdapter.chat).toHaveBeenCalled();
      expect(claudeAdapter.chat).not.toHaveBeenCalled();
    });

    it("should handle jsonSchema and parse output", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockParsed = { foo: "bar" };
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue(mockParsed),
        getSchema: vi.fn().mockReturnValue({ type: "object" }),
      };
      const options = { jsonSchema: mockJsonSchema };
      const mockResponse = { content: '{"foo":"bar"}', role: "assistant" };
      claudeAdapter.chat.mockResolvedValue(mockResponse as any);

      const result = await service.chat(messages, options as any);

      expect(result.structuredOutput).toEqual(mockParsed);
      expect(mockJsonSchema.parse).toHaveBeenCalledWith(mockResponse.content);
    });
  });

  describe("chatStream", () => {
    it("should delegate to adapter.chatStream", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockStream = (async function* () {
        yield { type: "text", content: "hi" };
      })();
      claudeAdapter.chatStream.mockReturnValue(mockStream as any);

      const stream = service.chatStream(messages);
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([{ type: "text", content: "hi" }]);
      expect(claudeAdapter.chatStream).toHaveBeenCalledWith(messages, undefined);
    });
  });

  describe("chat with jsonSchema fallback", () => {
    it("should append jsonSchema prompt when adapter does not support jsonSchema", async () => {
      claudeAdapter.isSupportJsonSchema.mockReturnValue(false);
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue({ foo: "bar" }),
        getSchema: vi.fn(),
        jsonFormatInstruction: "请返回 JSON",
        isMatched: vi.fn().mockReturnValue(false),
      };
      const messages = [
        { role: "system", content: "你是助手" },
        { role: "user", content: "hello" },
      ] as any;
      claudeAdapter.chat.mockResolvedValue({ content: '{"foo":"bar"}' } as any);
      const result = await service.chat(messages, { jsonSchema: mockJsonSchema } as any);
      expect(messages[0].content).toContain("请返回 JSON");
      expect(result.structuredOutput).toEqual({ foo: "bar" });
    });

    it("should not append jsonSchema prompt if already matched", async () => {
      claudeAdapter.isSupportJsonSchema.mockReturnValue(false);
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue({}),
        getSchema: vi.fn(),
        jsonFormatInstruction: "请返回 JSON",
        isMatched: vi.fn().mockReturnValue(true),
      };
      const messages = [{ role: "system", content: "已包含 JSON 指令" }] as any;
      claudeAdapter.chat.mockResolvedValue({ content: "{}" } as any);
      await service.chat(messages, { jsonSchema: mockJsonSchema } as any);
      expect(messages[0].content).toBe("已包含 JSON 指令");
    });

    it("should add system message if none exists", async () => {
      claudeAdapter.isSupportJsonSchema.mockReturnValue(false);
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue({}),
        getSchema: vi.fn(),
        jsonFormatInstruction: "请返回 JSON",
        isMatched: vi.fn().mockReturnValue(false),
      };
      const messages = [{ role: "user", content: "hello" }] as any;
      claudeAdapter.chat.mockResolvedValue({ content: "{}" } as any);
      await service.chat(messages, { jsonSchema: mockJsonSchema } as any);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toBe("请返回 JSON");
    });

    it("should not parse if response has no content", async () => {
      const mockJsonSchema = {
        parse: vi.fn(),
        getSchema: vi.fn(),
      };
      claudeAdapter.chat.mockResolvedValue({ content: "" } as any);
      const result = await service.chat(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      );
      expect(mockJsonSchema.parse).not.toHaveBeenCalled();
      expect(result.structuredOutput).toBeUndefined();
    });

    it("should not parse if structuredOutput already exists", async () => {
      const mockJsonSchema = {
        parse: vi.fn(),
        getSchema: vi.fn(),
      };
      claudeAdapter.chat.mockResolvedValue({
        content: "{}",
        structuredOutput: { existing: true },
      } as any);
      const result = await service.chat(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      );
      expect(mockJsonSchema.parse).not.toHaveBeenCalled();
      expect(result.structuredOutput).toEqual({ existing: true });
    });
  });

  describe("chatStream with jsonSchema", () => {
    it("should parse jsonSchema on result event", async () => {
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue({ parsed: true }),
        getSchema: vi.fn(),
      };
      const mockStream = (async function* () {
        yield { type: "result", response: { content: '{"parsed":true}' } };
      })();
      claudeAdapter.chatStream.mockReturnValue(mockStream as any);
      const chunks: any[] = [];
      for await (const chunk of service.chatStream(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      )) {
        chunks.push(chunk);
      }
      expect(chunks[0].response.structuredOutput).toEqual({ parsed: true });
    });

    it("should handle jsonSchema parse error gracefully", async () => {
      const mockJsonSchema = {
        parse: vi.fn().mockRejectedValue(new Error("parse error")),
        getSchema: vi.fn(),
      };
      const mockStream = (async function* () {
        yield { type: "result", response: { content: "invalid json" } };
      })();
      claudeAdapter.chatStream.mockReturnValue(mockStream as any);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const chunks: any[] = [];
      for await (const chunk of service.chatStream(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      )) {
        chunks.push(chunk);
      }
      expect(consoleSpy).toHaveBeenCalled();
      expect(chunks[0].response.structuredOutput).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it("should use specified adapter for chatStream", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "hi" };
      })();
      openaiAdapter.chatStream.mockReturnValue(mockStream as any);
      const chunks: any[] = [];
      for await (const chunk of service.chatStream([{ role: "user", content: "hello" }] as any, {
        adapter: "openai",
      })) {
        chunks.push(chunk);
      }
      expect(openaiAdapter.chatStream).toHaveBeenCalled();
    });
  });

  describe("getAvailableAdapters", () => {
    it("should return list of configured adapters", () => {
      claudeAdapter.isConfigured.mockReturnValue(true);
      openaiAdapter.isConfigured.mockReturnValue(false);
      opencodeAdapter.isConfigured.mockReturnValue(false);

      const available = service.getAvailableAdapters();

      expect(available).toEqual(["claude-code"]);
    });

    it("should return all adapters when all configured", () => {
      const available = service.getAvailableAdapters();
      expect(available).toEqual(["claude-code", "openai", "open-code"]);
    });
  });

  describe("getAdapter errors", () => {
    it("should throw for unsupported adapter type", () => {
      expect(() => service.createSession("unknown" as any)).toThrow("不支持的 LLM 类型: unknown");
    });
  });
});
