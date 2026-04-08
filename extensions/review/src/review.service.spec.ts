import { vi, type Mock } from "vitest";
import { parseChangedLinesFromPatch } from "@spaceflow/core";
import { readFile } from "fs/promises";
import { ReviewService, ReviewContext, ReviewPrompt } from "./review.service";
import type { ReviewOptions } from "./review.config";
import { PullRequestModel } from "./pull-request-model";
import { ReviewResultModel } from "./review-result-model";

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
  let gitProvider: any;
  let configService: any;
  let mockReviewSpecService: any;
  let mockDeletionImpactService: any;
  let mockGitSdkService: any;
  let mockLlmProxyService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    gitProvider = {
      validateConfig: vi.fn(),
      getPullRequest: vi.fn(),
      getCommit: vi.fn(),
      getPullRequestCommits: vi.fn(),
      getPullRequestFiles: vi.fn(),
      getFileContent: vi.fn(),
      listPullReviews: vi.fn().mockResolvedValue([]),
      createPullReview: vi.fn().mockResolvedValue({}),
      deletePullReview: vi.fn().mockResolvedValue(undefined),
      deletePullReviewComment: vi.fn().mockResolvedValue(undefined),
      listResolvedThreads: vi.fn().mockResolvedValue([]),
      editPullRequest: vi.fn(),
      getCommitDiff: vi.fn(),
      listPullReviewComments: vi.fn(),
      searchUsers: vi.fn().mockResolvedValue([]),
      getIssueCommentReactions: vi.fn().mockResolvedValue([]),
      getPullReviewCommentReactions: vi.fn().mockResolvedValue([]),
      listIssueComments: vi.fn().mockResolvedValue([]),
      createIssueComment: vi.fn().mockResolvedValue({}),
      updateIssueComment: vi.fn().mockResolvedValue({}),
      deleteIssueComment: vi.fn().mockResolvedValue(undefined),
      updatePullReview: vi.fn().mockResolvedValue({}),
      getTeamMembers: vi.fn().mockResolvedValue([]),
    };

    configService = {
      get: vi.fn(),
      getPluginConfig: vi.fn().mockReturnValue({}),
      registerSchema: vi.fn(),
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
      getUncommittedFiles: vi.fn().mockReturnValue([]),
      getStagedFiles: vi.fn().mockReturnValue([]),
      getUncommittedDiff: vi.fn().mockReturnValue([]),
      getStagedDiff: vi.fn().mockReturnValue([]),
      getChangedFilesBetweenRefs: vi.fn().mockResolvedValue([]),
      getCommitsBetweenRefs: vi.fn().mockResolvedValue([]),
      getDiffBetweenRefs: vi.fn().mockResolvedValue([]),
      getFileContent: vi.fn().mockResolvedValue(""),
      getFilesForCommit: vi.fn().mockResolvedValue([]),
      getCurrentBranch: vi.fn().mockReturnValue("main"),
      getDefaultBranch: vi.fn().mockReturnValue("main"),
      getCommitDiff: vi.fn().mockReturnValue([]),
    };

    mockLlmProxyService = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      createSession: vi.fn(),
      getAvailableAdapters: vi.fn().mockReturnValue(["claude-code", "openai"]),
    };

    service = new ReviewService(
      gitProvider as any,
      configService as any,
      mockReviewSpecService as any,
      mockLlmProxyService as any,
      mockReviewReportService as any,
      mockIssueVerifyService as any,
      mockDeletionImpactService as any,
      mockGitSdkService as any,
    );
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
      vi.spyOn(service as any, "getFileContents").mockResolvedValue(new Map());
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(null as any);
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
      gitProvider.listIssueComments.mockResolvedValue([]);
      gitProvider.listPullReviews.mockResolvedValue([]);
      gitProvider.createIssueComment.mockResolvedValue({});

      await service.execute(context);

      expect(gitProvider.createIssueComment).toHaveBeenCalledWith(
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

    it("should ignore whenModifiedCode in direct file mode", async () => {
      const context: ReviewContext = {
        owner: "owner",
        repo: "repo",
        files: ["src/app.ts"],
        specSources: ["/spec/dir"],
        dryRun: true,
        ci: false,
        llmMode: "openai",
        whenModifiedCode: ["function", "class"],
      };
      const buildReviewPromptSpy = vi.spyOn(service as any, "buildReviewPrompt");

      const result = await service.execute(context);

      expect(result.success).toBe(true);
      expect(buildReviewPromptSpy).toHaveBeenCalled();
      expect(buildReviewPromptSpy.mock.calls[0][5]).toBeUndefined();
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
      gitProvider.listIssueComments.mockResolvedValue([]);
      gitProvider.listPullReviews.mockResolvedValue([]);
      gitProvider.createIssueComment.mockResolvedValue({});

      const result = await service.execute(context);

      expect(result.success).toBe(true);
      expect(mockDeletionImpactService.analyzeDeletionImpact).toHaveBeenCalled();
      expect(gitProvider.createIssueComment).toHaveBeenCalled();
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

    it("should return undefined if GITHUB_EVENT_PATH and GITEA_EVENT_PATH are not set", async () => {
      delete process.env.GITHUB_EVENT_PATH;
      delete process.env.GITEA_EVENT_PATH;
      const prNumber = await (service as any).getPrNumberFromEvent();
      expect(prNumber).toBeUndefined();
    });

    it("should parse prNumber from GITHUB_EVENT_PATH", async () => {
      const mockEventPath = "/tmp/event.json";
      process.env.GITHUB_EVENT_PATH = mockEventPath;
      const mockEventContent = JSON.stringify({ pull_request: { number: 456 } });

      (readFile as Mock).mockResolvedValue(mockEventContent);

      const prNumber = await (service as any).getPrNumberFromEvent();
      expect(prNumber).toBe(456);
    });

    it("should parse prNumber from GITEA_EVENT_PATH when GITHUB_EVENT_PATH is not set", async () => {
      delete process.env.GITHUB_EVENT_PATH;
      const mockEventPath = "/tmp/gitea-event.json";
      process.env.GITEA_EVENT_PATH = mockEventPath;
      const mockEventContent = JSON.stringify({ pull_request: { number: 789 } });

      (readFile as Mock).mockResolvedValue(mockEventContent);

      const prNumber = await (service as any).getPrNumberFromEvent();
      expect(prNumber).toBe(789);
    });
  });

  describe("ReviewService.runLLMReview", () => {
    it("should call callLLM when llmMode is claude", async () => {
      const callLLMSpy = vi
        .spyOn((service as any).llmProcessor, "callLLM")
        .mockResolvedValue({ issues: [], summary: [] });

      const mockPrompt: ReviewPrompt = {
        filePrompts: [{ filename: "test.ts", systemPrompt: "system", userPrompt: "user" }],
      };

      await (service as any).runLLMReview("claude-code", mockPrompt);

      expect(callLLMSpy).toHaveBeenCalledWith("claude-code", mockPrompt, {});
    });

    it("should call callLLM when llmMode is openai", async () => {
      const callLLMSpy = vi
        .spyOn((service as any).llmProcessor, "callLLM")
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
      const normalized = (service as any).llmProcessor.normalizeIssues(issues);
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

    it("should also filter invalid existing issues to prevent repeated reporting", () => {
      const newIssues = [{ file: "a.ts", line: "1", ruleId: "R1" }];
      const existingIssues = [{ file: "a.ts", line: "1", ruleId: "R1", valid: "false" }];
      const result = (service as any).filterDuplicateIssues(newIssues, existingIssues);
      expect(result.filteredIssues).toHaveLength(0);
      expect(result.skippedCount).toBe(1);
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

  describe("ReviewService.fillIssueCode", () => {
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

    it("should mark invalid when existing author but ------- commit hash", async () => {
      const issues = [
        { file: "test.ts", line: "1", commit: "-------", author: { id: "1", login: "dev1" } },
      ];
      const result = await (service as any).fillIssueAuthors(issues, [], "o", "r");
      expect(result[0].commit).toBeUndefined();
      expect(result[0].valid).toBe("false");
    });

    it("should handle issues with ------- commit hash", async () => {
      const issues = [{ file: "test.ts", line: "1", commit: "-------" }];
      const commits = [
        { sha: "abc1234567890", author: { id: 1, login: "dev1" }, commit: { author: {} } },
      ];
      const result = await (service as any).fillIssueAuthors(issues, commits, "o", "r");
      expect(result[0].commit).toBeUndefined();
      expect(result[0].valid).toBe("false");
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
      mockReviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats");
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({} as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          mockResult as any,
          (service as any).resultModelDeps,
        ),
      );
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      const result = await (service as any).executeCollectOnly(context);
      expect(result.issues).toHaveLength(1);
      expect(result.stats).toBeDefined();
    });
  });

  describe("ReviewService.execute - flush mode", () => {
    it("should route to executeCollectOnly when flush is true", async () => {
      const mockResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      const mockReviewReportService = (service as any).reviewReportService;
      mockReviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats");
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({} as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          mockResult as any,
          (service as any).resultModelDeps,
        ),
      );
      const context = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: false,
        dryRun: false,
        flush: true,
        specSources: [],
      };
      const result = await service.execute(context as any);
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
      gitProvider.listIssueComments.mockResolvedValue([] as any);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.createIssueComment.mockResolvedValue({} as any);
      const configReader = (service as any).config;
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
      gitProvider.listIssueComments.mockResolvedValue([] as any);
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.createIssueComment.mockResolvedValue({} as any);
      const configReader = (service as any).config;
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
      expect(gitProvider.createIssueComment).toHaveBeenCalled();
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
      vi.spyOn((service as any).contextBuilder, "getPrNumberFromEvent").mockResolvedValue(42);
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
      const absPath = `${process.cwd()}/src/file.ts`;
      const options = {
        dryRun: false,
        ci: false,
        files: [absPath, "./relative.ts"],
      };
      const context = await service.getContextFromEnv(options as any);
      expect(context.files).toBeDefined();
      expect(context.files).toEqual(["src/file.ts", "relative.ts"]);
    });

    it("should force direct file mode when files are specified", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      const options = {
        dryRun: false,
        ci: false,
        local: "uncommitted" as const,
        files: ["./miniprogram/utils/asyncSharedUtilsLoader.js"],
      };
      const context = await service.getContextFromEnv(options as any);
      expect(context.localMode).toBe(false);
      expect(context.files).toEqual(["miniprogram/utils/asyncSharedUtilsLoader.js"]);
    });

    it("should auto-detect base/head with verbose logging", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      mockGitSdkService.getCurrentBranch.mockReturnValue("feature");
      mockGitSdkService.getDefaultBranch.mockReturnValue("main");
      const options = { dryRun: false, ci: false, verbose: 1, local: false };
      const context = await service.getContextFromEnv(options as any);
      expect(context.headRef).toBe("feature");
      expect(context.baseRef).toBe("main");
    });

    it("should auto-detect base/head when no PR and no refs", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      mockGitSdkService.getCurrentBranch.mockReturnValue("feature");
      mockGitSdkService.getDefaultBranch.mockReturnValue("main");
      const options = { dryRun: false, ci: false, local: false };
      const context = await service.getContextFromEnv(options as any);
      expect(context.headRef).toBe("feature");
      expect(context.baseRef).toBe("main");
    });

    it("should merge references from options and config", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      const configReader = (service as any).config;
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

  describe("ReviewService.getCommitsBetweenRefs", () => {
    it("should return commits from git sdk", async () => {
      mockGitSdkService.getCommitsBetweenRefs.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ]);
      const result = await (service as any).getCommitsBetweenRefs("main", "feature");
      expect(result).toHaveLength(1);
    });
  });

  describe("ReviewService.resolveSourceData - direct file mode", () => {
    it("should bypass local uncommitted scanning when files are specified", async () => {
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        dryRun: true,
        ci: false,
        specSources: ["/spec"],
        files: ["miniprogram/utils/asyncSharedUtilsLoader.js"],
        localMode: false,
      };

      const result = await (service as any).resolveSourceData(context);

      expect(result.isDirectFileMode).toBe(true);
      expect(result.isLocalMode).toBe(true);
      expect(result.changedFiles).toEqual([
        { filename: "miniprogram/utils/asyncSharedUtilsLoader.js", status: "modified" },
      ]);
      expect(mockGitSdkService.getUncommittedFiles).not.toHaveBeenCalled();
      expect(mockGitSdkService.getStagedFiles).not.toHaveBeenCalled();
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

  describe("ReviewService.execute - CI with existingResult", () => {
    beforeEach(() => {
      vi.spyOn(service as any, "runLLMReview").mockResolvedValue({
        success: true,
        issues: [{ file: "test.ts", line: "5", ruleId: "R1", reason: "new issue" }],
        summary: [{ file: "test.ts", summary: "ok" }],
      });
      vi.spyOn(service as any, "getFileContents").mockResolvedValue(new Map());
    });

    it("should merge existing issues with new issues in CI mode", async () => {
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          {
            success: true,
            description: "",
            issues: [
              { file: "old.ts", line: "1", ruleId: "R2", reason: "old issue", valid: "true" },
            ],
            summary: [],
            round: 1,
          } as any,
          (service as any).resultModelDeps,
        ),
      );
      const configReader = (service as any).config;
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
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          {
            success: true,
            description: "",
            issues: [{ file: "old.ts", line: "1", ruleId: "R2", reason: "old", valid: "true" }],
            summary: [],
            round: 1,
          } as any,
          (service as any).resultModelDeps,
        ),
      );
      const configReader = (service as any).config;
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
      vi.spyOn(service as any, "getFileContents").mockResolvedValue(new Map());
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(null as any);
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
      gitProvider.listIssueComments.mockResolvedValue([
        { id: 10, body: "<!-- spaceflow-review --> content" },
      ] as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          mockResult as any,
          (service as any).resultModelDeps,
        ),
      );
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.updateIssueComment.mockResolvedValue({} as any);
      const configReader = (service as any).config;
      configReader.getPluginConfig.mockReturnValue({});
      const context = { owner: "o", repo: "r", prNumber: 1, ci: true, dryRun: false, verbose: 1 };
      const result = await (service as any).executeCollectOnly(context);
      expect(result.issues).toHaveLength(1);
      expect(gitProvider.updateIssueComment).toHaveBeenCalled();
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

  describe("ReviewService.buildBasicDescription", () => {
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
      const result = await (service as any).buildBasicDescription(commits, changedFiles);
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
      const result = await (service as any).buildBasicDescription([], []);
      expect(result.title).toBeDefined();
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

    it("should filter issues by valid commit hashes", () => {
      const commits = [{ sha: "abc1234567890" }];
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
      const issues = [
        { file: "test.ts", line: "2", ruleId: "R1" }, // 应该保留，hash匹配
        { file: "test.ts", line: "1", ruleId: "R2" }, // 应该过滤，hash不匹配
        { file: "test.ts", line: "3", ruleId: "R3" }, // 应该过滤，hash不匹配
      ];
      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents, 2);
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("R1");
    });

    it("should log filtering summary", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "line2"],
          ],
        ],
      ]);
      const issues = [
        { file: "test.ts", line: "1", ruleId: "R1" },
        { file: "test.ts", line: "2", ruleId: "R2" },
      ];
      (service as any).filterIssuesByValidCommits(issues, commits, fileContents, 1);
      expect(consoleSpy).toHaveBeenCalledWith("   过滤非本次 PR commits 问题后: 2 -> 1 个问题");
      consoleSpy.mockRestore();
    });

    it("should keep issues when file not in fileContents", () => {
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map();
      const issues = [{ file: "missing.ts", line: "1", ruleId: "R1" }];
      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);
      expect(result).toEqual(issues);
    });

    it("should keep issues when line range cannot be parsed", () => {
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([["test.ts", [["-------", "line1"]]]]);
      const issues = [{ file: "test.ts", line: "abc", ruleId: "R1" }];
      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);
      expect(result).toEqual(issues);
    });

    it("should handle range line numbers", () => {
      const commits = [{ sha: "abc1234567890" }];
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
      const issues = [{ file: "test.ts", line: "1-3", ruleId: "R1" }];
      const result = (service as any).filterIssuesByValidCommits(issues, commits, fileContents);
      expect(result).toHaveLength(1); // 只要范围内有一行匹配就保留
    });

    it("should log when file not in fileContents at verbose level 3", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map();
      const issues = [{ file: "missing.ts", line: "1", ruleId: "R1" }];
      (service as any).filterIssuesByValidCommits(issues, commits, fileContents, 3);
      expect(consoleSpy).toHaveBeenCalledWith(
        "   ✅ Issue missing.ts:1 - 文件不在 fileContents 中，保留",
      );
      consoleSpy.mockRestore();
    });

    it("should log when line range cannot be parsed at verbose level 3", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([["test.ts", [["-------", "line1"]]]]);
      const issues = [{ file: "test.ts", line: "abc", ruleId: "R1" }];
      (service as any).filterIssuesByValidCommits(issues, commits, fileContents, 3);
      expect(consoleSpy).toHaveBeenCalledWith("   ✅ Issue test.ts:abc - 无法解析行号，保留");
      consoleSpy.mockRestore();
    });

    it("should log detailed hash matching at verbose level 3", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "line2"],
          ],
        ],
      ]);
      const issues = [{ file: "test.ts", line: "2", ruleId: "R1" }];
      (service as any).filterIssuesByValidCommits(issues, commits, fileContents, 3);
      expect(consoleSpy).toHaveBeenCalledWith("   🔍 有效 commit hashes: abc1234");
      expect(consoleSpy).toHaveBeenCalledWith(
        "   ✅ Issue test.ts:2 - 行 2 hash=abc1234 匹配，保留",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("ReviewService.ensureClaudeCli", () => {
    it("should do nothing when claude is already installed", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      // execSync is already mocked globally

      await (service as any).ensureClaudeCli();
      expect(consoleSpy).not.toHaveBeenCalledWith("🔧 Claude CLI 未安装，正在安装...");
      consoleSpy.mockRestore();
    });

    it("should install claude when not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      // Mock execSync to throw then succeed
      const execSyncMock = vi.mocked(await import("child_process"));
      execSyncMock.execSync
        .mockImplementationOnce(() => {
          throw new Error("command not found");
        })
        .mockImplementationOnce(() => Buffer.from(""));

      await (service as any).ensureClaudeCli();
      expect(consoleSpy).toHaveBeenCalledWith("🔧 Claude CLI 未安装，正在安装...");
      expect(consoleSpy).toHaveBeenCalledWith("✅ Claude CLI 安装完成");
      consoleSpy.mockRestore();
    });

    it("should throw error when installation fails", async () => {
      const execSyncMock = vi.mocked(await import("child_process"));
      execSyncMock.execSync
        .mockImplementationOnce(() => {
          throw new Error("command not found");
        })
        .mockImplementationOnce(() => {
          throw new Error("install failed");
        });

      await expect((service as any).ensureClaudeCli()).rejects.toThrow(
        "Claude CLI 安装失败: install failed",
      );
    });
  });
});
