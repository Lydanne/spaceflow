import { vi } from "vitest";
import { ReviewLlmProcessor } from "./review-llm";
import type { ReviewPrompt } from "./review.service";
import { ChangedFileCollection } from "./changed-file-collection";

vi.mock("c12");
vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: vi.fn().mockReturnValue({
    session: {
      create: vi.fn(),
      prompt: vi.fn(),
      delete: vi.fn(),
    },
  }),
}));
vi.mock("openai", () => {
  const mCreate = vi.fn();
  class MockOpenAI {
    chat = {
      completions: {
        create: mCreate,
      },
    };
    static APIError = class extends Error {
      status: number;
      constructor(status: number, message: string) {
        super(message);
        this.status = status;
      }
    };
  }
  return {
    __esModule: true,
    default: MockOpenAI,
  };
});

describe("ReviewLlmProcessor", () => {
  let processor: ReviewLlmProcessor;
  let mockLlmProxyService: any;
  let mockReviewSpecService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReviewSpecService = {
      resolveSpecSources: vi.fn().mockResolvedValue(["/mock/spec/dir"]),
      loadReviewSpecs: vi.fn().mockResolvedValue([
        {
          filename: "ts.base.md",
          extensions: ["ts"],
          rules: [{ id: "R1", title: "Rule 1", description: "D1", examples: [], overrides: [] }],
          overrides: [],
          includes: [],
        },
      ]),
      applyOverrides: vi.fn().mockImplementation((specs) => specs),
      filterApplicableSpecs: vi.fn().mockImplementation((specs) => specs),
      filterIssuesByIncludes: vi.fn().mockImplementation((issues) => issues),
      filterIssuesByOverrides: vi.fn().mockImplementation((issues) => issues),
      filterIssuesByCommits: vi.fn().mockImplementation((issues) => issues),
      formatIssues: vi.fn().mockImplementation((issues) => issues),
      buildSpecsSection: vi.fn().mockReturnValue("mock specs section"),
      filterIssuesByRuleExistence: vi.fn().mockImplementation((issues) => issues),
      deduplicateSpecs: vi.fn().mockImplementation((specs) => specs),
    };

    mockLlmProxyService = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      createSession: vi.fn(),
      getAvailableAdapters: vi.fn().mockReturnValue(["openai", "open-code"]),
    };

    processor = new ReviewLlmProcessor(mockLlmProxyService as any, mockReviewSpecService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("runLLMReview", () => {
    it("should call callLLM when llmMode is openai", async () => {
      const callLLMSpy = vi
        .spyOn(processor, "callLLM")
        .mockResolvedValue({ issues: [], summary: [] } as any);

      const mockPrompt: ReviewPrompt = {
        filePrompts: [{ filename: "test.ts", systemPrompt: "system", userPrompt: "user" }],
      };

      await processor.runLLMReview("openai", mockPrompt);

      expect(callLLMSpy).toHaveBeenCalledWith("openai", mockPrompt, {});
    });
  });

  describe("normalizeIssues", () => {
    it("should split comma separated lines", () => {
      const issues = [
        {
          file: "test.ts",
          line: "10, 12",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "r1",
          suggestion: "fix",
        } as any,
      ];
      const normalized = processor.normalizeIssues(issues);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].line).toBe("10");
      expect(normalized[1].line).toBe("12");
      expect(normalized[1].suggestion).toContain("参考 test.ts:10");
    });

    it("should filter issues with blank line", () => {
      const issues = [
        {
          file: "test.ts",
          line: "   ",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "r1",
        } as any,
      ];

      expect(processor.normalizeIssues(issues)).toEqual([]);
    });

    it("should filter blank parts in comma separated lines", () => {
      const issues = [
        {
          file: "test.ts",
          line: "10, , 12, ",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "r1",
          suggestion: "fix",
        } as any,
      ];

      const normalized = processor.normalizeIssues(issues);
      expect(normalized).toHaveLength(2);
      expect(normalized.map((issue) => issue.line)).toEqual(["10", "12"]);
    });
  });

  describe("buildReviewPrompt", () => {
    it("should build prompts for changed files", async () => {
      const specs = [{ extensions: ["ts"], includes: [], rules: [{ id: "R1" }] }];
      const changedFiles = [{ filename: "test.ts", status: "modified" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["abc1234", "const x = 1;"],
            ["-------", "const y = 2;"],
          ],
        ],
      ]);
      const commits = [{ sha: "abc1234567890", commit: { message: "fix" } }];
      const result = await processor.buildReviewPrompt(
        specs as any,
        ChangedFileCollection.from(changedFiles),
        fileContents as any,
        commits,
      );
      expect(result.filePrompts).toHaveLength(1);
      expect(result.filePrompts[0].filename).toBe("test.ts");
      expect(result.filePrompts[0].userPrompt).toContain("test.ts");
      expect(result.filePrompts[0].systemPrompt).toContain("代码审查专家");
    });

    it("should skip deleted files", async () => {
      const specs = [{ extensions: ["ts"], includes: [], rules: [] }];
      const changedFiles = [{ filename: "deleted.ts", status: "deleted" }];
      const result = await processor.buildReviewPrompt(
        specs as any,
        ChangedFileCollection.from(changedFiles),
        new Map(),
        [],
      );
      expect(result.filePrompts).toHaveLength(0);
    });

    it("should handle missing file contents", async () => {
      const specs = [{ extensions: ["ts"], includes: [], rules: [] }];
      const changedFiles = [{ filename: "test.ts", status: "modified" }];
      const result = await processor.buildReviewPrompt(
        specs as any,
        ChangedFileCollection.from(changedFiles),
        new Map(),
        [],
      );
      expect(result.filePrompts).toHaveLength(1);
      expect(result.filePrompts[0].userPrompt).toContain("无法获取内容");
    });

    it("should include existing result in prompt", async () => {
      const specs = [{ extensions: ["ts"], includes: [], rules: [] }];
      const changedFiles = [{ filename: "test.ts", status: "modified" }];
      const fileContents = new Map([["test.ts", [["-------", "code"]]]]);
      const existingResult = {
        issues: [{ file: "test.ts", line: "1", ruleId: "R1", reason: "bad code" }],
        summary: [{ file: "test.ts", summary: "has issues" }],
      };
      const result = await processor.buildReviewPrompt(
        specs as any,
        ChangedFileCollection.from(changedFiles),
        fileContents as any,
        [],
        existingResult as any,
      );
      expect(result.filePrompts[0].userPrompt).toContain("bad code");
    });
  });

  describe("generatePrDescription", () => {
    it("should generate description from LLM", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "# Feat: 新功能\n\n详细描述" };
      })();
      mockLlmProxyService.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc123", commit: { message: "feat: add" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const result = await processor.generatePrDescription(
        commits,
        ChangedFileCollection.from(changedFiles),
        "openai",
      );
      expect(result.title).toBe("Feat: 新功能");
      expect(result.description).toContain("详细描述");
    });

    it("should fallback on LLM error", async () => {
      const mockStream = (async function* () {
        yield { type: "error", message: "fail" };
      })();
      mockLlmProxyService.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc123", commit: { message: "feat: add" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const result = await processor.generatePrDescription(
        commits,
        ChangedFileCollection.from(changedFiles),
        "openai",
      );
      expect(result.title).toBeDefined();
    });

    it("should include code changes section when fileContents provided", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: test\n\ndesc" };
      })();
      mockLlmProxyService.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc123", commit: { message: "feat" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const fileContents = new Map([["a.ts", [["abc1234", "new code"]]]]) as any;
      const result = await processor.generatePrDescription(
        commits,
        ChangedFileCollection.from(changedFiles),
        "openai",
        fileContents,
      );
      expect(result.title).toBeDefined();
    });
  });

  describe("buildBasicDescription", () => {
    it("should build description from commits and files", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: test" };
      })();
      mockLlmProxyService.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc", commit: { message: "feat: add feature" } }];
      const changedFiles = [
        { filename: "a.ts", status: "added" },
        { filename: "b.ts", status: "modified" },
        { filename: "c.ts", status: "deleted" },
      ];
      const result = await processor.buildBasicDescription(
        commits,
        ChangedFileCollection.from(changedFiles),
      );
      expect(result.description).toContain("提交记录");
      expect(result.description).toContain("文件变更");
      expect(result.description).toContain("新增 1");
      expect(result.description).toContain("修改 1");
      expect(result.description).toContain("删除 1");
    });

    it("should handle empty commits", async () => {
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: empty" };
      })();
      mockLlmProxyService.chatStream.mockReturnValue(mockStream);
      const result = await processor.buildBasicDescription([], ChangedFileCollection.empty());
      expect(result.title).toBeDefined();
    });
  });
});
