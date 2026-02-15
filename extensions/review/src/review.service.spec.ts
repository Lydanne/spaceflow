import { vi, type Mocked, type Mock } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  ConfigService,
  ConfigReaderService,
  GitProviderService,
  ClaudeSetupService,
  LlmProxyService,
  GitSdkService,
  parseChangedLinesFromPatch,
} from "@spaceflow/core";
import { ReviewSpecService } from "./review-spec";
import { ReviewReportService } from "./review-report";
import { readFile } from "fs/promises";
import { ReviewService, ReviewContext, ReviewPrompt } from "./review.service";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import type { ReviewOptions } from "./review.command";

vi.mock("c12");
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));
vi.mock("fs/promises");
vi.mock("child_process");
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

describe("ReviewService", () => {
  let service: ReviewService;
  let gitProvider: Mocked<GitProviderService>;
  let configService: Mocked<ConfigService>;
  let mockReviewSpecService: any;
  let mockDeletionImpactService: any;
  let mockGitSdkService: any;

  beforeEach(async () => {
    const mockGitProvider = {
      validateConfig: vi.fn(),
      getPullRequest: vi.fn(),
      getCommit: vi.fn(),
      getPullRequestCommits: vi.fn(),
      getPullRequestFiles: vi.fn(),
      getFileContent: vi.fn(),
      listPullReviews: vi.fn(),
      createPullReview: vi.fn(),
      deletePullReview: vi.fn(),
      editPullRequest: vi.fn(),
      getCommitDiff: vi.fn(),
      listPullReviewComments: vi.fn(),
      searchUsers: vi.fn().mockResolvedValue([]),
      getIssueCommentReactions: vi.fn().mockResolvedValue([]),
    };

    const mockConfigService = {
      get: vi.fn(),
    };

    const mockClaudeSetupService = {
      configure: vi.fn(),
    };

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

    const mockReviewReportService = {
      formatMarkdown: vi.fn().mockReturnValue("AI 代码审查报告"),
      parseMarkdown: vi.fn().mockReturnValue({ issues: [] }),
      format: vi.fn().mockReturnValue("AI 代码审查报告"),
    };

    const mockIssueVerifyService = {
      verifyIssueFixes: vi.fn().mockImplementation((issues) => Promise.resolve(issues)),
    };

    mockDeletionImpactService = {
      analyzeDeletionImpact: vi.fn().mockResolvedValue({ issues: [], summary: "" }),
    };

    mockGitSdkService = {
      parseChangedLinesFromPatch: vi.fn().mockReturnValue(new Set()),
      parseDiffText: vi.fn().mockReturnValue([]),
      getRemoteUrl: vi.fn().mockReturnValue(null),
      parseRepositoryFromRemoteUrl: vi.fn().mockReturnValue(null),
      getChangedFilesBetweenRefs: vi.fn().mockResolvedValue([]),
      getCommitsBetweenRefs: vi.fn().mockResolvedValue([]),
      getDiffBetweenRefs: vi.fn().mockResolvedValue([]),
      getFileContent: vi.fn().mockResolvedValue(""),
      getFilesForCommit: vi.fn().mockResolvedValue([]),
      getCurrentBranch: vi.fn().mockReturnValue("main"),
      getDefaultBranch: vi.fn().mockReturnValue("main"),
      getCommitDiff: vi.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: GitProviderService,
          useValue: mockGitProvider,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ClaudeSetupService,
          useValue: mockClaudeSetupService,
        },
        {
          provide: ReviewSpecService,
          useValue: mockReviewSpecService,
        },
        {
          provide: LlmProxyService,
          useValue: {
            chat: vi.fn(),
            chatStream: vi.fn(),
            createSession: vi.fn(),
            getAvailableAdapters: vi.fn().mockReturnValue(["claude-code", "openai"]),
          },
        },
        {
          provide: ReviewReportService,
          useValue: mockReviewReportService,
        },
        {
          provide: IssueVerifyService,
          useValue: mockIssueVerifyService,
        },
        {
          provide: DeletionImpactService,
          useValue: mockDeletionImpactService,
        },
        {
          provide: GitSdkService,
          useValue: mockGitSdkService,
        },
        {
          provide: ConfigReaderService,
          useValue: {
            getPluginConfig: vi.fn().mockReturnValue({}),
            getSystemConfig: vi.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    gitProvider = module.get(GitProviderService) as Mocked<GitProviderService>;
    configService = module.get(ConfigService) as Mocked<ConfigService>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("ReviewService.getContextFromEnv", () => {
    it("should return context with owner and repo from config", async () => {
      const options: ReviewOptions = {
        dryRun: false,
        ci: false,
      };

      configService.get.mockReturnValue({
        repository: "owner/repo",
        refName: "main",
      });

      const context = await service.getContextFromEnv(options);

      expect(context.owner).toBe("owner");
      expect(context.repo).toBe("repo");
    });

    it("should throw error when repository is missing", async () => {
      const options: ReviewOptions = {
        dryRun: false,
        ci: false,
      };

      configService.get.mockReturnValue({
        repository: "",
        refName: "main",
      });

      await expect(service.getContextFromEnv(options)).rejects.toThrow("缺少配置 ci.repository");
    });

    it("should use provided prNumber from options", async () => {
      const options: ReviewOptions = {
        dryRun: false,
        ci: false,
        prNumber: 123,
      };

      configService.get.mockReturnValue({
        repository: "owner/repo",
        refName: "main",
      });

      const context = await service.getContextFromEnv(options);

      expect(context.prNumber).toBe(123);
    });
  });

  describe("ReviewService.execute", () => {
    beforeEach(() => {
      vi.spyOn(service as any, "runLLMReview").mockResolvedValue({
        success: true,
        issues: [],
        summary: [],
      });
      vi.spyOn(service as any, "buildLineCommitMap").mockResolvedValue(new Map());
      vi.spyOn(service as any, "getFileContents").mockResolvedValue(new Map());
      vi.spyOn(service as any, "getExistingReviewResult").mockResolvedValue(null);
    });

    it("should execute review for PR successfully", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: true,
        ci: false,
        llmMode: "claude-code" as const,
      };

      const mockPR = {
        title: "Test PR",
        head: { sha: "abc123" },
      };

      const mockCommits = [
        {
          sha: "abc123",
          commit: { message: "Test commit" },
        },
      ];

      const mockFiles = [
        {
          filename: "test.ts",
          status: "modified",
        },
      ];

      gitProvider.getPullRequest.mockResolvedValue(mockPR);
      gitProvider.getPullRequestCommits.mockResolvedValue(mockCommits);
      gitProvider.getPullRequestFiles.mockResolvedValue(mockFiles);

      const result = await service.execute(context);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(gitProvider.getPullRequest).toHaveBeenCalledWith("owner", "repo", 123);
    });

    it("should return early when no applicable specs or files", async () => {
      const context = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: false,
      } as ReviewContext;

      const mockPR = {
        title: "Test PR",
        head: { sha: "abc123" },
      };

      gitProvider.getPullRequest.mockResolvedValue(mockPR);
      gitProvider.getPullRequestCommits.mockResolvedValue([]);
      gitProvider.getPullRequestFiles.mockResolvedValue([]);

      const result = await service.execute(context);

      expect(result.success).toBe(true);
      expect(result.summary).toEqual([]);
    });

    it("should post comment to PR in CI mode", async () => {
      const context = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: true,
        llmMode: "claude-code" as const,
      } as ReviewContext;

      const mockPR = {
        title: "Test PR",
        head: { sha: "abc123" },
      };

      const mockCommits = [
        {
          sha: "abc123",
          commit: { message: "Test commit" },
        },
      ];

      const mockFiles = [
        {
          filename: "test.ts",
          status: "modified",
        },
      ];

      gitProvider.getPullRequest.mockResolvedValue(mockPR);
      gitProvider.getPullRequestCommits.mockResolvedValue(mockCommits);
      gitProvider.getPullRequestFiles.mockResolvedValue(mockFiles);
      gitProvider.getFileContent.mockResolvedValue("const test = 1;");
      gitProvider.listPullReviews.mockResolvedValue([]);
      gitProvider.createPullReview.mockResolvedValue({});

      await service.execute(context);

      expect(gitProvider.createPullReview).toHaveBeenCalledWith(
        "owner",
        "repo",
        123,
        expect.objectContaining({
          body: expect.stringContaining("AI 代码审查报告"),
        }),
      );
    });

    it("should handle error during review", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: false,
        llmMode: "claude-code",
      };

      gitProvider.getPullRequest.mockRejectedValue(new Error("Gitea API Error"));

      await expect(service.execute(context)).rejects.toThrow("Gitea API Error");
    });

    it("should delegate to executeCollectOnly on closed event", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: true,
        eventAction: "closed",
      };
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      const result = await service.execute(context);
      expect(result.success).toBe(true);
      expect(result.round).toBe(0);
    });

    it("should throw when no prNumber and no baseRef/headRef", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: false,
        llmMode: "openai",
      };
      await expect(service.execute(context)).rejects.toThrow("必须指定 PR 编号或者 base/head 分支");
    });

    it("should execute review with baseRef/headRef", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        baseRef: "main",
        headRef: "feature",
        specSources: ["/spec/dir"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
      };
      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue([
        { filename: "test.ts", patch: "@@ -1,1 +1,2 @@\n line1\n+new", status: "modified" },
      ]);
      mockGitSdkService.getCommitsBetweenRefs.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" } },
      ]);
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should execute direct file mode when base equals head", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        baseRef: "main",
        headRef: "main",
        files: ["src/app.ts"],
        specSources: ["/spec/dir"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        showAll: true,
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should filter files by includes pattern", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        includes: ["*.ts"],
      };
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } });
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" } },
      ]);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
        { filename: "readme.md", status: "modified" },
      ]);
      gitProvider.getCommit.mockResolvedValue({
        files: [{ filename: "test.ts" }],
      } as any);
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should filter merge commits", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
      };
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } });
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "Merge branch 'main' into feature" } },
        { sha: "def456", commit: { message: "fix: real commit" } },
      ]);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
      ]);
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should run deletion analysis when analyzeDeletions is true", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: false,
        llmMode: "openai",
        analyzeDeletions: true,
        deletionAnalysisMode: "openai",
      };
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } });
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" } },
      ]);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
      ]);
      const result = await service.execute(context);
      expect(result.success).toBe(true);
      expect(mockDeletionImpactService.analyzeDeletionImpact).toHaveBeenCalled();
    });

    it("should execute deletionOnly review successfully", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        specSources: ["/spec/dir"],
        dryRun: false,
        ci: true,
        llmMode: "openai",
        deletionOnly: true,
      };

      const mockPR = { title: "Test PR", head: { sha: "abc123" } };
      gitProvider.getPullRequest.mockResolvedValue(mockPR as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([]);
      gitProvider.getPullRequestFiles.mockResolvedValue([]);
      gitProvider.listPullReviews.mockResolvedValue([]);
      gitProvider.createPullReview.mockResolvedValue({});

      const result = await service.execute(context);

      expect(result.success).toBe(true);
      expect(mockDeletionImpactService.analyzeDeletionImpact).toHaveBeenCalled();
      expect(gitProvider.createPullReview).toHaveBeenCalled();
    });
  });

  describe("ReviewService.getPrNumberFromEvent", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return undefined if GITHUB_EVENT_PATH is not set", async () => {
      delete process.env.GITHUB_EVENT_PATH;
      const prNumber = await (service as any).getPrNumberFromEvent();
      expect(prNumber).toBeUndefined();
    });

    it("should parse prNumber from event file", async () => {
      const mockEventPath = "/tmp/event.json";
      process.env.GITHUB_EVENT_PATH = mockEventPath;
      const mockEventContent = JSON.stringify({ pull_request: { number: 456 } });

      (readFile as Mock).mockResolvedValue(mockEventContent);

      const prNumber = await (service as any).getPrNumberFromEvent();
      expect(prNumber).toBe(456);
    });
  });

  describe("ReviewService.runLLMReview", () => {
    it("should call callLLM when llmMode is claude", async () => {
      const callLLMSpy = vi
        .spyOn(service as any, "callLLM")
        .mockResolvedValue({ issues: [], summary: [] });

      const mockPrompt: ReviewPrompt = {
        filePrompts: [{ filename: "test.ts", systemPrompt: "system", userPrompt: "user" }],
      };

      await (service as any).runLLMReview("claude-code", mockPrompt);

      expect(callLLMSpy).toHaveBeenCalledWith("claude-code", mockPrompt, {});
    });

    it("should call callLLM when llmMode is openai", async () => {
      const callLLMSpy = vi
        .spyOn(service as any, "callLLM")
        .mockResolvedValue({ issues: [], summary: [] });

      const mockPrompt: ReviewPrompt = {
        filePrompts: [{ filename: "test.ts", systemPrompt: "system", userPrompt: "user" }],
      };

      await (service as any).runLLMReview("openai", mockPrompt);

      expect(callLLMSpy).toHaveBeenCalledWith("openai", mockPrompt, {});
    });
  });

  describe("ReviewService Logic", () => {
    it("normalizeIssues should split comma separated lines", () => {
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
      const normalized = (service as any).normalizeIssues(issues);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].line).toBe("10");
      expect(normalized[1].line).toBe("12");
      expect(normalized[1].suggestion).toContain("参考 test.ts:10");
    });

    it("parseChangedLinesFromPatch should correctly parse additions", () => {
      const patch = `@@ -1,3 +1,4 @@
 line1
+line2
 line3
 line4`;
      const changedLines = parseChangedLinesFromPatch(patch);
      expect(changedLines.has(2)).toBe(true);
      expect(changedLines.size).toBe(1);
    });
  });

  describe("ReviewService.updateIssueLineNumbers", () => {
    beforeEach(() => {
      mockReviewSpecService.parseLineRange = vi.fn().mockImplementation((lineStr: string) => {
        const lines: number[] = [];
        const rangeMatch = lineStr.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) {
            lines.push(i);
          }
        } else {
          const line = parseInt(lineStr, 10);
          if (!isNaN(line)) {
            lines.push(line);
          }
        }
        return lines;
      });
    });

    it("should update issue line numbers when code is inserted before", () => {
      // 在第1行插入2行，原第5行变成第7行
      const issues = [
        {
          file: "test.ts",
          line: "5",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -1,3 +1,5 @@
 line1
+new line 1
+new line 2
 line2
 line3`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("7");
      expect(result[0].originalLine).toBe("5");
    });

    it("should update issue line numbers when code is deleted before", () => {
      // 删除第1-2行，原第5行变成第3行
      const issues = [
        {
          file: "test.ts",
          line: "5",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -1,4 +1,2 @@
-line1
-line2
 line3
 line4`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("3");
      expect(result[0].originalLine).toBe("5");
    });

    it("should mark issue as invalid when the line is deleted", () => {
      // 删除第5行
      const issues = [
        {
          file: "test.ts",
          line: "5",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -5,1 +5,0 @@
-deleted line`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].valid).toBe("false");
      expect(result[0].originalLine).toBe("5");
    });

    it("should not update issue when file has no changes", () => {
      const issues = [
        {
          file: "test.ts",
          line: "5",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "other.ts",
          `@@ -1,1 +1,2 @@
 line1
+new line`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("5");
      expect(result[0].originalLine).toBeUndefined();
    });

    it("should not update already fixed issues", () => {
      const issues = [
        {
          file: "test.ts",
          line: "5",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
          fixed: "2024-01-01T00:00:00Z",
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -1,1 +1,3 @@
 line1
+new line 1
+new line 2`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("5");
      expect(result[0].originalLine).toBeUndefined();
    });

    it("should not update invalid issues", () => {
      const issues = [
        {
          file: "test.ts",
          line: "5",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
          valid: "false",
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -1,1 +1,3 @@
 line1
+new line 1
+new line 2`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("5");
      expect(result[0].originalLine).toBeUndefined();
    });

    it("should handle range line numbers", () => {
      // 在第1行插入2行，原第5-7行变成第7-9行
      const issues = [
        {
          file: "test.ts",
          line: "5-7",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -1,3 +1,5 @@
 line1
+new line 1
+new line 2
 line2
 line3`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("7-9");
      expect(result[0].originalLine).toBe("5-7");
    });

    it("should preserve originalLine if already set", () => {
      const issues = [
        {
          file: "test.ts",
          line: "7",
          originalLine: "3",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "test issue",
          severity: "error",
          code: "",
          round: 1,
        } as any,
      ];
      const filePatchMap = new Map<string, string>([
        [
          "test.ts",
          `@@ -1,1 +1,3 @@
 line1
+new line 1
+new line 2`,
        ],
      ]);

      const result = (service as any).updateIssueLineNumbers(issues, filePatchMap);

      expect(result[0].line).toBe("9");
      expect(result[0].originalLine).toBe("3");
    });
  });

  describe("ReviewService.getFileContents", () => {
    beforeEach(() => {
      mockReviewSpecService.parseLineRange = vi.fn().mockImplementation((lineStr: string) => {
        const lines: number[] = [];
        const rangeMatch = lineStr.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) {
            lines.push(i);
          }
        } else {
          const line = parseInt(lineStr, 10);
          if (!isNaN(line)) {
            lines.push(line);
          }
        }
        return lines;
      });
    });

    it("should mark changed lines with commit hash from PR patch", async () => {
      const changedFiles = [
        {
          filename: "test.ts",
          status: "modified",
          patch: `@@ -1,3 +1,5 @@
 line1
+new line 1
+new line 2
 line2
 line3`,
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      gitProvider.getFileContent.mockResolvedValue("line1\nnew line 1\nnew line 2\nline2\nline3");

      const result = await (service as any).getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      expect(result.size).toBe(1);
      const fileContent = result.get("test.ts");
      expect(fileContent).toBeDefined();
      // 第 1 行未变更
      expect(fileContent[0][0]).toBe("-------");
      // 第 2、3 行是新增的
      expect(fileContent[1][0]).toBe("abc1234");
      expect(fileContent[2][0]).toBe("abc1234");
      // 第 4、5 行未变更
      expect(fileContent[3][0]).toBe("-------");
      expect(fileContent[4][0]).toBe("-------");
    });

    it("should handle files without patch (all lines unmarked)", async () => {
      const changedFiles = [
        {
          filename: "test.ts",
          status: "modified",
          // 没有 patch 字段
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      gitProvider.getFileContent.mockResolvedValue("line1\nline2\nline3");

      const result = await (service as any).getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      const fileContent = result.get("test.ts");
      expect(fileContent).toBeDefined();
      // 所有行都未标记变更
      expect(fileContent[0][0]).toBe("-------");
      expect(fileContent[1][0]).toBe("-------");
      expect(fileContent[2][0]).toBe("-------");
    });

    it("should mark all lines as changed for added files without patch", async () => {
      const changedFiles = [
        {
          filename: "new-file.ts",
          status: "added",
          additions: 3,
          deletions: 0,
          // 没有 patch 字段（Gitea API 可能不返回新增文件的完整 patch）
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      gitProvider.getFileContent.mockResolvedValue("line1\nline2\nline3");

      const result = await (service as any).getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      const fileContent = result.get("new-file.ts");
      expect(fileContent).toBeDefined();
      // 新增文件的所有行都应该标记为变更
      expect(fileContent[0][0]).toBe("abc1234");
      expect(fileContent[1][0]).toBe("abc1234");
      expect(fileContent[2][0]).toBe("abc1234");
    });

    it("should skip deleted files", async () => {
      const changedFiles = [
        {
          filename: "deleted.ts",
          status: "deleted",
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      const result = await (service as any).getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      expect(result.size).toBe(0);
    });
  });

  describe("ReviewService.getChangedFilesBetweenRefs", () => {
    it("should return files with patch from getDiffBetweenRefs", async () => {
      const diffFiles = [
        {
          filename: "test.ts",
          patch: "@@ -1,3 +1,5 @@\n line1\n+new line",
        },
      ];
      const statusFiles = [
        {
          filename: "test.ts",
          status: "modified",
        },
      ];

      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue(diffFiles);
      mockGitSdkService.getChangedFilesBetweenRefs.mockResolvedValue(statusFiles);

      const result = await (service as any).getChangedFilesBetweenRefs(
        "owner",
        "repo",
        "main",
        "feature",
      );

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("test.ts");
      expect(result[0].status).toBe("modified");
      expect(result[0].patch).toBe("@@ -1,3 +1,5 @@\n line1\n+new line");
    });

    it("should use default status when file not in statusFiles", async () => {
      const diffFiles = [
        {
          filename: "new.ts",
          patch: "@@ -0,0 +1,3 @@\n+line1",
        },
      ];
      const statusFiles: any[] = [];

      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue(diffFiles);
      mockGitSdkService.getChangedFilesBetweenRefs.mockResolvedValue(statusFiles);

      const result = await (service as any).getChangedFilesBetweenRefs(
        "owner",
        "repo",
        "main",
        "feature",
      );

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("new.ts");
      expect(result[0].status).toBe("modified");
    });
  });

  describe("ReviewService.filterIssuesByValidCommits", () => {
    beforeEach(() => {
      mockReviewSpecService.parseLineRange = vi.fn().mockImplementation((lineStr: string) => {
        const lines: number[] = [];
        const rangeMatch = lineStr.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) {
            lines.push(i);
          }
        } else {
          const line = parseInt(lineStr, 10);
          if (!isNaN(line)) {
            lines.push(line);
          }
        }
        return lines;
      });
    });

    it("should filter out issues on non-changed lines", () => {
      const issues = [
        {
          file: "test.ts",
          line: "1",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "issue on unchanged line",
        },
        {
          file: "test.ts",
          line: "2",
          ruleId: "R2",
          specFile: "s1.md",
          reason: "issue on changed line",
        },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "new line"],
            ["-------", "line2"],
          ],
        ],
      ]);

      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(1);
      expect(result[0].line).toBe("2");
    });

    it("should keep issues when file not in fileContents", () => {
      const issues = [
        { file: "unknown.ts", line: "1", ruleId: "R1", specFile: "s1.md", reason: "issue" },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map();

      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(1);
    });

    it("should keep issues with range if any line is changed", () => {
      const issues = [
        { file: "test.ts", line: "1-3", ruleId: "R1", specFile: "s1.md", reason: "range issue" },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "new line"],
            ["-------", "line3"],
          ],
        ],
      ]);

      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(1);
    });

    it("should filter out issues with range if no line is changed", () => {
      const issues = [
        { file: "test.ts", line: "1-3", ruleId: "R1", specFile: "s1.md", reason: "range issue" },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["-------", "line2"],
            ["-------", "line3"],
          ],
        ],
      ]);

      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(0);
    });
  });

  describe("ReviewService.resolveAnalyzeDeletions", () => {
    it("should return boolean directly", () => {
      expect(
        (service as any).resolveAnalyzeDeletions(true, { ci: false, hasPrNumber: false }),
      ).toBe(true);
      expect((service as any).resolveAnalyzeDeletions(false, { ci: true, hasPrNumber: true })).toBe(
        false,
      );
    });

    it("should resolve 'ci' mode", () => {
      expect((service as any).resolveAnalyzeDeletions("ci", { ci: true, hasPrNumber: false })).toBe(
        true,
      );
      expect(
        (service as any).resolveAnalyzeDeletions("ci", { ci: false, hasPrNumber: false }),
      ).toBe(false);
    });

    it("should resolve 'pr' mode", () => {
      expect((service as any).resolveAnalyzeDeletions("pr", { ci: false, hasPrNumber: true })).toBe(
        true,
      );
      expect(
        (service as any).resolveAnalyzeDeletions("pr", { ci: false, hasPrNumber: false }),
      ).toBe(false);
    });

    it("should resolve 'terminal' mode", () => {
      expect(
        (service as any).resolveAnalyzeDeletions("terminal", { ci: false, hasPrNumber: false }),
      ).toBe(true);
      expect(
        (service as any).resolveAnalyzeDeletions("terminal", { ci: true, hasPrNumber: false }),
      ).toBe(false);
    });

    it("should return false for unknown mode", () => {
      expect(
        (service as any).resolveAnalyzeDeletions("unknown", { ci: false, hasPrNumber: false }),
      ).toBe(false);
    });
  });

  describe("ReviewService.calculateIssueStats", () => {
    it("should calculate stats for empty array", () => {
      const stats = (service as any).calculateIssueStats([]);
      expect(stats).toEqual({ total: 0, fixed: 0, invalid: 0, pending: 0, fixRate: 0 });
    });

    it("should calculate stats correctly", () => {
      const issues = [{ fixed: "2024-01-01" }, { fixed: "2024-01-02" }, { valid: "false" }, {}, {}];
      const stats = (service as any).calculateIssueStats(issues);
      expect(stats.total).toBe(5);
      expect(stats.fixed).toBe(2);
      expect(stats.invalid).toBe(1);
      expect(stats.pending).toBe(2);
      expect(stats.fixRate).toBe(40);
    });
  });

  describe("ReviewService.filterSpecsForFile", () => {
    it("should return empty for files without extension", () => {
      const specs = [{ extensions: ["ts"], includes: [], rules: [] }];
      expect((service as any).filterSpecsForFile(specs, "Makefile")).toEqual([]);
    });

    it("should filter by extension", () => {
      const specs = [
        { extensions: ["ts"], includes: [], rules: [{ id: "R1" }] },
        { extensions: ["py"], includes: [], rules: [{ id: "R2" }] },
      ];
      const result = (service as any).filterSpecsForFile(specs, "src/app.ts");
      expect(result).toHaveLength(1);
      expect(result[0].rules[0].id).toBe("R1");
    });

    it("should filter by includes pattern when present", () => {
      const specs = [{ extensions: ["ts"], includes: ["**/*.spec.ts"], rules: [{ id: "R1" }] }];
      expect((service as any).filterSpecsForFile(specs, "src/app.spec.ts")).toHaveLength(1);
      expect((service as any).filterSpecsForFile(specs, "src/app.ts")).toHaveLength(0);
    });
  });

  describe("ReviewService.buildSystemPrompt", () => {
    it("should include specs section in prompt", () => {
      const result = (service as any).buildSystemPrompt("## 规则内容");
      expect(result).toContain("## 规则内容");
      expect(result).toContain("代码审查专家");
    });
  });

  describe("ReviewService.formatReviewComment", () => {
    it("should use markdown format in CI with PR", () => {
      const result = { issues: [], summary: [] };
      (service as any).formatReviewComment(result, { ci: true, prNumber: 1 });
      expect((service as any).reviewReportService.formatMarkdown).toHaveBeenCalled();
    });

    it("should use terminal format by default", () => {
      const result = { issues: [], summary: [] };
      (service as any).formatReviewComment(result, {});
      expect((service as any).reviewReportService.format).toHaveBeenCalledWith(result, "terminal");
    });

    it("should use specified outputFormat", () => {
      const result = { issues: [], summary: [] };
      (service as any).formatReviewComment(result, { outputFormat: "markdown" });
      expect((service as any).reviewReportService.formatMarkdown).toHaveBeenCalled();
    });
  });

  describe("ReviewService.lineMatchesPosition", () => {
    it("should return false when no position", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      expect((service as any).lineMatchesPosition("10", undefined)).toBe(false);
    });

    it("should return true when position is within range", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10, 11, 12]);
      expect((service as any).lineMatchesPosition("10-12", 11)).toBe(true);
    });

    it("should return false when position is outside range", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10, 11, 12]);
      expect((service as any).lineMatchesPosition("10-12", 15)).toBe(false);
    });

    it("should return false for empty line range", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([]);
      expect((service as any).lineMatchesPosition("", 10)).toBe(false);
    });
  });

  describe("ReviewService.issueToReviewComment", () => {
    it("should return null for invalid line", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([]);
      const issue = { file: "test.ts", line: "abc", ruleId: "R1", specFile: "s1.md", reason: "r" };
      expect((service as any).issueToReviewComment(issue)).toBeNull();
    });

    it("should convert issue to review comment", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      const issue = {
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "问题描述",
        severity: "error",
        author: { login: "dev1" },
        suggestion: "fix code",
      };
      const result = (service as any).issueToReviewComment(issue);
      expect(result).not.toBeNull();
      expect(result.path).toBe("test.ts");
      expect(result.new_position).toBe(10);
      expect(result.body).toContain("🔴");
      expect(result.body).toContain("@dev1");
      expect(result.body).toContain("fix code");
    });

    it("should handle warn severity", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([5]);
      const issue = {
        file: "test.ts",
        line: "5",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r",
        severity: "warn",
      };
      const result = (service as any).issueToReviewComment(issue);
      expect(result.body).toContain("🟡");
    });

    it("should handle issue without author", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([5]);
      const issue = {
        file: "test.ts",
        line: "5",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r",
        severity: "info",
      };
      const result = (service as any).issueToReviewComment(issue);
      expect(result.body).toContain("未知");
      expect(result.body).toContain("⚪");
    });

    it("should include commit info when present", () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([5]);
      const issue = {
        file: "test.ts",
        line: "5",
        ruleId: "R1",
        specFile: "s1.md",
        reason: "r",
        commit: "abc1234",
      };
      const result = (service as any).issueToReviewComment(issue);
      expect(result.body).toContain("abc1234");
    });
  });

  describe("ReviewService.generateIssueKey", () => {
    it("should generate key from file, line, and ruleId", () => {
      const issue = { file: "test.ts", line: "10", ruleId: "R1" };
      expect((service as any).generateIssueKey(issue)).toBe("test.ts:10:R1");
    });
  });

  describe("ReviewService.parseExistingReviewResult", () => {
    it("should return null when parseMarkdown returns null", () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.parseMarkdown.mockReturnValue(null);
      expect((service as any).parseExistingReviewResult("body")).toBeNull();
    });

    it("should return result from parsed markdown", () => {
      const mockReviewReportService = (service as any).reviewReportService;
      const mockResult = { issues: [{ id: 1 }], summary: [] };
      mockReviewReportService.parseMarkdown.mockReturnValue({ result: mockResult });
      expect((service as any).parseExistingReviewResult("body")).toEqual(mockResult);
    });
  });

  describe("ReviewService.filterDuplicateIssues", () => {
    it("should filter issues that exist in valid existing issues", () => {
      const newIssues = [
        { file: "a.ts", line: "1", ruleId: "R1" },
        { file: "b.ts", line: "2", ruleId: "R2" },
      ];
      const existingIssues = [{ file: "a.ts", line: "1", ruleId: "R1", valid: "true" }];
      const result = (service as any).filterDuplicateIssues(newIssues, existingIssues);
      expect(result.filteredIssues).toHaveLength(1);
      expect(result.filteredIssues[0].file).toBe("b.ts");
      expect(result.skippedCount).toBe(1);
    });

    it("should not filter if existing issue is not valid", () => {
      const newIssues = [{ file: "a.ts", line: "1", ruleId: "R1" }];
      const existingIssues = [{ file: "a.ts", line: "1", ruleId: "R1", valid: "false" }];
      const result = (service as any).filterDuplicateIssues(newIssues, existingIssues);
      expect(result.filteredIssues).toHaveLength(1);
      expect(result.skippedCount).toBe(0);
    });
  });

  describe("ReviewService.getFallbackTitle", () => {
    it("should return first commit message", () => {
      const commits = [{ commit: { message: "feat: add feature\n\ndetails" } }];
      expect((service as any).getFallbackTitle(commits)).toBe("feat: add feature");
    });

    it("should return default when no commits", () => {
      expect((service as any).getFallbackTitle([])).toBe("PR 更新");
    });

    it("should truncate long titles", () => {
      const commits = [{ commit: { message: "a".repeat(100) } }];
      expect((service as any).getFallbackTitle(commits).length).toBeLessThanOrEqual(50);
    });
  });

  describe("ReviewService.normalizeFilePaths", () => {
    it("should return undefined for empty array", () => {
      expect((service as any).normalizeFilePaths([])).toEqual([]);
    });

    it("should return undefined for undefined input", () => {
      expect((service as any).normalizeFilePaths(undefined)).toBeUndefined();
    });

    it("should keep relative paths as-is", () => {
      const result = (service as any).normalizeFilePaths(["src/app.ts", "lib/util.ts"]);
      expect(result).toEqual(["src/app.ts", "lib/util.ts"]);
    });
  });

  describe("ReviewService.getExistingReviewResult", () => {
    it("should return null when no AI review exists", async () => {
      gitProvider.listPullReviews.mockResolvedValue([{ body: "normal review" }] as any);
      const result = await (service as any).getExistingReviewResult("o", "r", 1);
      expect(result).toBeNull();
    });

    it("should return parsed result when AI review exists", async () => {
      const mockResult = { issues: [], summary: [] };
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.parseMarkdown.mockReturnValue({ result: mockResult });
      gitProvider.listPullReviews.mockResolvedValue([
        { body: "<!-- spaceflow-review --> review content" },
      ] as any);
      const result = await (service as any).getExistingReviewResult("o", "r", 1);
      expect(result).toEqual(mockResult);
    });

    it("should return null on error", async () => {
      gitProvider.listPullReviews.mockRejectedValue(new Error("API error"));
      const result = await (service as any).getExistingReviewResult("o", "r", 1);
      expect(result).toBeNull();
    });
  });

  describe("ReviewService.deleteExistingAiReviews", () => {
    it("should delete AI reviews", async () => {
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> old review" },
        { id: 2, body: "normal review" },
      ] as any);
      gitProvider.deletePullReview.mockResolvedValue(undefined as any);
      await (service as any).deleteExistingAiReviews("o", "r", 1);
      expect(gitProvider.deletePullReview).toHaveBeenCalledWith("o", "r", 1, 1);
      expect(gitProvider.deletePullReview).toHaveBeenCalledTimes(1);
    });

    it("should handle error gracefully", async () => {
      gitProvider.listPullReviews.mockRejectedValue(new Error("fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await (service as any).deleteExistingAiReviews("o", "r", 1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("ReviewService.invalidateIssuesForChangedFiles", () => {
    it("should return issues unchanged when no headSha", async () => {
      const issues = [{ file: "a.ts", line: "1" }];
      const result = await (service as any).invalidateIssuesForChangedFiles(
        issues,
        undefined,
        "o",
        "r",
      );
      expect(result).toBe(issues);
    });

    it("should invalidate issues for changed files", async () => {
      gitProvider.getCommitDiff = vi
        .fn()
        .mockResolvedValue(
          "diff --git a/changed.ts b/changed.ts\n--- a/changed.ts\n+++ b/changed.ts\n@@ -1,1 +1,2 @@\n line1\n+new",
        ) as any;
      const issues = [
        { file: "changed.ts", line: "1", ruleId: "R1" },
        { file: "unchanged.ts", line: "2", ruleId: "R2" },
        { file: "changed.ts", line: "3", ruleId: "R3", fixed: "2024-01-01" },
      ];
      const result = await (service as any).invalidateIssuesForChangedFiles(
        issues,
        "abc123",
        "o",
        "r",
      );
      expect(result).toHaveLength(3);
      expect(result[0].valid).toBe("false");
      expect(result[1].valid).toBeUndefined();
      expect(result[2].fixed).toBe("2024-01-01");
    });

    it("should return issues unchanged when no diff files", async () => {
      gitProvider.getCommitDiff = vi.fn().mockResolvedValue("") as any;
      const issues = [{ file: "a.ts", line: "1" }];
      const result = await (service as any).invalidateIssuesForChangedFiles(
        issues,
        "abc123",
        "o",
        "r",
      );
      expect(result).toBe(issues);
    });

    it("should handle API error gracefully", async () => {
      gitProvider.getCommitDiff = vi.fn().mockRejectedValue(new Error("fail")) as any;
      const issues = [{ file: "a.ts", line: "1" }];
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await (service as any).invalidateIssuesForChangedFiles(
        issues,
        "abc123",
        "o",
        "r",
      );
      expect(result).toBe(issues);
      consoleSpy.mockRestore();
    });
  });

  describe("ReviewService.fillIssueCode", () => {
    it("should fill code from file contents", async () => {
      const issues = [{ file: "test.ts", line: "2" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "line2"],
            ["-------", "line3"],
          ],
        ],
      ]);
      const result = await (service as any).fillIssueCode(issues, fileContents);
      expect(result[0].code).toBe("line2");
    });

    it("should handle range lines", async () => {
      const issues = [{ file: "test.ts", line: "1-2" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "line2"],
            ["-------", "line3"],
          ],
        ],
      ]);
      const result = await (service as any).fillIssueCode(issues, fileContents);
      expect(result[0].code).toBe("line1\nline2");
    });

    it("should return issue unchanged if file not found", async () => {
      const issues = [{ file: "missing.ts", line: "1" }];
      const result = await (service as any).fillIssueCode(issues, new Map());
      expect(result[0].code).toBeUndefined();
    });

    it("should return issue unchanged if line out of range", async () => {
      const issues = [{ file: "test.ts", line: "999" }];
      const fileContents = new Map([["test.ts", [["-------", "line1"]]]]);
      const result = await (service as any).fillIssueCode(issues, fileContents);
      expect(result[0].code).toBeUndefined();
    });

    it("should return issue unchanged if line is NaN", async () => {
      const issues = [{ file: "test.ts", line: "abc" }];
      const fileContents = new Map([["test.ts", [["-------", "line1"]]]]);
      const result = await (service as any).fillIssueCode(issues, fileContents);
      expect(result[0].code).toBeUndefined();
    });
  });

  describe("ReviewService.fillIssueAuthors", () => {
    it("should fill author from commit with platform user", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "abc1234" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: { id: 1, login: "dev1" },
          commit: { author: { name: "Dev", email: "dev@test.com" } },
        },
      ];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].author.login).toBe("dev1");
    });

    it("should use default author when commit not matched", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "zzz9999" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: { id: 1, login: "dev1" },
          commit: { author: { name: "Dev", email: "dev@test.com" } },
        },
      ];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].author.login).toBe("dev1");
    });

    it("should keep existing author", async () => {
      const issues = [{ file: "test.ts", line: "1", author: { id: "99", login: "existing" } }];
      const commits = [{ sha: "abc1234567890", author: { id: 1, login: "dev1" } }];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].author.login).toBe("existing");
    });

    it("should use git author name when no platform user", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "abc1234" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: null,
          committer: null,
          commit: { author: { name: "GitUser", email: "git@test.com" } },
        },
      ];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].author.login).toBe("GitUser");
    });

    it("should handle issues with ------- commit hash", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "-------" }];
      const commits = [
        { sha: "abc1234567890", author: { id: 1, login: "dev1" }, commit: { author: {} } },
      ];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].author.login).toBe("dev1");
    });
  });

  describe("ReviewService.reviewSingleFile", () => {
    it("should return issues from LLM stream", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: {
            structuredOutput: {
              issues: [{ file: "test.ts", line: "1", ruleId: "R1", reason: "bad" }],
              summary: "found issues",
            },
          },
        };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const filePrompt = { filename: "test.ts", systemPrompt: "sys", userPrompt: "user" };
      const result = await (service as any).reviewSingleFile("openai", filePrompt, 2);
      expect(result.issues).toHaveLength(1);
      expect(result.summary.file).toBe("test.ts");
    });

    it("should throw on error event", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "error", message: "LLM failed" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const filePrompt = { filename: "test.ts", systemPrompt: "sys", userPrompt: "user" };
      await expect((service as any).reviewSingleFile("openai", filePrompt)).rejects.toThrow(
        "LLM failed",
      );
    });

    it("should return empty issues when no structured output", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "result", response: {} };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const filePrompt = { filename: "test.ts", systemPrompt: "sys", userPrompt: "user" };
      const result = await (service as any).reviewSingleFile("openai", filePrompt);
      expect(result.issues).toHaveLength(0);
      expect(result.summary.summary).toBe("");
    });
  });

  describe("ReviewService.postOrUpdateReviewComment", () => {
    it("should post review comment", async () => {
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc123" } } as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const result = { issues: [], summary: [], round: 1 };
      await (service as any).postOrUpdateReviewComment("o", "r", 1, result);
      expect(gitProvider.createPullReview).toHaveBeenCalled();
    });

    it("should update PR title when autoUpdatePrTitle enabled", async () => {
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({ autoUpdatePrTitle: true });
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.editPullRequest.mockResolvedValue({} as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc123" } } as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const result = { issues: [], summary: [], round: 1, title: "New Title" };
      await (service as any).postOrUpdateReviewComment("o", "r", 1, result);
      expect(gitProvider.editPullRequest).toHaveBeenCalledWith("o", "r", 1, { title: "New Title" });
    });

    it("should handle createPullReview error gracefully", async () => {
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc123" } } as any);
      gitProvider.createPullReview.mockRejectedValue(new Error("fail") as any);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = { issues: [], summary: [], round: 1 };
      await (service as any).postOrUpdateReviewComment("o", "r", 1, result);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should include line comments when configured", async () => {
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({ lineComments: true });
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc123" } } as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const result = {
        issues: [
          {
            file: "test.ts",
            line: "10",
            ruleId: "R1",
            specFile: "s.md",
            reason: "r",
            severity: "error",
          },
        ],
        summary: [],
        round: 1,
      };
      await (service as any).postOrUpdateReviewComment("o", "r", 1, result);
      const callArgs = gitProvider.createPullReview.mock.calls[0];
      expect(callArgs[3].comments.length).toBeGreaterThan(0);
    });
  });

  describe("ReviewService.syncResolvedComments", () => {
    it("should mark matched issues as fixed", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { path: "test.ts", position: 10, resolver: { login: "user1" } },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10" }] };
      await (service as any).syncResolvedComments("o", "r", 1, result);
      expect((result.issues[0] as any).fixed).toBeDefined();
    });

    it("should skip resolved comments with no resolver", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { path: "test.ts", position: 10, resolver: null },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10" }] };
      await (service as any).syncResolvedComments("o", "r", 1, result);
      expect((result.issues[0] as any).fixed).toBeUndefined();
    });

    it("should skip when no AI review found", async () => {
      gitProvider.listPullReviews.mockResolvedValue([{ id: 1, body: "normal review" }] as any);
      const result = { issues: [{ file: "test.ts", line: "10", fixed: false }] };
      await (service as any).syncResolvedComments("o", "r", 1, result);
      expect(result.issues[0].fixed).toBe(false);
    });

    it("should handle error gracefully", async () => {
      gitProvider.listPullReviews.mockRejectedValue(new Error("fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = { issues: [] };
      await (service as any).syncResolvedComments("o", "r", 1, result);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("ReviewService.callLLM", () => {
    it("should aggregate results from multiple files", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield {
          type: "result",
          response: {
            structuredOutput: {
              issues: [{ file: "a.ts", line: "1", ruleId: "R1", reason: "bad" }],
              summary: "ok",
            },
          },
        };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const reviewPrompt = {
        filePrompts: [{ filename: "a.ts", systemPrompt: "sys", userPrompt: "user" }],
      };
      const result = await (service as any).callLLM("openai", reviewPrompt);
      expect(result.issues).toHaveLength(1);
      expect(result.summary).toHaveLength(1);
    });

    it("should handle failed file review", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "error", message: "LLM failed" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const reviewPrompt = {
        filePrompts: [{ filename: "a.ts", systemPrompt: "sys", userPrompt: "user" }],
      };
      const result = await (service as any).callLLM("openai", reviewPrompt);
      expect(result.summary[0].summary).toContain("审查失败");
    });
  });

  describe("ReviewService.executeCollectOnly", () => {
    it("should return empty result when no existing review", async () => {
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      const result = await (service as any).executeCollectOnly(context);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("should throw when no prNumber", async () => {
      const context = { owner: "o", repo: "r", ci: false, dryRun: false };
      await expect((service as any).executeCollectOnly(context)).rejects.toThrow(
        "collectOnly 模式必须指定 PR 编号",
      );
    });

    it("should collect and return existing review result", async () => {
      const mockResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.parseMarkdown.mockReturnValue({ result: mockResult });
      mockReviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats");
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({} as any);
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      const result = await (service as any).executeCollectOnly(context);
      expect(result.issues).toHaveLength(1);
      expect(result.stats).toBeDefined();
    });
  });

  describe("ReviewService.executeDeletionOnly", () => {
    it("should throw when no llmMode", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      await expect((service as any).executeDeletionOnly(context)).rejects.toThrow(
        "必须指定 LLM 类型",
      );
    });

    it("should execute deletion analysis with PR", async () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.formatMarkdown.mockReturnValue("report");
      mockDeletionImpactService.analyzeDeletionImpact.mockResolvedValue({
        issues: [],
        summary: "ok",
      });
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
      ] as any);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      const context = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: false,
        dryRun: false,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
        verbose: 1,
      };
      const result = await (service as any).executeDeletionOnly(context);
      expect(result.success).toBe(true);
      expect(result.deletionImpact).toBeDefined();
    });

    it("should post comment in CI mode for deletionOnly", async () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.formatMarkdown.mockReturnValue("report");
      mockDeletionImpactService.analyzeDeletionImpact.mockResolvedValue({
        issues: [],
        summary: "ok",
      });
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
      ] as any);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      const context = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: true,
        dryRun: false,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
        verbose: 1,
      };
      const result = await (service as any).executeDeletionOnly(context);
      expect(result.success).toBe(true);
      expect(gitProvider.createPullReview).toHaveBeenCalled();
    });
  });

  describe("ReviewService.getContextFromEnv - more branches", () => {
    it("should get repo from git remote when no ci.repository", async () => {
      configService.get.mockReturnValue({ repository: "", refName: "main" });
      mockGitSdkService.getRemoteUrl.mockReturnValue("https://github.com/owner/repo.git");
      mockGitSdkService.parseRepositoryFromRemoteUrl.mockReturnValue({
        owner: "owner",
        repo: "repo",
      });
      const options = { dryRun: false, ci: false };
      const context = await service.getContextFromEnv(options as any);
      expect(context.owner).toBe("owner");
      expect(context.repo).toBe("repo");
    });

    it("should throw when remote parse returns null", async () => {
      configService.get.mockReturnValue({ repository: "", refName: "main" });
      mockGitSdkService.getRemoteUrl.mockReturnValue("https://github.com/owner/repo.git");
      mockGitSdkService.parseRepositoryFromRemoteUrl.mockReturnValue(null);
      const options = { dryRun: false, ci: false };
      await expect(service.getContextFromEnv(options as any)).rejects.toThrow(
        "缺少配置 ci.repository",
      );
    });

    it("should auto-detect prNumber from event in CI mode", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      vi.spyOn(service as any, "getPrNumberFromEvent").mockResolvedValue(42);
      gitProvider.getPullRequest.mockResolvedValue({ title: "feat: test" } as any);
      const options = { dryRun: false, ci: true, verbose: 1 };
      const context = await service.getContextFromEnv(options as any);
      expect(context.prNumber).toBe(42);
    });

    it("should handle getPullRequest failure when parsing title", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      gitProvider.getPullRequest.mockRejectedValue(new Error("API error"));
      const options = { dryRun: false, ci: true, prNumber: 1, verbose: 1 };
      const context = await service.getContextFromEnv(options as any);
      expect(context.prNumber).toBe(1);
    });

    it("should parse title options with verbose logging", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      gitProvider.getPullRequest.mockResolvedValue({
        title: "feat: test [/review -d -v 2]",
      } as any);
      const options = { dryRun: false, ci: true, prNumber: 1, verbose: 1 };
      const context = await service.getContextFromEnv(options as any);
      expect(context.dryRun).toBe(true);
    });

    it("should throw for invalid repository format", async () => {
      configService.get.mockReturnValue({ repository: "invalid", refName: "main" });
      const options = { dryRun: false, ci: false };
      await expect(service.getContextFromEnv(options as any)).rejects.toThrow(
        "ci.repository 格式不正确",
      );
    });

    it("should normalize absolute file paths", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      const options = {
        dryRun: false,
        ci: false,
        files: ["/absolute/path/to/file.ts", "relative.ts"],
      };
      const context = await service.getContextFromEnv(options as any);
      expect(context.files).toBeDefined();
      expect(context.files![1]).toBe("relative.ts");
    });

    it("should auto-detect base/head with verbose logging", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      mockGitSdkService.getCurrentBranch.mockReturnValue("feature");
      mockGitSdkService.getDefaultBranch.mockReturnValue("main");
      const options = { dryRun: false, ci: false, verbose: 1 };
      const context = await service.getContextFromEnv(options as any);
      expect(context.headRef).toBe("feature");
      expect(context.baseRef).toBe("main");
    });

    it("should auto-detect base/head when no PR and no refs", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      mockGitSdkService.getCurrentBranch.mockReturnValue("feature");
      mockGitSdkService.getDefaultBranch.mockReturnValue("main");
      const options = { dryRun: false, ci: false };
      const context = await service.getContextFromEnv(options as any);
      expect(context.headRef).toBe("feature");
      expect(context.baseRef).toBe("main");
    });

    it("should merge references from options and config", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({ references: ["config-ref"] });
      const options = { dryRun: false, ci: false, references: ["opt-ref"] };
      const context = await service.getContextFromEnv(options as any);
      expect(context.specSources).toContain("opt-ref");
      expect(context.specSources).toContain("config-ref");
    });

    it("should parse title options in CI mode with PR", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      gitProvider.getPullRequest.mockResolvedValue({ title: "feat: test [/review -d]" } as any);
      const options = { dryRun: false, ci: true, prNumber: 1 };
      const context = await service.getContextFromEnv(options as any);
      expect(context.dryRun).toBe(true);
    });
  });

  describe("ReviewService.ensureClaudeCli", () => {
    it("should not throw when claude is installed", async () => {
      vi.spyOn(require("child_process"), "execSync").mockImplementation(() => Buffer.from("1.0.0"));
      await expect((service as any).ensureClaudeCli()).resolves.toBeUndefined();
    });
  });

  describe("ReviewService.getFileDirectoryInfo", () => {
    it("should return root directory marker for root files", async () => {
      const result = await (service as any).getFileDirectoryInfo("file.ts");
      expect(result).toBe("（根目录）");
    });
  });

  describe("ReviewService.getCommitsBetweenRefs", () => {
    it("should return commits from git sdk", async () => {
      mockGitSdkService.getCommitsBetweenRefs.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ]);
      const result = await (service as any).getCommitsBetweenRefs("main", "feature");
      expect(result).toHaveLength(1);
    });
  });

  describe("ReviewService.getFilesForCommit", () => {
    it("should return files from git sdk", async () => {
      mockGitSdkService.getFilesForCommit.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
      ]);
      const result = await (service as any).getFilesForCommit("abc123");
      expect(result).toHaveLength(1);
    });
  });

  describe("ReviewService.syncReactionsToIssues", () => {
    it("should skip when no AI review found", async () => {
      gitProvider.listPullReviews.mockResolvedValue([{ body: "normal" }] as any);
      const result = { issues: [] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues).toEqual([]);
    });

    it("should handle error gracefully", async () => {
      gitProvider.listPullReviews.mockRejectedValue(new Error("fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = { issues: [] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should mark issue as invalid on thumbs down from reviewer", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content", user: { login: "bot" } },
        { id: 2, body: "LGTM", user: { login: "reviewer1" } },
      ] as any);
      gitProvider.getPullRequest.mockResolvedValue({
        requested_reviewers: [],
        requested_reviewers_teams: [],
      } as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { id: 100, path: "test.ts", position: 10 },
      ] as any);
      gitProvider.getIssueCommentReactions.mockResolvedValue([
        { content: "-1", user: { login: "reviewer1" } },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10", valid: "true" }] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues[0].valid).toBe("false");
    });

    it("should add requested_reviewers to reviewers set", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content", user: { login: "bot" } },
      ] as any);
      gitProvider.getPullRequest.mockResolvedValue({
        requested_reviewers: [{ login: "req-reviewer" }],
        requested_reviewers_teams: [],
      } as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { id: 100, path: "test.ts", position: 10 },
      ] as any);
      gitProvider.getIssueCommentReactions.mockResolvedValue([
        { content: "-1", user: { login: "req-reviewer" } },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10", valid: "true" }] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues[0].valid).toBe("false");
    });

    it("should skip comments without id", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.getPullRequest.mockResolvedValue({
        requested_reviewers: [],
        requested_reviewers_teams: [],
      } as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { path: "test.ts", position: 10 },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10", reactions: [] }] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues[0].reactions).toHaveLength(0);
    });

    it("should skip when reactions are empty", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.getPullRequest.mockResolvedValue({
        requested_reviewers: [],
        requested_reviewers_teams: [],
      } as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { id: 100, path: "test.ts", position: 10 },
      ] as any);
      gitProvider.getIssueCommentReactions.mockResolvedValue([] as any);
      const result = { issues: [{ file: "test.ts", line: "10", reactions: [] }] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues[0].reactions).toHaveLength(0);
    });

    it("should store multiple reaction types", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.getPullRequest.mockResolvedValue({
        requested_reviewers: [],
        requested_reviewers_teams: [],
      } as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { id: 100, path: "test.ts", position: 10 },
      ] as any);
      gitProvider.getIssueCommentReactions.mockResolvedValue([
        { content: "+1", user: { login: "user1" } },
        { content: "+1", user: { login: "user2" } },
        { content: "heart", user: { login: "user1" } },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10", reactions: [] }] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues[0].reactions).toHaveLength(2);
    });

    it("should not mark as invalid when thumbs down from non-reviewer", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.getPullRequest.mockResolvedValue({
        requested_reviewers: [],
        requested_reviewers_teams: [],
      } as any);
      gitProvider.listPullReviewComments.mockResolvedValue([
        { id: 100, path: "test.ts", position: 10 },
      ] as any);
      gitProvider.getIssueCommentReactions.mockResolvedValue([
        { content: "-1", user: { login: "random-user" } },
      ] as any);
      const result = { issues: [{ file: "test.ts", line: "10", valid: "true", reactions: [] }] };
      await (service as any).syncReactionsToIssues("o", "r", 1, result);
      expect(result.issues[0].valid).toBe("true");
    });
  });

  describe("ReviewService.buildReviewPrompt", () => {
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
      const result = await (service as any).buildReviewPrompt(
        specs,
        changedFiles,
        fileContents,
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
      const result = await (service as any).buildReviewPrompt(specs, changedFiles, new Map(), []);
      expect(result.filePrompts).toHaveLength(0);
    });

    it("should handle missing file contents", async () => {
      const specs = [{ extensions: ["ts"], includes: [], rules: [] }];
      const changedFiles = [{ filename: "test.ts", status: "modified" }];
      const result = await (service as any).buildReviewPrompt(specs, changedFiles, new Map(), []);
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
      const result = await (service as any).buildReviewPrompt(
        specs,
        changedFiles,
        fileContents,
        [],
        existingResult,
      );
      expect(result.filePrompts[0].userPrompt).toContain("bad code");
    });
  });

  describe("ReviewService.generatePrDescription", () => {
    it("should generate description from LLM", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "text", content: "# Feat: 新功能\n\n详细描述" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc123", commit: { message: "feat: add" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const result = await (service as any).generatePrDescription(commits, changedFiles, "openai");
      expect(result.title).toBe("Feat: 新功能");
      expect(result.description).toContain("详细描述");
    });

    it("should fallback on LLM error", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "error", message: "fail" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc123", commit: { message: "feat: add" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const result = await (service as any).generatePrDescription(commits, changedFiles, "openai");
      expect(result.title).toBeDefined();
    });

    it("should include code changes section when fileContents provided", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: test\n\ndesc" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc123", commit: { message: "feat" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const fileContents = new Map([["a.ts", [["abc1234", "new code"]]]]);
      const result = await (service as any).generatePrDescription(
        commits,
        changedFiles,
        "openai",
        fileContents,
      );
      expect(result.title).toBeDefined();
    });
  });

  describe("ReviewService.generatePrTitle", () => {
    it("should generate title from LLM", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: 新功能" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc", commit: { message: "feat: add" } }];
      const changedFiles = [{ filename: "a.ts", status: "modified" }];
      const result = await (service as any).generatePrTitle(commits, changedFiles);
      expect(result).toBe("Feat: 新功能");
    });

    it("should fallback on error", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "error", message: "fail" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc", commit: { message: "feat: add feature" } }];
      const result = await (service as any).generatePrTitle(commits, []);
      expect(result).toBe("feat: add feature");
    });
  });

  describe("ReviewService.syncRepliesToIssues", () => {
    it("should sync replies to matched issues", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockReturnValue([10]);
      const reviewComments = [
        {
          id: 1,
          path: "test.ts",
          position: 10,
          body: "original",
          user: { id: 1, login: "bot" },
          created_at: "2024-01-01",
        },
        {
          id: 2,
          path: "test.ts",
          position: 10,
          body: "reply",
          user: { id: 2, login: "dev" },
          created_at: "2024-01-02",
        },
      ];
      const result = { issues: [{ file: "test.ts", line: "10", replies: [] }] };
      await (service as any).syncRepliesToIssues("o", "r", 1, reviewComments, result);
      expect(result.issues[0].replies).toHaveLength(1);
      expect(result.issues[0].replies[0].body).toBe("reply");
    });

    it("should skip comments without path or position", async () => {
      const reviewComments = [{ id: 1, body: "no path" }];
      const result = { issues: [] };
      await (service as any).syncRepliesToIssues("o", "r", 1, reviewComments, result);
      expect(result.issues).toEqual([]);
    });

    it("should handle error gracefully", async () => {
      mockReviewSpecService.parseLineRange = vi.fn().mockImplementation(() => {
        throw new Error("fail");
      });
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const reviewComments = [
        { id: 1, path: "test.ts", position: 10, body: "a", created_at: "2024-01-01" },
        { id: 2, path: "test.ts", position: 10, body: "b", created_at: "2024-01-02" },
      ];
      const result = { issues: [{ file: "test.ts", line: "10", replies: [] }] };
      await (service as any).syncRepliesToIssues("o", "r", 1, reviewComments, result);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("ReviewService.execute - CI with existingResult", () => {
    beforeEach(() => {
      vi.spyOn(service as any, "runLLMReview").mockResolvedValue({
        success: true,
        issues: [{ file: "test.ts", line: "5", ruleId: "R1", reason: "new issue" }],
        summary: [{ file: "test.ts", summary: "ok" }],
      });
      vi.spyOn(service as any, "buildLineCommitMap").mockResolvedValue(new Map());
      vi.spyOn(service as any, "getFileContents").mockResolvedValue(new Map());
    });

    it("should merge existing issues with new issues in CI mode", async () => {
      vi.spyOn(service as any, "getExistingReviewResult").mockResolvedValue({
        issues: [{ file: "old.ts", line: "1", ruleId: "R2", reason: "old issue", valid: "true" }],
        summary: [],
        round: 1,
      });
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } } as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" }, author: { id: 1, login: "dev" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
      ] as any);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        specSources: ["/spec"],
        dryRun: false,
        ci: true,
        llmMode: "openai",
        verifyFixes: false,
        verbose: 1,
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
      expect(result.round).toBe(2);
    });

    it("should verify fixes when verifyFixes is true", async () => {
      vi.spyOn(service as any, "getExistingReviewResult").mockResolvedValue({
        issues: [{ file: "old.ts", line: "1", ruleId: "R2", reason: "old", valid: "true" }],
        summary: [],
        round: 1,
      });
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } } as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" }, author: { id: 1, login: "dev" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
      ] as any);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        specSources: ["/spec"],
        dryRun: false,
        ci: true,
        llmMode: "openai",
        verifyFixes: true,
        verifyConcurrency: 5,
        verbose: 1,
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });
  });

  describe("ReviewService.execute - filterCommits branch", () => {
    beforeEach(() => {
      vi.spyOn(service as any, "runLLMReview").mockResolvedValue({
        success: true,
        issues: [],
        summary: [],
      });
      vi.spyOn(service as any, "buildLineCommitMap").mockResolvedValue(new Map());
      vi.spyOn(service as any, "getFileContents").mockResolvedValue(new Map());
      vi.spyOn(service as any, "getExistingReviewResult").mockResolvedValue(null);
    });

    it("should filter by specified commits", async () => {
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } } as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix a" } },
        { sha: "def456", commit: { message: "fix b" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
        { filename: "b.ts", status: "modified" },
      ] as any);
      gitProvider.getCommit.mockResolvedValue({ files: [{ filename: "a.ts" }] } as any);
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        specSources: ["/spec"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        commits: ["abc123"],
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should execute with verbose logging", async () => {
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } } as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
      ] as any);
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        specSources: ["/spec"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        verbose: 1,
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should execute with verbose logging level 2", async () => {
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } } as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "test.ts", status: "modified" },
      ] as any);
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        specSources: ["/spec"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        verbose: 2,
        showAll: true,
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });

    it("should execute with files filter", async () => {
      gitProvider.getPullRequest.mockResolvedValue({ title: "PR", head: { sha: "abc" } } as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc123", commit: { message: "fix" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
        { filename: "b.ts", status: "modified" },
      ] as any);
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        specSources: ["/spec"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        files: ["a.ts"],
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
    });
  });

  describe("ReviewService.fillIssueAuthors - searchUsers success", () => {
    it("should use searchUsers result for git-only authors", async () => {
      gitProvider.searchUsers.mockResolvedValue([{ id: 42, login: "found-user" }] as any);
      const issues = [{ file: "test.ts", line: "1", commit: "abc1234" }];
      const commits = [
        {
          sha: "abc1234567890",
          author: null,
          committer: null,
          commit: { author: { name: "GitUser", email: "git@test.com" } },
        },
      ];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].author.login).toBe("found-user");
    });
  });

  describe("ReviewService.executeDeletionOnly - baseRef/headRef mode", () => {
    it("should execute with baseRef/headRef instead of PR", async () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.formatMarkdown.mockReturnValue("report");
      mockDeletionImpactService.analyzeDeletionImpact.mockResolvedValue({
        issues: [],
        summary: "ok",
      });
      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue([
        { filename: "a.ts", patch: "", status: "modified" },
      ]);
      mockGitSdkService.getCommitsBetweenRefs.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ]);
      const context = {
        owner: "o",
        repo: "r",
        baseRef: "main",
        headRef: "feature",
        ci: false,
        dryRun: true,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
      };
      const result = await (service as any).executeDeletionOnly(context);
      expect(result.success).toBe(true);
    });

    it("should filter files by includes in deletionOnly", async () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.formatMarkdown.mockReturnValue("report");
      mockDeletionImpactService.analyzeDeletionImpact.mockResolvedValue({
        issues: [],
        summary: "ok",
      });
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ] as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
        { filename: "b.md", status: "modified" },
      ] as any);
      const context = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: false,
        dryRun: true,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
        includes: ["*.ts"],
      };
      const result = await (service as any).executeDeletionOnly(context);
      expect(result.success).toBe(true);
    });
  });

  describe("ReviewService.getContextFromEnv - CI validation", () => {
    it("should call validateConfig in CI mode", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      const options = { dryRun: false, ci: true, prNumber: 1 };
      await service.getContextFromEnv(options as any);
      expect(gitProvider.validateConfig).toHaveBeenCalled();
    });
  });

  describe("ReviewService.executeCollectOnly - CI post comment", () => {
    it("should post comment in CI mode", async () => {
      const mockResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.parseMarkdown.mockReturnValue({ result: mockResult });
      mockReviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats");
      mockReviewReportService.formatMarkdown.mockReturnValue("report");
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
      ] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.createPullReview.mockResolvedValue({} as any);
      const configReader = (service as any).configReader;
      configReader.getPluginConfig.mockReturnValue({});
      const context = { owner: "o", repo: "r", prNumber: 1, ci: true, dryRun: false, verbose: 1 };
      const result = await (service as any).executeCollectOnly(context);
      expect(result.issues).toHaveLength(1);
      expect(gitProvider.createPullReview).toHaveBeenCalled();
    });
  });

  describe("ReviewService.getFileContents", () => {
    it("should get file contents with PR mode", async () => {
      gitProvider.getFileContent.mockResolvedValue("line1\nline2\nline3" as any);
      const changedFiles = [
        {
          filename: "test.ts",
          status: "modified",
          patch: "@@ -1,2 +1,3 @@\n line1\n+line2\n line3",
        },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const result = await (service as any).getFileContents(
        "o",
        "r",
        changedFiles,
        commits,
        "abc",
        1,
      );
      expect(result.has("test.ts")).toBe(true);
      expect(result.get("test.ts")).toHaveLength(3);
    });

    it("should get file contents with git sdk mode (no PR)", async () => {
      mockGitSdkService.getFileContent.mockResolvedValue("line1\nline2");
      const changedFiles = [
        { filename: "test.ts", status: "modified", patch: "@@ -1,1 +1,2 @@\n line1\n+line2" },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const result = await (service as any).getFileContents(
        "o",
        "r",
        changedFiles,
        commits,
        "HEAD",
      );
      expect(result.has("test.ts")).toBe(true);
    });

    it("should skip deleted files", async () => {
      const changedFiles = [{ filename: "deleted.ts", status: "deleted" }];
      const result = await (service as any).getFileContents("o", "r", changedFiles, [], "HEAD", 1);
      expect(result.size).toBe(0);
    });

    it("should handle file content fetch error", async () => {
      gitProvider.getFileContent.mockRejectedValue(new Error("not found") as any);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const changedFiles = [{ filename: "missing.ts", status: "modified" }];
      const result = await (service as any).getFileContents("o", "r", changedFiles, [], "HEAD", 1);
      expect(result.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should get file contents with verbose=3 logging", async () => {
      gitProvider.getFileContent.mockResolvedValue("line1\nline2" as any);
      const changedFiles = [
        { filename: "test.ts", status: "modified", patch: "@@ -1,1 +1,2 @@\n line1\n+line2" },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const result = await (service as any).getFileContents(
        "o",
        "r",
        changedFiles,
        commits,
        "abc",
        1,
        3,
      );
      expect(result.has("test.ts")).toBe(true);
    });

    it("should mark all lines as changed for new files without patch", async () => {
      gitProvider.getFileContent.mockResolvedValue("line1\nline2" as any);
      const changedFiles = [{ filename: "new.ts", status: "added", additions: 2, deletions: 0 }];
      const commits = [{ sha: "abc1234567890" }];
      const result = await (service as any).getFileContents(
        "o",
        "r",
        changedFiles,
        commits,
        "abc",
        1,
      );
      expect(result.has("new.ts")).toBe(true);
      const lines = result.get("new.ts");
      expect(lines[0][0]).toBe("abc1234");
      expect(lines[1][0]).toBe("abc1234");
    });
  });

  describe("ReviewService.getChangedFilesBetweenRefs", () => {
    it("should merge diff and status info", async () => {
      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue([
        { filename: "a.ts", patch: "diff content" },
      ]);
      mockGitSdkService.getChangedFilesBetweenRefs.mockResolvedValue([
        { filename: "a.ts", status: "added" },
      ]);
      const result = await (service as any).getChangedFilesBetweenRefs("o", "r", "main", "feature");
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("added");
      expect(result[0].patch).toBe("diff content");
    });
  });

  describe("ReviewService.buildFallbackDescription", () => {
    it("should build description from commits and files", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: test" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const commits = [{ sha: "abc", commit: { message: "feat: add feature" } }];
      const changedFiles = [
        { filename: "a.ts", status: "added" },
        { filename: "b.ts", status: "modified" },
        { filename: "c.ts", status: "deleted" },
      ];
      const result = await (service as any).buildFallbackDescription(commits, changedFiles);
      expect(result.description).toContain("提交记录");
      expect(result.description).toContain("文件变更");
      expect(result.description).toContain("新增 1");
      expect(result.description).toContain("修改 1");
      expect(result.description).toContain("删除 1");
    });

    it("should handle empty commits", async () => {
      const llmProxy = (service as any).llmProxyService;
      const mockStream = (async function* () {
        yield { type: "text", content: "Feat: empty" };
      })();
      llmProxy.chatStream.mockReturnValue(mockStream);
      const result = await (service as any).buildFallbackDescription([], []);
      expect(result.title).toBeDefined();
    });
  });

  describe("ReviewService.normalizeIssues - comma separated", () => {
    it("should split comma separated lines into multiple issues", () => {
      const issues = [
        { file: "test.ts", line: "10, 20", ruleId: "R1", reason: "bad", suggestion: "fix it" },
      ];
      const result = (service as any).normalizeIssues(issues);
      expect(result).toHaveLength(2);
      expect(result[0].line).toBe("10");
      expect(result[0].suggestion).toBe("fix it");
      expect(result[1].line).toBe("20");
      expect(result[1].suggestion).toContain("参考");
    });
  });

  describe("ReviewService.formatReviewComment - terminal format", () => {
    it("should use terminal format when not CI", () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.format.mockReturnValue("terminal output");
      const result = (service as any).formatReviewComment(
        { issues: [], summary: [] },
        { ci: false },
      );
      expect(result).toBe("terminal output");
    });

    it("should use specified outputFormat", () => {
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.format.mockReturnValue("terminal output");
      const result = (service as any).formatReviewComment(
        { issues: [], summary: [] },
        { outputFormat: "terminal" },
      );
      expect(result).toBe("terminal output");
    });
  });

  describe("ReviewService.getFilesForCommit - no PR", () => {
    it("should use git sdk when no prNumber", async () => {
      mockGitSdkService.getFilesForCommit.mockResolvedValue(["a.ts", "b.ts"]);
      const result = await (service as any).getFilesForCommit("o", "r", "abc123");
      expect(result).toEqual(["a.ts", "b.ts"]);
    });

    it("should use git provider when prNumber provided", async () => {
      gitProvider.getCommit.mockResolvedValue({ files: [{ filename: "a.ts" }] } as any);
      const result = await (service as any).getFilesForCommit("o", "r", "abc123", 1);
      expect(result).toEqual(["a.ts"]);
    });

    it("should handle null files from getCommit", async () => {
      gitProvider.getCommit.mockResolvedValue({ files: null } as any);
      const result = await (service as any).getFilesForCommit("o", "r", "abc123", 1);
      expect(result).toEqual([]);
    });
  });

  describe("ReviewService.buildLineCommitMap", () => {
    it("should build line commit map from commits", async () => {
      gitProvider.getCommitDiff = vi
        .fn()
        .mockResolvedValue(
          "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,2 +1,3 @@\n line1\n+new line\n line2",
        ) as any;
      const commits = [{ sha: "abc1234567890" }];
      const result = await (service as any).buildLineCommitMap("o", "r", commits);
      expect(result.has("file.ts")).toBe(true);
      expect(result.get("file.ts").get(2)).toBe("abc1234");
    });

    it("should skip commits without sha", async () => {
      const commits = [{ sha: undefined }];
      const result = await (service as any).buildLineCommitMap("o", "r", commits);
      expect(result.size).toBe(0);
    });

    it("should fallback to git sdk on API error", async () => {
      gitProvider.getCommitDiff = vi.fn().mockRejectedValue(new Error("fail")) as any;
      mockGitSdkService.getCommitDiff = vi.fn().mockReturnValue([]);
      const commits = [{ sha: "abc1234567890" }];
      const result = await (service as any).buildLineCommitMap("o", "r", commits);
      expect(mockGitSdkService.getCommitDiff).toHaveBeenCalledWith("abc1234567890");
      expect(result.size).toBe(0);
    });
  });
});
