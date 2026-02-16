import { vi, type Mock } from "vitest";
import { OpenAIAdapter } from "./openai.adapter";
import OpenAI from "openai";

vi.mock("openai");

describe("OpenAIAdapter", () => {
  let adapter: OpenAIAdapter;
  let mockOpenAIInstance: any;

  const mockConfig = {
    openai: {
      apiKey: "test-key",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
    (OpenAI as unknown as Mock).mockImplementation(function () {
      return mockOpenAIInstance;
    });
    adapter = new OpenAIAdapter(mockConfig as any);
  });

  it("should be defined", () => {
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("openai");
  });

  describe("isConfigured", () => {
    it("should return true if openai config exists", () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it("should return false if openai config is missing", () => {
      const unconfiguredAdapter = new OpenAIAdapter({} as any);
      expect(unconfiguredAdapter.isConfigured()).toBe(false);
    });
  });

  describe("chat", () => {
    it("should call openai.chat.completions.create with correct params", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockResponse = {
        choices: [{ message: { content: "hi" } }],
        model: "gpt-4o",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await adapter.chat(messages);

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          messages: [{ role: "user", content: "hello" }],
        }),
      );
      expect(result.content).toBe("hi");
      expect(result.usage?.totalTokens).toBe(15);
    });

    it("should handle API error", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const apiError = new Error("API Error");
      (apiError as any).status = 401;
      Object.setPrototypeOf(apiError, OpenAI.APIError.prototype);
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(apiError);

      await expect(adapter.chat(messages)).rejects.toThrow("API 错误 (401)");
    });
  });

  describe("chatStream", () => {
    it("should handle streaming response", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockStream = (async function* () {
        yield { choices: [{ delta: { content: "h" } }] };
        yield { choices: [{ delta: { content: "i" } }] };
      })();
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockStream);

      const stream = adapter.chatStream(messages);
      const events: any[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toContainEqual({ type: "text", content: "h" });
      expect(events).toContainEqual({ type: "text", content: "i" });
      expect(events).toContainEqual({ type: "result", response: { content: "hi" } });
    });

    it("should handle stream API error", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const apiError = new Error("Stream Error");
      (apiError as any).status = 500;
      Object.setPrototypeOf(apiError, OpenAI.APIError.prototype);
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(apiError);

      const stream = adapter.chatStream(messages);
      const events: any[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("API 错误 (500)"),
      });
    });

    it("should throw non-API errors in chatStream", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(new Error("network"));

      const stream = adapter.chatStream(messages);
      await expect(async () => {
        for await (const _ of stream) {
          /* consume */
        }
      }).rejects.toThrow("network");
    });

    it("should handle chunk with empty delta", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockStream = (async function* () {
        yield { choices: [{ delta: {} }] };
        yield { choices: [{ delta: { content: "ok" } }] };
      })();
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockStream);

      const events: any[] = [];
      for await (const event of adapter.chatStream(messages)) {
        events.push(event);
      }
      expect(events).toContainEqual({ type: "text", content: "ok" });
      expect(events).toContainEqual({ type: "result", response: { content: "ok" } });
    });

    it("should yield error when openai not configured", async () => {
      const unconfigured = new OpenAIAdapter({} as any);
      const events: any[] = [];
      for await (const event of unconfigured.chatStream([{ role: "user", content: "hi" }] as any)) {
        events.push(event);
      }
      expect(events[0]).toMatchObject({ type: "error" });
    });
  });

  describe("chat edge cases", () => {
    it("should throw non-API errors in chat", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(new Error("timeout"));
      await expect(adapter.chat(messages)).rejects.toThrow("timeout");
    });

    it("should throw when openai not configured for chat", async () => {
      const unconfigured = new OpenAIAdapter({} as any);
      await expect(unconfigured.chat([{ role: "user", content: "hi" }] as any)).rejects.toThrow(
        "未配置 openai",
      );
    });

    it("should return empty content when choices empty", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: {} }],
        model: "gpt-4o",
      });
      const result = await adapter.chat(messages);
      expect(result.content).toBe("");
      expect(result.usage).toBeUndefined();
    });

    it("should reuse cached client on second call", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "a" } }],
        model: "gpt-4o",
      });
      (OpenAI as unknown as Mock).mockClear();
      await adapter.chat(messages);
      await adapter.chat(messages);
      expect(OpenAI).toHaveBeenCalledTimes(1);
    });
  });

  it("isSupportJsonSchema should return false", () => {
    expect(adapter.isSupportJsonSchema()).toBe(false);
  });
});
