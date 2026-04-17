import { vi } from "vitest";
import { parseChangedLinesFromPatch } from "@spaceflow/core";
import { ReviewService, ReviewContext } from "./review.service";
import type { ReviewOptions } from "./review.config";
import { PullRequestModel } from "./pull-request-model";
import { ReviewResultModel } from "./review-result-model";
import type { ReviewResult, ReviewIssue, FileSummary } from "./review-spec/types";
import { ChangedFileCollection } from "./changed-file-collection";

function mockResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return { success: true, description: "", issues: [], summary: [], round: 1, ...overrides };
}

function mockIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    file: "",
    line: "1",
    code: "",
    ruleId: "",
    specFile: "",
    reason: "",
    severity: "error",
    round: 1,
    ...overrides,
  };
}

function mockSummary(overrides: Partial<FileSummary> = {}): FileSummary {
  return { file: "", resolved: 0, unresolved: 0, summary: "", ...overrides };
}

vi.mock("c12");
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

class TestReviewService extends ReviewService {
  // 暴露 protected 成员用于测试
  get _contextBuilder() {
    return this.contextBuilder;
  }
  get _issueFilter() {
    return this.issueFilter;
  }
  get _llmProcessor() {
    return this.llmProcessor;
  }
  get _resultModelDeps() {
    return this.resultModelDeps;
  }
  get _config() {
    return this.config;
  }
  get _reviewReportService() {
    return this.reviewReportService;
  }
  get _llmProxyService() {
    return this.llmProxyService;
  }
  get _sourceResolver() {
    return this.sourceResolver;
  }

  executeCollectOnly(context: Partial<ReviewContext>) {
    return super.executeCollectOnly(context as ReviewContext);
  }
  executeDeletionOnly(context: Partial<ReviewContext>) {
    return super.executeDeletionOnly(context as ReviewContext);
  }
  resolveSourceData(context: Partial<ReviewContext>) {
    return super.resolveSourceData(context as ReviewContext);
  }
}

