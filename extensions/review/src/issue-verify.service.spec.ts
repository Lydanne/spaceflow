import { vi } from "vitest";
import { ReviewIssue, FileContentsMap } from "./review-spec";
import { IssueVerifyService } from "./issue-verify.service";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("IssueVerifyService", () => {
  let service: IssueVerifyService;
  let llmProxyService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    llmProxyService = {
      chatStream: vi.fn(),
    };

    const mockReviewSpecService = {
      findRuleById: vi.fn(),
      buildSpecsSection: vi.fn().mockReturnValue("mock rule specs"),
    };

    service = new IssueVerifyService(llmProxyService as any, mockReviewSpecService as any);
  });

  it("should return empty array if no issues provided", async () => {
    const result = await service.verifyIssueFixes([], new Map(), [], "openai");
    expect(result).toEqual([]);
  });

  it("should skip already fixed issues", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        fixed: "2023-01-01",
        round: 1,
      } as any,
    ];
    const result = await service.verifyIssueFixes(
      issues,
      new Map() as FileContentsMap,
      [],
      "openai",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(issues[0]);
    expect(llmProxyService.chatStream).not.toHaveBeenCalled();
  });

  it("should mark as fixed if file is deleted", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "deleted.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map();
    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");
    expect(result).toHaveLength(1);
    expect(result[0].fixed).toBeDefined();
    expect(llmProxyService.chatStream).not.toHaveBeenCalled();
  });

  it("should call LLM to verify issue fix", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "new content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: true, reason: "Fixed now" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");

    expect(result).toHaveLength(1);
    expect(result[0].fixed).toBeDefined();
    expect(llmProxyService.chatStream).toHaveBeenCalled();
  });

  it("should handle LLM saying issue is not fixed", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([
      ["test.ts", [["-------", "still bad content"]]],
    ]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: false, reason: "Still broken" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");

    expect(result).toHaveLength(1);
    expect(result[0].fixed).toBeUndefined();
  });

  it("should handle invalid issue from LLM", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: false, valid: false, reason: "False positive" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");

    expect(result).toHaveLength(1);
    expect(result[0].valid).toBe("false");
    expect(result[0].fixed).toBeUndefined();
  });

  it("should handle error in LLM stream", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield { type: "error", message: "LLM error" };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(issues[0]); // Returns original issue on error
  });

  it("should handle exception during LLM call", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    llmProxyService.chatStream.mockImplementation(() => {
      throw new Error("Critical failure");
    });

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(issues[0]);
  });

  it("should skip issues with valid=false", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        valid: "false",
        round: 1,
      } as any,
    ];
    const result = await service.verifyIssueFixes(
      issues,
      new Map() as FileContentsMap,
      [],
      "openai",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(issues[0]);
    expect(llmProxyService.chatStream).not.toHaveBeenCalled();
  });

  it("should handle non-Error exception during LLM call", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    llmProxyService.chatStream.mockImplementation(() => {
      throw "string error";
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(issues[0]);
    consoleSpy.mockRestore();
  });

  it("should return original issue when LLM returns no structured output", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield { type: "result", response: { content: "no json" } };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(issues[0]);
  });

  it("should include suggestion in prompt when present", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        suggestion: "fix this way",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: true, valid: true, reason: "ok" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");
    expect(result).toHaveLength(1);
    expect(result[0].fixed).toBeDefined();
    const callArgs = llmProxyService.chatStream.mock.calls[0][0];
    expect(callArgs[1].content).toContain("fix this way");
  });

  it("should log verbose messages when verbose=1", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: true, valid: true, reason: "Fixed" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await service.verifyIssueFixes(issues, fileContents, [], "openai", 1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should log verbose for invalid issues", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: false, valid: false, reason: "Invalid" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await service.verifyIssueFixes(issues, fileContents, [], "openai", 1);
    const logMessages = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logMessages.some((m: string) => m.includes("无效问题"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("should log verbose for unfixed issues", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: false, valid: true, reason: "Still broken" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await service.verifyIssueFixes(issues, fileContents, [], "openai", 1);
    const logMessages = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logMessages.some((m: string) => m.includes("未修复"))).toBe(true);
    consoleSpy.mockRestore();
  });

  it("should use ruleInfo when available", async () => {
    const mockReviewSpecService = (service as any).reviewSpecService;
    mockReviewSpecService.findRuleById.mockReturnValue({
      rule: { id: "R1", description: "test rule" },
      spec: { name: "test-spec" },
    });

    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);
    const specs = [{ name: "test-spec" }] as any;

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: false, valid: true, reason: "ok" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    await service.verifyIssueFixes(issues, fileContents, specs, "openai");
    expect(mockReviewSpecService.buildSpecsSection).toHaveBeenCalled();
  });

  it("should handle valid=true and fixed=true result", async () => {
    const issues: ReviewIssue[] = [
      {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r1",
        round: 1,
      } as any,
    ];
    const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "content"]]]]);

    const mockStream = (async function* () {
      yield {
        type: "result",
        response: { structuredOutput: { fixed: true, valid: true, reason: "Fixed" } },
      };
    })();
    llmProxyService.chatStream.mockReturnValue(mockStream as any);

    const result = await service.verifyIssueFixes(issues, fileContents, [], "openai");
    expect(result[0].fixed).toBeDefined();
    expect(result[0].valid).toBe("true");
  });
});
