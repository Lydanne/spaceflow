import { vi, type Mocked } from "vitest";
import { LlmProxyService, ChatOptions } from "./llm-proxy.service";
import type { ClaudeCodeAdapter } from "./adapters/claude-code.adapter";
import type { OpenAIAdapter } from "./adapters/openai.adapter";
import type { OpenCodeAdapter } from "./adapters/open-code.adapter";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));
vi.mock("../../claude-setup", () => ({
  ClaudeSetupService: class MockClaudeSetupService {
    configure = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("./adapters/claude-code.adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adapters/claude-code.adapter")>();
  return { ...actual };
});
vi.mock("./adapters/openai.adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adapters/openai.adapter")>();
  return { ...actual };
});
vi.mock("./adapters/open-code.adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adapters/open-code.adapter")>();
  return { ...actual };
});

describe("LlmProxyService", () => {
  let service: LlmProxyService;
  let claudeAdapter: Mocked<ClaudeCodeAdapter>;
  let openaiAdapter: Mocked<OpenAIAdapter>;
  let opencodeAdapter: Mocked<OpenCodeAdapter>;

  const mockConfig = {
    defaultAdapter: "claude-code" as const,
    claudeCode: { model: "claude-3-5-sonnet" },
    openai: { apiKey: "test-key", model: "gpt-4o" },
    openCode: { apiKey: "test-key" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LlmProxyService(mockConfig as any);
    // 获取内部适配器的引用（通过 getAdapter）
    claudeAdapter = (service as any).adapters.get("claude-code");
    openaiAdapter = (service as any).adapters.get("openai");
    opencodeAdapter = (service as any).adapters.get("open-code");
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
      const spy = vi.spyOn(claudeAdapter, "isConfigured").mockReturnValue(false);
      expect(() => service.createSession("claude-code")).toThrow('适配器 "claude-code" 未配置');
      spy.mockRestore();
    });
  });

  describe("chat", () => {
    it("should call adapter.chat and return response", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockResponse = { content: "hi", role: "assistant" };
      const chatSpy = vi.spyOn(claudeAdapter, "chat").mockResolvedValue(mockResponse as any);

      const result = await service.chat(messages);

      expect(chatSpy).toHaveBeenCalledWith(messages, undefined);
      expect(result).toEqual(mockResponse);
      chatSpy.mockRestore();
    });

    it("should use specified adapter", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const options: ChatOptions = { adapter: "openai" };
      const openaiChatSpy = vi
        .spyOn(openaiAdapter, "chat")
        .mockResolvedValue({ content: "hi" } as any);
      const claudeChatSpy = vi.spyOn(claudeAdapter, "chat");

      await service.chat(messages, options);

      expect(openaiChatSpy).toHaveBeenCalled();
      expect(claudeChatSpy).not.toHaveBeenCalled();
      openaiChatSpy.mockRestore();
      claudeChatSpy.mockRestore();
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
      const chatSpy = vi.spyOn(claudeAdapter, "chat").mockResolvedValue(mockResponse as any);

      const result = await service.chat(messages, options as any);

      expect(result.structuredOutput).toEqual(mockParsed);
      expect(mockJsonSchema.parse).toHaveBeenCalledWith(mockResponse.content);
      chatSpy.mockRestore();
    });
  });

  describe("chatStream", () => {
    it("should delegate to adapter.chatStream", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockStream = (async function* () {
        yield { type: "text", content: "hi" };
      })();
      const chatStreamSpy = vi
        .spyOn(claudeAdapter, "chatStream")
        .mockReturnValue(mockStream as any);

      const stream = service.chatStream(messages);
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([{ type: "text", content: "hi" }]);
      expect(chatStreamSpy).toHaveBeenCalledWith(messages, undefined);
      chatStreamSpy.mockRestore();
    });
  });

  describe("chat with jsonSchema fallback", () => {
    it("should append jsonSchema prompt when adapter does not support jsonSchema", async () => {
      const jsonSchemaSpy = vi.spyOn(claudeAdapter, "isSupportJsonSchema").mockReturnValue(false);
      const chatSpy = vi
        .spyOn(claudeAdapter, "chat")
        .mockResolvedValue({ content: '{"foo":"bar"}' } as any);
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
      const result = await service.chat(messages, { jsonSchema: mockJsonSchema } as any);
      expect(messages[0].content).toContain("请返回 JSON");
      expect(result.structuredOutput).toEqual({ foo: "bar" });
      jsonSchemaSpy.mockRestore();
      chatSpy.mockRestore();
    });

    it("should not append jsonSchema prompt if already matched", async () => {
      const jsonSchemaSpy = vi.spyOn(claudeAdapter, "isSupportJsonSchema").mockReturnValue(false);
      const chatSpy = vi.spyOn(claudeAdapter, "chat").mockResolvedValue({ content: "{}" } as any);
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue({}),
        getSchema: vi.fn(),
        jsonFormatInstruction: "请返回 JSON",
        isMatched: vi.fn().mockReturnValue(true),
      };
      const messages = [{ role: "system", content: "已包含 JSON 指令" }] as any;
      await service.chat(messages, { jsonSchema: mockJsonSchema } as any);
      expect(messages[0].content).toBe("已包含 JSON 指令");
      jsonSchemaSpy.mockRestore();
      chatSpy.mockRestore();
    });

    it("should add system message if none exists", async () => {
      const jsonSchemaSpy = vi.spyOn(claudeAdapter, "isSupportJsonSchema").mockReturnValue(false);
      const chatSpy = vi.spyOn(claudeAdapter, "chat").mockResolvedValue({ content: "{}" } as any);
      const mockJsonSchema = {
        parse: vi.fn().mockResolvedValue({}),
        getSchema: vi.fn(),
        jsonFormatInstruction: "请返回 JSON",
        isMatched: vi.fn().mockReturnValue(false),
      };
      const messages = [{ role: "user", content: "hello" }] as any;
      await service.chat(messages, { jsonSchema: mockJsonSchema } as any);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toBe("请返回 JSON");
      jsonSchemaSpy.mockRestore();
      chatSpy.mockRestore();
    });

    it("should not parse if response has no content", async () => {
      const chatSpy = vi.spyOn(claudeAdapter, "chat").mockResolvedValue({ content: "" } as any);
      const mockJsonSchema = {
        parse: vi.fn(),
        getSchema: vi.fn(),
      };
      const result = await service.chat(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      );
      expect(mockJsonSchema.parse).not.toHaveBeenCalled();
      expect(result.structuredOutput).toBeUndefined();
      chatSpy.mockRestore();
    });

    it("should not parse if structuredOutput already exists", async () => {
      const chatSpy = vi.spyOn(claudeAdapter, "chat").mockResolvedValue({
        content: "{}",
        structuredOutput: { existing: true },
      } as any);
      const mockJsonSchema = {
        parse: vi.fn(),
        getSchema: vi.fn(),
      };
      const result = await service.chat(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      );
      expect(mockJsonSchema.parse).not.toHaveBeenCalled();
      expect(result.structuredOutput).toEqual({ existing: true });
      chatSpy.mockRestore();
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
      const chatStreamSpy = vi
        .spyOn(claudeAdapter, "chatStream")
        .mockReturnValue(mockStream as any);
      const chunks: any[] = [];
      for await (const chunk of service.chatStream(
        [{ role: "user", content: "hello" }] as any,
        { jsonSchema: mockJsonSchema } as any,
      )) {
        chunks.push(chunk);
      }
      expect(chunks[0].response.structuredOutput).toEqual({ parsed: true });
      chatStreamSpy.mockRestore();
    });

    it("should handle jsonSchema parse error gracefully", async () => {
      const mockJsonSchema = {
        parse: vi.fn().mockRejectedValue(new Error("parse error")),
        getSchema: vi.fn(),
      };
      const mockStream = (async function* () {
        yield { type: "result", response: { content: "invalid json" } };
      })();
      const chatStreamSpy = vi
        .spyOn(claudeAdapter, "chatStream")
        .mockReturnValue(mockStream as any);
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
      chatStreamSpy.mockRestore();
    });

    it("should use specified adapter for chatStream", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "hi" };
      })();
      const chatStreamSpy = vi
        .spyOn(openaiAdapter, "chatStream")
        .mockReturnValue(mockStream as any);
      const chunks: any[] = [];
      for await (const chunk of service.chatStream([{ role: "user", content: "hello" }] as any, {
        adapter: "openai",
      })) {
        chunks.push(chunk);
      }
      expect(chatStreamSpy).toHaveBeenCalled();
      chatStreamSpy.mockRestore();
    });
  });

  describe("getAvailableAdapters", () => {
    it("should return list of configured adapters", () => {
      const claudeSpy = vi.spyOn(claudeAdapter, "isConfigured").mockReturnValue(true);
      const openaiSpy = vi.spyOn(openaiAdapter, "isConfigured").mockReturnValue(false);
      const opencodeSpy = vi.spyOn(opencodeAdapter, "isConfigured").mockReturnValue(false);

      const available = service.getAvailableAdapters();

      expect(available).toEqual(["claude-code"]);
      claudeSpy.mockRestore();
      openaiSpy.mockRestore();
      opencodeSpy.mockRestore();
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
