import { vi, type Mocked, type Mock } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ClaudeCodeAdapter } from "./claude-code.adapter";
import { ClaudeSetupService } from "../../claude-setup";
import { LlmStreamEvent } from "../interfaces";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

import { query } from "@anthropic-ai/claude-agent-sdk";

describe("ClaudeAdapter", () => {
  let adapter: ClaudeCodeAdapter;
  let claudeSetupService: Mocked<ClaudeSetupService>;

  const mockConfig = {
    claudeCode: {
      model: "claude-3-5-sonnet",
      baseUrl: "https://api.anthropic.com",
    },
  };

  beforeEach(async () => {
    const mockSetup = {
      configure: vi.fn().mockResolvedValue(undefined),
      backup: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      withTemporaryConfig: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeCodeAdapter,
        { provide: "LLM_PROXY_CONFIG", useValue: mockConfig },
        { provide: ClaudeSetupService, useValue: mockSetup },
      ],
    }).compile();

    adapter = module.get<ClaudeCodeAdapter>(ClaudeCodeAdapter);
    claudeSetupService = module.get(ClaudeSetupService);
  });

  it("should be defined", () => {
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("claude-code");
  });

  describe("isConfigured", () => {
    it("should return true if claude config exists", () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it("should return false if claude config is missing", async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClaudeCodeAdapter,
          { provide: "LLM_PROXY_CONFIG", useValue: {} },
          { provide: ClaudeSetupService, useValue: { configure: vi.fn() } },
        ],
      }).compile();
      const unconfiguredAdapter = module.get<ClaudeCodeAdapter>(ClaudeCodeAdapter);
      expect(unconfiguredAdapter.isConfigured()).toBe(false);
    });
  });

  describe("chatStream", () => {
    it("should call claudeSetupService.configure and query with correct params", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const mockQueryResponse = (async function* () {
        yield { type: "assistant", message: { content: "hi" } };
        yield { type: "result", subtype: "success", response: { content: "hi" } };
      })();
      (query as Mock).mockReturnValue(mockQueryResponse);

      const stream = adapter.chatStream(messages);
      const events: LlmStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(claudeSetupService.configure).toHaveBeenCalled();
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "hello",
          options: expect.objectContaining({
            model: "claude-3-5-sonnet",
          }),
        }),
      );
      expect(events).toContainEqual({ type: "text", content: "hi" });
    });

    it("should handle EPIPE error during stream", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const epipeError = new Error("EPIPE: broken pipe");
      (epipeError as any).code = "EPIPE";

      (query as Mock).mockImplementation(() => {
        throw epipeError;
      });

      const stream = adapter.chatStream(messages);
      const events: LlmStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("连接中断 (EPIPE)"),
      });
    });

    it("should throw other errors during stream", async () => {
      const messages = [{ role: "user", content: "hello" }] as any;
      const unexpectedError = new Error("Unexpected error");

      (query as Mock).mockImplementation(() => {
        throw unexpectedError;
      });

      const stream = adapter.chatStream(messages);
      await expect(async () => {
        for await (const _ of stream) {
          // ignore
        }
      }).rejects.toThrow("Unexpected error");
    });
  });
});