describe("ReviewService", () => {
  let service: TestReviewService;
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
      getAvailableAdapters: vi.fn().mockReturnValue(["openai", "open-code"]),
    };

    service = new TestReviewService(
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
      vi.spyOn(service._llmProcessor, "runLLMReview").mockResolvedValue(mockResult());
      vi.spyOn(service._sourceResolver, "getFileContents").mockResolvedValue(new Map());
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
        llmMode: "openai" as const,
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
        llmMode: "openai" as const,
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
        llmMode: "openai",
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
      const buildReviewPromptSpy = vi.spyOn(service._llmProcessor, "buildReviewPrompt");

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

  describe("ReviewService Logic", () => {
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

  describe("ReviewService.executeCollectOnly", () => {
    it("should return empty result when no existing review", async () => {
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      const result = await service.executeCollectOnly(context);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("should throw when no prNumber", async () => {
      const context = { owner: "o", repo: "r", ci: false, dryRun: false };
      await expect(service.executeCollectOnly(context)).rejects.toThrow(
        "collectOnly 模式必须指定 PR 编号",
      );
    });

    it("should collect and return existing review result", async () => {
      const existingResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      service._reviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats") as any;
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({} as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          existingResult as any,
          service._resultModelDeps,
        ),
      );
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      const result = await service.executeCollectOnly(context);
      expect(result.issues).toHaveLength(1);
      expect(result.stats).toBeDefined();
    });

    it("should filter merge commits before getFileContents when verifyFixes enabled", async () => {
      const existingResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      service._reviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats") as any;
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "head1234" } } as any);
      gitProvider.getPullRequestFiles.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
      ] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([
        { sha: "merge1111", commit: { message: "Merge branch 'main' into feature" } },
        { sha: "feat22222", commit: { message: "feat: add logic" } },
      ] as any);

      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          existingResult as any,
          service._resultModelDeps,
        ),
      );
      const getFileContentsSpy = vi
        .spyOn(service._sourceResolver, "getFileContents")
        .mockResolvedValue(new Map() as any);

      const context = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: false,
        dryRun: false,
        verifyFixes: true,
        specSources: ["/spec/dir"],
        showAll: false,
      };

      await service.executeCollectOnly(context);

      expect(getFileContentsSpy).toHaveBeenCalled();
      const passedCommits = getFileContentsSpy.mock.calls[0][3] as any[];
      expect(passedCommits).toHaveLength(1);
      expect(passedCommits[0].sha).toBe("feat22222");
    });
  });

  describe("ReviewService.execute - flush mode", () => {
    it("should route to executeCollectOnly when flush is true", async () => {
      const flushResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      service._reviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats") as any;
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({} as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          flushResult as any,
          service._resultModelDeps,
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

  describe("ReviewService.execute - fast mode", () => {
    it("should run static-only flow on round 1 when fast mode is enabled", async () => {
      const llmSpy = vi.spyOn(service._llmProcessor, "runLLMReview");
      const resolveSourceDataSpy = vi.spyOn(service as any, "resolveSourceData");
      const buildFinalModelSpy = vi.spyOn(service as any, "buildFinalModel");
      const saveAndOutputSpy = vi.spyOn(service as any, "saveAndOutput");

      resolveSourceDataSpy.mockResolvedValue({
        prModel: undefined,
        commits: [
          {
            sha: "c1",
            commit: {
              message: "feat: add login api",
              author: { date: "2026-04-01T08:00:00.000Z" },
            },
          },
        ],
        changedFiles: ChangedFileCollection.from([
          { filename: "src/a.ts", status: "modified", additions: 10, deletions: 2 },
        ]),
        headSha: "abc1234",
        isLocalMode: false,
        isDirectFileMode: false,
        fileContents: new Map([
          [
            "src/a.ts",
            [
              ["abc1234", "line 1"],
              ["abc1234", "line 2"],
              ["abc1234", "line 3"],
            ],
          ],
        ]),
      } as any);
      buildFinalModelSpy.mockResolvedValue(
        {
          result: mockResult({
            round: 1,
            title: "Feat add login api",
            issues: [mockIssue({ file: "src/a.ts", ruleId: "system:max-lines-per-file" })],
          }),
        } as any,
      );
      saveAndOutputSpy.mockResolvedValue(undefined);

      const result = await service.execute({
        owner: "o",
        repo: "r",
        dryRun: true,
        ci: false,
        fast: true,
        specSources: ["/spec/dir"],
        systemRules: {
          maxLinesPerFile: [2, "warn"],
        },
      } as ReviewContext);

      expect(llmSpy).not.toHaveBeenCalled();
      expect(buildFinalModelSpy).toHaveBeenCalledTimes(1);
      const fastResult = buildFinalModelSpy.mock.calls[0][1] as ReviewResult;
      expect(fastResult.title).toBe("Feat add login api");
      expect(fastResult.issues).toHaveLength(1);
      expect(fastResult.description).toContain("快速模式");
      expect(saveAndOutputSpy).toHaveBeenCalledTimes(1);
      expect(result.round).toBe(1);
    });

    it("should fallback to collect-only when fast mode enters round 2+", async () => {
      const llmSpy = vi.spyOn(service._llmProcessor, "runLLMReview");
      const resolveSourceDataSpy = vi.spyOn(service as any, "resolveSourceData");
      const collectOnlySpy = vi.spyOn(service as any, "executeCollectOnly");

      resolveSourceDataSpy.mockResolvedValue({
        prModel: new PullRequestModel(gitProvider as any, "o", "r", 1),
        commits: [],
        changedFiles: ChangedFileCollection.from([]),
        headSha: "abc1234",
        isLocalMode: false,
        isDirectFileMode: false,
        fileContents: new Map(),
      } as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue({ round: 1 } as any);
      collectOnlySpy.mockResolvedValue(mockResult({ round: 1 }));

      await service.execute({
        owner: "o",
        repo: "r",
        prNumber: 1,
        dryRun: true,
        ci: true,
        fast: true,
        verifyFixes: true,
        specSources: ["/spec/dir"],
      } as ReviewContext);

      expect(llmSpy).not.toHaveBeenCalled();
      expect(collectOnlySpy).toHaveBeenCalledTimes(1);
      const fastCollectContext = collectOnlySpy.mock.calls[0][0] as ReviewContext;
      expect(fastCollectContext.flush).toBe(true);
      expect(fastCollectContext.verifyFixes).toBe(false);
    });

    it("should enter fast mode when round condition matches and fallback to collect-only", async () => {
      const llmSpy = vi.spyOn(service._llmProcessor, "runLLMReview");
      const resolveSourceDataSpy = vi.spyOn(service as any, "resolveSourceData");
      const collectOnlySpy = vi.spyOn(service as any, "executeCollectOnly");

      resolveSourceDataSpy.mockResolvedValue({
        prModel: new PullRequestModel(gitProvider as any, "o", "r", 1),
        commits: [],
        changedFiles: ChangedFileCollection.from([]),
        headSha: "abc1234",
        isLocalMode: false,
        isDirectFileMode: false,
        fileContents: new Map(),
      } as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue({ round: 2 } as any);
      collectOnlySpy.mockResolvedValue(mockResult({ round: 2 }));

      await service.execute({
        owner: "o",
        repo: "r",
        prNumber: 1,
        dryRun: true,
        ci: true,
        verifyFixes: true,
        specSources: ["/spec/dir"],
        fastMode: {
          enabled: true,
          when: {
            rules: [{ field: "round", gt: 2 }],
          },
        },
      } as ReviewContext);

      expect(llmSpy).not.toHaveBeenCalled();
      expect(collectOnlySpy).toHaveBeenCalledTimes(1);
      const fastCollectContext = collectOnlySpy.mock.calls[0][0] as ReviewContext;
      expect(fastCollectContext.flush).toBe(true);
      expect(fastCollectContext.verifyFixes).toBe(false);
    });
  });

  describe("ReviewService.executeDeletionOnly", () => {
    it("should throw when no llmMode", async () => {
      const context = { owner: "o", repo: "r", prNumber: 1, ci: false, dryRun: false };
      await expect(service.executeDeletionOnly(context)).rejects.toThrow("必须指定 LLM 类型");
    });

    it("should execute deletion analysis with PR", async () => {
      vi.mocked(service._reviewReportService.formatMarkdown).mockReturnValue("report");
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
      vi.mocked(service._config.getPluginConfig).mockReturnValue({});
      const context: Partial<ReviewContext> = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: false,
        dryRun: false,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
        verbose: 1,
      };
      const result = await service.executeDeletionOnly(context);
      expect(result.success).toBe(true);
      expect(result.deletionImpact).toBeDefined();
    });

    it("should post comment in CI mode for deletionOnly", async () => {
      vi.mocked(service._reviewReportService.formatMarkdown).mockReturnValue("report");
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
      vi.mocked(service._config.getPluginConfig).mockReturnValue({});
      const context: Partial<ReviewContext> = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: true,
        dryRun: false,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
        verbose: 1,
      };
      const result = await service.executeDeletionOnly(context);
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
      vi.spyOn(service._contextBuilder, "getPrNumberFromEvent").mockResolvedValue(42);
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
      vi.mocked(service._config.getPluginConfig).mockReturnValue({ references: ["config-ref"] });
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

    it("should parse fast option from PR title in CI mode", async () => {
      configService.get.mockReturnValue({ repository: "owner/repo", refName: "main" });
      gitProvider.getPullRequest.mockResolvedValue({ title: "feat: test [/review --fast]" } as any);
      const options = { dryRun: false, ci: true, prNumber: 1 };
      const context = await service.getContextFromEnv(options as any);
      expect(context.fast).toBe(true);
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

      const result = await service.resolveSourceData(context);

      expect(result.isDirectFileMode).toBe(true);
      expect(result.isLocalMode).toBe(true);
      expect(result.changedFiles.toArray()).toEqual([
        { filename: "miniprogram/utils/asyncSharedUtilsLoader.js", status: "modified" },
      ]);
      expect(mockGitSdkService.getUncommittedFiles).not.toHaveBeenCalled();
      expect(mockGitSdkService.getStagedFiles).not.toHaveBeenCalled();
    });

    it("should ignore includes filtering in direct file mode", async () => {
      const context: ReviewContext = {
        owner: "o",
        repo: "r",
        dryRun: true,
        ci: false,
        specSources: ["/spec"],
        files: ["miniprogram/utils/asyncSharedUtilsLoader.js"],
        includes: ["**/*.ts", "added|**/*.js"],
        localMode: false,
      };

      const result = await service.resolveSourceData(context);

      expect(result.isDirectFileMode).toBe(true);
      expect(result.changedFiles.toArray()).toEqual([
        { filename: "miniprogram/utils/asyncSharedUtilsLoader.js", status: "modified" },
      ]);
    });
  });

  describe("ReviewService.execute - CI with existingResult", () => {
    beforeEach(() => {
      vi.spyOn(service._llmProcessor, "runLLMReview").mockResolvedValue(
        mockResult({
          issues: [mockIssue({ file: "test.ts", line: "5", ruleId: "R1", reason: "new issue" })],
          summary: [mockSummary({ file: "test.ts", summary: "ok" })],
        }),
      );
      vi.spyOn(service._sourceResolver, "getFileContents").mockResolvedValue(new Map());
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
          service._resultModelDeps,
        ),
      );
      const configReader = service._config;
      vi.mocked(configReader.getPluginConfig).mockReturnValue({});
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
        llmMode: "openai" as const,
        verifyFixes: false,
        verbose: 1,
      };
      const result = await service.execute(context);
      expect(result.success).toBe(true);
      expect(result.round).toBe(2);
    });

    it("should verify fixes when verifyFixes is true", async () => {
      vi.mocked(ReviewResultModel.loadFromPr).mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          {
            success: true,
            description: "",
            issues: [{ file: "old.ts", line: "1", ruleId: "R2", reason: "old", valid: "true" }],
            summary: [],
            round: 1,
          } as any,
          service._resultModelDeps,
        ),
      );
      const configReader = service._config;
      vi.mocked(configReader.getPluginConfig).mockReturnValue({});
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
      vi.spyOn(service._llmProcessor, "runLLMReview").mockResolvedValue(mockResult());
      vi.spyOn(service._sourceResolver, "getFileContents").mockResolvedValue(new Map());
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

  describe("ReviewService.executeDeletionOnly - baseRef/headRef mode", () => {
    it("should execute with baseRef/headRef instead of PR", async () => {
      vi.mocked(service._reviewReportService.formatMarkdown).mockReturnValue("report");
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
      const context: Partial<ReviewContext> = {
        owner: "o",
        repo: "r",
        baseRef: "main",
        headRef: "feature",
        ci: false,
        dryRun: true,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
      };
      const result = await service.executeDeletionOnly(context);
      expect(result.success).toBe(true);
    });

    it("should filter files by includes in deletionOnly", async () => {
      vi.mocked(service._reviewReportService.formatMarkdown).mockReturnValue("report");
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
      const context: Partial<ReviewContext> = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: false,
        dryRun: true,
        llmMode: "openai",
        deletionAnalysisMode: "openai",
        includes: ["*.ts"],
      };
      const result = await service.executeDeletionOnly(context);
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
      const ciResult = { issues: [{ file: "a.ts", line: "1", ruleId: "R1" }], summary: [] };
      vi.mocked(service._reviewReportService.parseMarkdown).mockReturnValue({
        result: ciResult,
      } as any);
      service._reviewReportService.formatStatsTerminal = vi.fn().mockReturnValue("stats") as any;
      vi.mocked(service._reviewReportService.formatMarkdown).mockReturnValue("report");
      gitProvider.listIssueComments.mockResolvedValue([
        { id: 10, body: "<!-- spaceflow-review --> content" },
      ] as any);
      vi.spyOn(ReviewResultModel, "loadFromPr").mockResolvedValue(
        ReviewResultModel.create(
          new PullRequestModel(gitProvider as any, "o", "r", 1),
          ciResult as any,
          service._resultModelDeps,
        ),
      );
      gitProvider.listPullReviews.mockResolvedValue([] as any);
      gitProvider.listPullReviewComments.mockResolvedValue([] as any);
      gitProvider.getPullRequestCommits.mockResolvedValue([] as any);
      gitProvider.getPullRequest.mockResolvedValue({ head: { sha: "abc" } } as any);
      gitProvider.updateIssueComment.mockResolvedValue({} as any);
      vi.mocked(service._config.getPluginConfig).mockReturnValue({});
      const context: Partial<ReviewContext> = {
        owner: "o",
        repo: "r",
        prNumber: 1,
        ci: true,
        dryRun: false,
        verbose: 1,
      };
      const result = await service.executeCollectOnly(context);
      expect(result.issues).toHaveLength(1);
      expect(gitProvider.updateIssueComment).toHaveBeenCalled();
    });
  });
});
