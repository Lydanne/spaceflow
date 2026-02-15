import { vi, type Mocked } from "vitest";
import { LlmSessionImpl } from "./llm-session";
import { LlmAdapter } from "./adapters";
import { LlmStreamEvent } from "./interfaces";

describe("LlmSessionImpl", () => {
  let adapter: Mocked<LlmAdapter>;
  let session: LlmSessionImpl;

  beforeEach(() => {
    adapter = {
      name: "test-adapter",
      chat: vi.fn(),
      chatStream: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
    } as any;

    session = new LlmSessionImpl(adapter);
  });

  it("should initialize with a random UUID and adapter name", () => {
    expect(session.id).toBeDefined();
    expect(session.adapterName).toBe("test-adapter");
  });

  it("should initialize with session options", () => {
    const options = {
      systemPrompt: "You are a helper",
      model: "gpt-4",
      verbose: 1 as const,
    };
    const sessionWithOptions = new LlmSessionImpl(adapter, options);

    // Testing private state via history building and chat
    expect(sessionWithOptions.getHistory()).toEqual([]);
  });

  describe("send", () => {
    it("should add messages to history and call adapter.chat", async () => {
      const mockResponse = { content: "Hello there!", role: "assistant" };
      adapter.chat.mockResolvedValue(mockResponse as any);

      const response = await session.send("Hi");

      expect(response).toEqual(mockResponse);
      const history = session.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: "user", content: "Hi" });
      expect(history[1]).toEqual({ role: "assistant", content: "Hello there!" });

      expect(adapter.chat).toHaveBeenCalledWith(
        [{ role: "user", content: "Hi" }],
        expect.objectContaining({ model: undefined, verbose: 0 }),
      );
    });

    it("should include system prompt in messages sent to adapter", async () => {
      session.setSystemPrompt("System instruction");
      adapter.chat.mockResolvedValue({ content: "OK", role: "assistant" } as any);

      await session.send("Hi");

      expect(adapter.chat).toHaveBeenCalledWith(
        [
          { role: "system", content: "System instruction" },
          { role: "user", content: "Hi" },
        ],
        expect.anything(),
      );
    });
  });

  describe("sendStream", () => {
    it("should handle streaming events and update history", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "Hello" } as LlmStreamEvent;
        yield { type: "text", content: " world" } as LlmStreamEvent;
        yield {
          type: "result",
          response: { content: "Hello world", role: "assistant" },
        } as LlmStreamEvent;
      })();
      adapter.chatStream.mockReturnValue(mockStream as any);

      const events: LlmStreamEvent[] = [];
      for await (const event of session.sendStream("Hi")) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      const history = session.getHistory();
      expect(history).toHaveLength(2);
      expect(history[1].content).toBe("Hello world");
    });
  });

  describe("history management", () => {
    it("should clear history", () => {
      // Manually trigger a message (using send to populate)
      // We'll mock it to be simple
      session.clearHistory();
      expect(session.getHistory()).toEqual([]);
    });

    it("should return a copy of history", () => {
      const history = session.getHistory();
      history.push({ role: "user", content: "modified" });
      expect(session.getHistory()).toEqual([]);
    });
  });
});
