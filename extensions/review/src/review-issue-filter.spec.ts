import { vi } from "vitest";
import { ReviewIssueFilter } from "./review-issue-filter";
import { ReviewSourceResolver } from "./review-source-resolver";
import type { ReviewIssue, FileContentsMap } from "./review-spec/types";

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

describe("ReviewIssueFilter", () => {
  let filter: ReviewIssueFilter;
  let resolver: ReviewSourceResolver;
  let gitProvider: any;
  let configService: any;
  let mockReviewSpecService: any;
  let mockIssueVerifyService: any;
  let mockGitSdkService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    gitProvider = {
      getFileContent: vi.fn(),
      getCommit: vi.fn(),
      getCommitDiff: vi.fn(),
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
      parseLineRange: vi.fn().mockImplementation((lineStr: string) => {
        const lines: number[] = [];
        const rangeMatch = lineStr.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) lines.push(i);
        } else {
          const line = parseInt(lineStr, 10);
          if (!isNaN(line)) lines.push(line);
        }
        return lines;
      }),
    };

    mockIssueVerifyService = {
      verifyIssueFixes: vi.fn().mockImplementation((issues) => Promise.resolve(issues)),
    };

    mockGitSdkService = {
      parseChangedLinesFromPatch: vi.fn().mockReturnValue(new Set()),
      parseDiffText: vi.fn().mockReturnValue([]),
      getChangedFilesBetweenRefs: vi.fn().mockResolvedValue([]),
      getCommitsBetweenRefs: vi.fn().mockResolvedValue([]),
      getDiffBetweenRefs: vi.fn().mockResolvedValue([]),
      getFileContent: vi.fn().mockResolvedValue(""),
      getFilesForCommit: vi.fn().mockResolvedValue([]),
      getWorkingFileContent: vi.fn().mockReturnValue(""),
      getCommitDiff: vi.fn().mockReturnValue([]),
    };

    filter = new ReviewIssueFilter(
      gitProvider as any,
      configService as any,
      mockReviewSpecService as any,
      mockIssueVerifyService as any,
      mockGitSdkService as any,
    );
    resolver = new ReviewSourceResolver(gitProvider as any, mockGitSdkService as any, filter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getFileContents", () => {
    it("should get file contents with additions mapped to commit hash", async () => {
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

      const result = await resolver.getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      expect(result.size).toBe(1);
      const fileContent = result.get("test.ts");
      expect(fileContent).toHaveLength(5);
      expect(fileContent![0][0]).toBe("-------");
      expect(fileContent![1][0]).toBe("abc1234");
      expect(fileContent![2][0]).toBe("abc1234");
      expect(fileContent![3][0]).toBe("-------");
      expect(fileContent![4][0]).toBe("-------");
    });

    it("should assign ------- to all lines when no patch is available", async () => {
      const changedFiles = [
        {
          filename: "test.ts",
          status: "modified",
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      gitProvider.getFileContent.mockResolvedValue("line1\nline2\nline3");

      const result = await resolver.getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      const fileContent = result.get("test.ts");
      expect(fileContent).toBeDefined();
      expect(fileContent!.every(([hash]) => hash === "-------")).toBe(true);
    });

    it("should mark all lines as changed for new files without patch", async () => {
      const changedFiles = [
        {
          filename: "new-file.ts",
          status: "added",
          additions: 3,
          deletions: 0,
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      gitProvider.getFileContent.mockResolvedValue("line1\nline2\nline3");

      const result = await resolver.getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      const fileContent = result.get("new-file.ts");
      expect(fileContent).toBeDefined();
      expect(fileContent!.every(([hash]) => hash === "abc1234")).toBe(true);
    });

    it("should skip deleted files", async () => {
      const changedFiles = [
        {
          filename: "deleted.ts",
          status: "deleted",
        },
      ];
      const commits = [{ sha: "abc1234567890" }];

      const result = await resolver.getFileContents(
        "owner",
        "repo",
        changedFiles,
        commits,
        "abc1234",
        123,
      );

      expect(result.size).toBe(0);
    });

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
      const result = await resolver.getFileContents("o", "r", changedFiles, commits, "abc", 1);
      expect(result.has("test.ts")).toBe(true);
      expect(result.get("test.ts")).toHaveLength(3);
    });

    it("should get file contents with git sdk mode (no PR)", async () => {
      mockGitSdkService.getFileContent.mockResolvedValue("line1\nline2");
      const changedFiles = [
        { filename: "test.ts", status: "modified", patch: "@@ -1,1 +1,2 @@\n line1\n+line2" },
      ];
      const commits = [{ sha: "abc1234567890" }];
      const result = await resolver.getFileContents("o", "r", changedFiles, commits, "HEAD");
      expect(result.has("test.ts")).toBe(true);
    });

    it("should handle file content fetch error", async () => {
      gitProvider.getFileContent.mockRejectedValue(new Error("not found") as any);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const changedFiles = [{ filename: "missing.ts", status: "modified" }];
      const result = await resolver.getFileContents("o", "r", changedFiles, [], "HEAD", 1);
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
      const result = await resolver.getFileContents(
        "o",
        "r",
        changedFiles,
        commits,
        "abc",
        1,
        false,
        3,
      );
      expect(result.has("test.ts")).toBe(true);
    });

    it("should mark all lines as changed for new files without patch (additions only)", async () => {
      gitProvider.getFileContent.mockResolvedValue("line1\nline2" as any);
      const changedFiles = [{ filename: "new.ts", status: "added", additions: 2, deletions: 0 }];
      const commits = [{ sha: "abc1234567890" }];
      const result = await resolver.getFileContents("o", "r", changedFiles, commits, "abc", 1);
      expect(result.has("new.ts")).toBe(true);
      const lines = result.get("new.ts");
      expect(lines![0][0]).toBe("abc1234");
      expect(lines![1][0]).toBe("abc1234");
    });
  });

  describe("getChangedFilesBetweenRefs", () => {
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

      const result = await filter.getChangedFilesBetweenRefs("owner", "repo", "main", "feature");

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("test.ts");
      expect(result[0].status).toBe("modified");
      expect(result[0].patch).toBe("@@ -1,3 +1,5 @@\n line1\n+new line");
    });

    it("should handle files in diff but not in status", async () => {
      const diffFiles = [
        {
          filename: "new.ts",
          patch: "@@ -0,0 +1,3 @@\n+line1",
        },
      ];
      const statusFiles: any[] = [];

      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue(diffFiles);
      mockGitSdkService.getChangedFilesBetweenRefs.mockResolvedValue(statusFiles);

      const result = await filter.getChangedFilesBetweenRefs("owner", "repo", "main", "feature");

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("new.ts");
      expect(result[0].status).toBe("modified");
    });

    it("should merge diff and status info", async () => {
      mockGitSdkService.getDiffBetweenRefs.mockResolvedValue([
        { filename: "a.ts", patch: "diff content" },
      ]);
      mockGitSdkService.getChangedFilesBetweenRefs.mockResolvedValue([
        { filename: "a.ts", status: "added" },
      ]);
      const result = await filter.getChangedFilesBetweenRefs("o", "r", "main", "feature");
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("added");
      expect(result[0].patch).toBe("diff content");
    });
  });

  describe("filterIssuesByValidCommits", () => {
    it("should keep issues on changed lines", () => {
      const issues = [
        mockIssue({
          file: "test.ts",
          line: "1",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "issue on unchanged",
        }),
        mockIssue({
          file: "test.ts",
          line: "2",
          ruleId: "R2",
          specFile: "s1.md",
          reason: "issue on changed",
        }),
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents: FileContentsMap = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "new line"],
            ["-------", "line2"],
          ],
        ],
      ]);

      const result = filter.filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(1);
      expect(result[0].line).toBe("2");
    });

    it("should keep issues when file not in fileContents", () => {
      const issues = [
        mockIssue({ file: "unknown.ts", ruleId: "R1", specFile: "s1.md", reason: "issue" }),
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents: FileContentsMap = new Map();

      const result = filter.filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(1);
    });

    it("should keep issues with range if any line is changed", () => {
      const issues = [
        mockIssue({
          file: "test.ts",
          line: "1-3",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "range issue",
        }),
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents: FileContentsMap = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "new line"],
            ["-------", "line3"],
          ],
        ],
      ]);

      const result = filter.filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(1);
    });

    it("should filter issue when all lines match non-commit hash", () => {
      const issues = [
        mockIssue({
          file: "test.ts",
          line: "1-3",
          ruleId: "R1",
          specFile: "s1.md",
          reason: "range issue",
        }),
      ];
      const commits = [{ sha: "abc1234567890" }];
      const fileContents: FileContentsMap = new Map([
        [
          "test.ts",
          [
            ["def5678", "line1"],
            ["def5678", "line2"],
            ["def5678", "line3"],
          ],
        ],
      ]);

      const result = filter.filterIssuesByValidCommits(issues, commits, fileContents);

      expect(result).toHaveLength(0);
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
        mockIssue({ file: "test.ts", line: "2", ruleId: "R1" }),
        mockIssue({ file: "test.ts", line: "1", ruleId: "R2" }),
        mockIssue({ file: "test.ts", line: "3", ruleId: "R3" }),
      ];
      const result = filter.filterIssuesByValidCommits(
        issues,
        commits,
        fileContents as FileContentsMap,
        2,
      );
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
        mockIssue({ file: "test.ts", line: "1", ruleId: "R1" }),
        mockIssue({ file: "test.ts", line: "2", ruleId: "R2" }),
      ];
      filter.filterIssuesByValidCommits(issues, commits, fileContents as FileContentsMap, 1);
      expect(consoleSpy).toHaveBeenCalledWith("   过滤非本次 PR commits 问题后: 2 -> 1 个问题");
      consoleSpy.mockRestore();
    });

    it("should keep issues when file not in fileContents (simple)", () => {
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map();
      const issues = [mockIssue({ file: "missing.ts", ruleId: "R1" })];
      const result = filter.filterIssuesByValidCommits(issues, commits, fileContents);
      expect(result).toEqual(issues);
    });

    it("should keep issues when line range cannot be parsed", () => {
      const commits = [{ sha: "abc1234567890" }];
      const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "line1"]]]]);
      const issues = [mockIssue({ file: "test.ts", line: "abc", ruleId: "R1" })];
      const result = filter.filterIssuesByValidCommits(issues, commits, fileContents);
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
      const issues = [mockIssue({ file: "test.ts", line: "1-3", ruleId: "R1" })];
      const result = filter.filterIssuesByValidCommits(
        issues,
        commits,
        fileContents as FileContentsMap,
      );
      expect(result).toHaveLength(1);
    });

    it("should log when file not in fileContents at verbose level 3", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const commits = [{ sha: "abc1234567890" }];
      const fileContents = new Map();
      const issues = [mockIssue({ file: "missing.ts", ruleId: "R1" })];
      filter.filterIssuesByValidCommits(issues, commits, fileContents, 3);
      expect(consoleSpy).toHaveBeenCalledWith(
        "   ✅ Issue missing.ts:1 - 文件不在 fileContents 中，保留",
      );
      consoleSpy.mockRestore();
    });

    it("should log when line range cannot be parsed at verbose level 3", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const commits = [{ sha: "abc1234567890" }];
      const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "line1"]]]]);
      const issues = [mockIssue({ file: "test.ts", line: "abc", ruleId: "R1" })];
      filter.filterIssuesByValidCommits(issues, commits, fileContents, 3);
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
      const issues = [mockIssue({ file: "test.ts", line: "2", ruleId: "R1" })];
      filter.filterIssuesByValidCommits(issues, commits, fileContents as FileContentsMap, 3);
      expect(consoleSpy).toHaveBeenCalledWith("   🔍 有效 commit hashes: abc1234");
      expect(consoleSpy).toHaveBeenCalledWith(
        "   ✅ Issue test.ts:2 - 行 2 hash=abc1234 匹配，保留",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("filterDuplicateIssues", () => {
    it("should filter issues that exist in valid existing issues", () => {
      const newIssues = [
        mockIssue({ file: "a.ts", line: "1", ruleId: "R1" }),
        mockIssue({ file: "b.ts", line: "2", ruleId: "R2" }),
      ];
      const existingIssues = [mockIssue({ file: "a.ts", line: "1", ruleId: "R1", valid: "true" })];
      const result = filter.filterDuplicateIssues(newIssues, existingIssues);
      expect(result.filteredIssues).toHaveLength(1);
      expect(result.filteredIssues[0].file).toBe("b.ts");
      expect(result.skippedCount).toBe(1);
    });

    it("should also filter invalid existing issues to prevent repeated reporting", () => {
      const newIssues = [mockIssue({ file: "a.ts", line: "1", ruleId: "R1" })];
      const existingIssues = [mockIssue({ file: "a.ts", line: "1", ruleId: "R1", valid: "false" })];
      const result = filter.filterDuplicateIssues(newIssues, existingIssues);
      expect(result.filteredIssues).toHaveLength(0);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("fillIssueCode", () => {
    it("should fill code from fileContents", async () => {
      const issues = [mockIssue({ file: "test.ts", line: "2" })];
      const fileContents: FileContentsMap = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "line2"],
            ["-------", "line3"],
          ],
        ],
      ]);
      const result = await filter.fillIssueCode(issues, fileContents);
      expect(result[0].code).toBe("line2");
    });

    it("should handle range lines", async () => {
      const issues = [mockIssue({ file: "test.ts", line: "1-2" })];
      const fileContents: FileContentsMap = new Map([
        [
          "test.ts",
          [
            ["-------", "line1"],
            ["abc1234", "line2"],
            ["-------", "line3"],
          ],
        ],
      ]);
      const result = await filter.fillIssueCode(issues, fileContents);
      expect(result[0].code).toBe("line1\nline2");
    });

    it("should return issue unchanged if file not found", async () => {
      const issues = [mockIssue({ file: "missing.ts" })];
      const result = await filter.fillIssueCode(issues, new Map());
      expect(result[0].code).toBe("");
    });

    it("should return issue unchanged if line out of range", async () => {
      const issues = [mockIssue({ file: "test.ts", line: "999" })];
      const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "line1"]]]]);
      const result = await filter.fillIssueCode(issues, fileContents);
      expect(result[0].code).toBe("");
    });

    it("should return issue unchanged if line is NaN", async () => {
      const issues = [mockIssue({ file: "test.ts", line: "abc" })];
      const fileContents: FileContentsMap = new Map([["test.ts", [["-------", "line1"]]]]);
      const result = await filter.fillIssueCode(issues, fileContents);
      expect(result[0].code).toBe("");
    });
  });

  describe("getCommitsBetweenRefs", () => {
    it("should return commits from git sdk", async () => {
      mockGitSdkService.getCommitsBetweenRefs.mockResolvedValue([
        { sha: "abc", commit: { message: "fix" } },
      ]);
      const result = await filter.getCommitsBetweenRefs("main", "feature");
      expect(result).toHaveLength(1);
    });
  });

  describe("getFilesForCommit", () => {
    it("should return files from git sdk", async () => {
      mockGitSdkService.getFilesForCommit.mockResolvedValue([
        { filename: "a.ts", status: "modified" },
      ]);
      const result = await filter.getFilesForCommit("o", "r", "abc123");
      expect(result).toHaveLength(1);
    });

    it("should use git sdk when no prNumber", async () => {
      mockGitSdkService.getFilesForCommit.mockResolvedValue(["a.ts", "b.ts"]);
      const result = await filter.getFilesForCommit("o", "r", "abc123");
      expect(result).toEqual(["a.ts", "b.ts"]);
    });

    it("should use git provider when prNumber provided", async () => {
      gitProvider.getCommit.mockResolvedValue({ files: [{ filename: "a.ts" }] } as any);
      const result = await filter.getFilesForCommit("o", "r", "abc123", 1);
      expect(result).toEqual(["a.ts"]);
    });

    it("should handle null files from getCommit", async () => {
      gitProvider.getCommit.mockResolvedValue({ files: null } as any);
      const result = await filter.getFilesForCommit("o", "r", "abc123", 1);
      expect(result).toEqual([]);
    });
  });
});
