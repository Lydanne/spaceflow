import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewResultModel, type ReviewResultModelDeps } from "./review-result-model";
import { PullRequestModel } from "./pull-request-model";
import type { ReviewResult } from "./review-spec";

// ─── Mock 工具 ───────────────────────────────────────────

function createMockGitProvider() {
  return {
    listIssueComments: vi.fn().mockResolvedValue([]),
    createIssueComment: vi.fn().mockResolvedValue({}),
    updateIssueComment: vi.fn().mockResolvedValue({}),
    deleteIssueComment: vi.fn().mockResolvedValue(undefined),
    listPullReviews: vi.fn().mockResolvedValue([]),
    createPullReview: vi.fn().mockResolvedValue({}),
    deletePullReview: vi.fn().mockResolvedValue(undefined),
    deletePullReviewComment: vi.fn().mockResolvedValue(undefined),
    listPullReviewComments: vi.fn().mockResolvedValue([]),
    listResolvedThreads: vi.fn().mockResolvedValue([]),
    getPullRequest: vi.fn().mockResolvedValue({}),
    getCommitDiff: vi.fn().mockResolvedValue(""),
    getIssueCommentReactions: vi.fn().mockResolvedValue([]),
    getPullReviewCommentReactions: vi.fn().mockResolvedValue([]),
    getTeamMembers: vi.fn().mockResolvedValue([]),
    editPullRequest: vi.fn(),
    searchUsers: vi.fn().mockResolvedValue([]),
  } as any;
}

function createMockDeps(gitProvider: any): ReviewResultModelDeps {
  return {
    gitProvider,
    config: {
      getPluginConfig: vi.fn().mockReturnValue({}),
    } as any,
    reviewSpecService: {
      parseLineRange: vi.fn().mockImplementation((lineStr: string) => {
        const lines: number[] = [];
        const rangeMatch = lineStr.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) lines.push(i);
        } else {
          const n = parseInt(lineStr, 10);
          if (!isNaN(n)) lines.push(n);
        }
        return lines;
      }),
    } as any,
    reviewReportService: {
      formatMarkdown: vi.fn().mockReturnValue("markdown"),
      format: vi.fn().mockReturnValue("terminal"),
      parseMarkdown: vi.fn().mockReturnValue(null),
    } as any,
  };
}

function createPr(gitProvider: any, owner = "o", repo = "r", prNumber = 1) {
  return new PullRequestModel(gitProvider, owner, repo, prNumber);
}

function createResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    success: true,
    description: "",
    issues: [],
    summary: [],
    round: 1,
    ...overrides,
  };
}

// ─── 测试 ───────────────────────────────────────────────

describe("ReviewResultModel", () => {
  let gitProvider: any;
  let deps: ReviewResultModelDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    gitProvider = createMockGitProvider();
    deps = createMockDeps(gitProvider);
  });

  // ─── 工厂方法 ─────────────────────────────────────────

  describe("loadFromPr", () => {
    it("should return null when no AI comment exists", async () => {
      gitProvider.listIssueComments.mockResolvedValue([]);
      const model = await ReviewResultModel.loadFromPr(createPr(gitProvider), deps);
      expect(model).toBeNull();
    });

    it("should return null when comment has no marker", async () => {
      gitProvider.listIssueComments.mockResolvedValue([{ body: "normal comment" }]);
      const model = await ReviewResultModel.loadFromPr(createPr(gitProvider), deps);
      expect(model).toBeNull();
    });

    it("should return model when AI comment with valid result exists", async () => {
      const mockResult = createResult({
        issues: [{ file: "a.ts", line: "1", ruleId: "R1" } as any],
      });
      gitProvider.listIssueComments.mockResolvedValue([
        { body: "<!-- spaceflow-review --> content" },
      ]);
      (deps.reviewReportService.parseMarkdown as any).mockReturnValue({ result: mockResult });

      const model = await ReviewResultModel.loadFromPr(createPr(gitProvider), deps);
      expect(model).not.toBeNull();
      expect(model!.issues).toHaveLength(1);
      expect(model!.issues[0].file).toBe("a.ts");
    });

    it("should return null when parseMarkdown returns no result", async () => {
      gitProvider.listIssueComments.mockResolvedValue([
        { body: "<!-- spaceflow-review --> content" },
      ]);
      (deps.reviewReportService.parseMarkdown as any).mockReturnValue({ issues: [] });

      const model = await ReviewResultModel.loadFromPr(createPr(gitProvider), deps);
      expect(model).toBeNull();
    });

    it("should return null on API error", async () => {
      gitProvider.listIssueComments.mockRejectedValue(new Error("API fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const model = await ReviewResultModel.loadFromPr(createPr(gitProvider), deps);
      expect(model).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should use findLast to get the latest AI comment", async () => {
      const result1 = createResult({
        issues: [{ file: "old.ts", line: "1", ruleId: "R1" } as any],
      });
      const result2 = createResult({
        issues: [{ file: "new.ts", line: "2", ruleId: "R2" } as any],
      });
      gitProvider.listIssueComments.mockResolvedValue([
        { body: "<!-- spaceflow-review --> old" },
        { body: "<!-- spaceflow-review --> new" },
      ]);
      (deps.reviewReportService.parseMarkdown as any)
        .mockReturnValueOnce({ result: result1 })
        .mockReturnValueOnce({ result: result2 });

      // parseMarkdown is called once with the LAST matching comment
      const model = await ReviewResultModel.loadFromPr(createPr(gitProvider), deps);
      expect(model).not.toBeNull();
      // findLast returns the last one, so parseMarkdown is called with "new" body
      expect(deps.reviewReportService.parseMarkdown).toHaveBeenCalledWith(
        "<!-- spaceflow-review --> new",
      );
    });
  });

  describe("create / empty", () => {
    it("should create model with provided result", () => {
      const result = createResult({ round: 3, issues: [{ file: "a.ts" } as any] });
      const model = ReviewResultModel.create(createPr(gitProvider), result, deps);
      expect(model.round).toBe(3);
      expect(model.issues).toHaveLength(1);
    });

    it("should create empty model", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      expect(model.round).toBe(0);
      expect(model.issues).toHaveLength(0);
      expect(model.result.success).toBe(true);
    });
  });

  // ─── 读取器 ───────────────────────────────────────────

  describe("accessors", () => {
    it("should get/set issues", () => {
      const model = ReviewResultModel.create(createPr(gitProvider), createResult(), deps);
      expect(model.issues).toEqual([]);
      model.issues = [{ file: "b.ts" } as any];
      expect(model.issues).toHaveLength(1);
    });

    it("should compute stats", () => {
      const issues = [
        { file: "a.ts", line: "1", valid: "true" },
        { file: "b.ts", line: "2", fixed: "2024-01-01" },
        { file: "c.ts", line: "3", resolved: "2024-01-01" },
      ] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      const stats = model.stats;
      expect(stats.fixed).toBe(1);
      expect(stats.resolved).toBe(1);
    });
  });

  // ─── 数据操作 ─────────────────────────────────────────

  describe("setResult / update / updateStats", () => {
    it("should replace result entirely", () => {
      const model = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({ round: 1 }),
        deps,
      );
      model.setResult(createResult({ round: 5 }));
      expect(model.round).toBe(5);
    });

    it("should update partial fields", () => {
      const model = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({ round: 1 }),
        deps,
      );
      model.update({ round: 3, description: "updated" });
      expect(model.round).toBe(3);
      expect(model.result.description).toBe("updated");
    });

    it("should update stats and store in result", () => {
      const issues = [{ file: "a.ts", line: "1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      const stats = model.updateStats();
      expect(stats).toBeDefined();
      expect(model.result.stats).toBe(stats);
    });
  });

  // ─── nextRound ─────────────────────────────────────────

  describe("nextRound", () => {
    it("should increment round number", () => {
      const existing = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({ round: 2, issues: [{ file: "old.ts", line: "1", round: 2 } as any] }),
        deps,
      );
      const newResult = createResult({ issues: [{ file: "new.ts", line: "5" } as any] });
      const next = existing.nextRound(newResult);
      expect(next.round).toBe(3);
    });

    it("should tag new issues with next round number", () => {
      const existing = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({ round: 1, issues: [] }),
        deps,
      );
      const newResult = createResult({
        issues: [{ file: "a.ts", line: "1" } as any, { file: "b.ts", line: "2" } as any],
      });
      const next = existing.nextRound(newResult);
      expect(next.issues[0].round).toBe(2);
      expect(next.issues[1].round).toBe(2);
    });

    it("should merge existing issues with new issues", () => {
      const existing = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({
          round: 1,
          issues: [{ file: "old.ts", line: "1", round: 1, ruleId: "R1" } as any],
        }),
        deps,
      );
      const newResult = createResult({
        issues: [{ file: "new.ts", line: "5", ruleId: "R2" } as any],
        title: "New Title",
        description: "New Desc",
      });
      const next = existing.nextRound(newResult);
      expect(next.issues).toHaveLength(2);
      expect(next.issues[0].file).toBe("old.ts");
      expect(next.issues[0].round).toBe(1);
      expect(next.issues[1].file).toBe("new.ts");
      expect(next.issues[1].round).toBe(2);
    });

    it("should copy metadata from newResult", () => {
      const existing = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({ round: 1, title: "Old", description: "Old desc" }),
        deps,
      );
      const newResult = createResult({ title: "New Title", description: "New Desc" });
      const next = existing.nextRound(newResult);
      expect(next.result.title).toBe("New Title");
      expect(next.result.description).toBe("New Desc");
    });

    it("should preserve the same pr reference", () => {
      const pr = createPr(gitProvider);
      const existing = ReviewResultModel.create(pr, createResult({ round: 1 }), deps);
      const next = existing.nextRound(createResult());
      expect(next.pr).toBe(pr);
    });
  });

  // ─── createLocal ──────────────────────────────────────

  describe("createLocal", () => {
    it("should create model without requiring a real PR", () => {
      const result = createResult({ round: 1, issues: [{ file: "a.ts" } as any] });
      const model = ReviewResultModel.createLocal(result, deps);
      expect(model.round).toBe(1);
      expect(model.issues).toHaveLength(1);
      expect(model.pr.number).toBe(0);
    });

    it("should support formatComment without real PR", () => {
      const model = ReviewResultModel.createLocal(createResult(), deps);
      const comment = model.formatComment({ outputFormat: "terminal" });
      expect(comment).toBe("terminal");
    });
  });

  // ─── syncResolved ─────────────────────────────────────

  describe("syncResolved", () => {
    it("should do nothing when no resolved threads", async () => {
      gitProvider.listResolvedThreads.mockResolvedValue([]);
      const issues = [{ file: "a.ts", line: "10", ruleId: "R1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.syncResolved();
      expect(issues[0].resolved).toBeUndefined();
    });

    it("should mark issue as resolved by path:line match", async () => {
      gitProvider.listResolvedThreads.mockResolvedValue([
        { path: "a.ts", line: 10, resolvedBy: { id: 1, login: "user1" } },
      ]);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const issues = [{ file: "a.ts", line: "10", ruleId: "R1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.syncResolved();
      expect(issues[0].resolved).toBeDefined();
      expect(issues[0].resolvedBy?.login).toBe("user1");
      consoleSpy.mockRestore();
    });

    it("should match by issue key from comment body", async () => {
      gitProvider.listResolvedThreads.mockResolvedValue([
        {
          path: "a.ts",
          line: 10,
          body: "<!-- issue-key: a.ts:10:R1 -->",
          resolvedBy: { id: 2, login: "user2" },
        },
      ]);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const issues = [{ file: "a.ts", line: "10", ruleId: "R1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.syncResolved();
      expect(issues[0].resolved).toBeDefined();
      expect(issues[0].resolvedBy?.login).toBe("user2");
      consoleSpy.mockRestore();
    });

    it("should not overwrite already resolved issues", async () => {
      gitProvider.listResolvedThreads.mockResolvedValue([
        { path: "a.ts", line: 10, resolvedBy: { id: 2, login: "user2" } },
      ]);
      const issues = [{ file: "a.ts", line: "10", ruleId: "R1", resolved: "2024-01-01" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.syncResolved();
      expect(issues[0].resolved).toBe("2024-01-01"); // unchanged
    });

    it("should handle API error gracefully", async () => {
      gitProvider.listResolvedThreads.mockRejectedValue(new Error("fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const model = ReviewResultModel.create(
        createPr(gitProvider),
        createResult({ issues: [{ file: "a.ts", line: "1" } as any] }),
        deps,
      );
      await model.syncResolved();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ─── invalidateChangedFiles ───────────────────────────

  describe("invalidateChangedFiles", () => {
    it("should skip when no headSha", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const issues = [{ file: "a.ts", line: "1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.invalidateChangedFiles(undefined, undefined, 1);
      expect(issues[0].valid).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith("   ⚠️ 无法获取 PR head SHA，跳过变更文件检查");
      consoleSpy.mockRestore();
    });

    it("should skip when diff is empty", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      gitProvider.getCommitDiff.mockResolvedValue("");
      const issues = [{ file: "a.ts", line: "1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.invalidateChangedFiles("abc123", undefined, 1);
      expect(issues[0].valid).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it("should mark issues as invalid when file changed", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      gitProvider.getCommitDiff.mockResolvedValue(
        "diff --git a/changed.ts b/changed.ts\n--- a/changed.ts\n+++ b/changed.ts\n@@ -1,1 +1,2 @@\n line1\n+new",
      );
      const issues = [
        { file: "changed.ts", line: "1", ruleId: "R1" },
        { file: "unchanged.ts", line: "2", ruleId: "R2" },
      ] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.invalidateChangedFiles("abc123", undefined, 1);
      expect(model.issues[0].valid).toBe("false");
      expect(model.issues[1].valid).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it("should not invalidate already fixed/resolved/invalid issues", async () => {
      gitProvider.getCommitDiff.mockResolvedValue(
        "diff --git a/changed.ts b/changed.ts\n--- a/changed.ts\n+++ b/changed.ts\n@@ -1,1 +1,2 @@\n line1\n+new",
      );
      const issues = [
        { file: "changed.ts", line: "1", ruleId: "R1", fixed: "2024-01-01" },
        { file: "changed.ts", line: "2", ruleId: "R2", resolved: "2024-01-01" },
        { file: "changed.ts", line: "3", ruleId: "R3", valid: "false" },
      ] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.invalidateChangedFiles("abc123");
      // None should be further modified
      expect(model.issues[0].fixed).toBe("2024-01-01");
      expect(model.issues[1].resolved).toBe("2024-01-01");
      expect(model.issues[2].valid).toBe("false");
    });

    it("should handle API error gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      gitProvider.getCommitDiff.mockRejectedValue(new Error("diff fail"));
      const issues = [{ file: "a.ts", line: "1" }] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      await model.invalidateChangedFiles("abc123", undefined, 1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should preserve resolved issue when current code differs from issue.code", async () => {
      gitProvider.getCommitDiff.mockResolvedValue(
        "diff --git a/changed.ts b/changed.ts\n--- a/changed.ts\n+++ b/changed.ts\n@@ -1,1 +1,2 @@\n line1\n+new",
      );
      const issues = [
        { file: "changed.ts", line: "1", ruleId: "R1", resolved: "2024-01-01", code: "old code" },
      ] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      const fileContents: Map<string, [string, string][]> = new Map([
        ["changed.ts", [["abc1234", "new code"]]],
      ]);
      await model.invalidateChangedFiles("abc123", fileContents);
      expect(model.issues[0].valid).toBeUndefined();
      expect(model.issues[0].resolved).toBe("2024-01-01");
    });

    it("should invalidate resolved issue when current code matches issue.code", async () => {
      gitProvider.getCommitDiff.mockResolvedValue(
        "diff --git a/changed.ts b/changed.ts\n--- a/changed.ts\n+++ b/changed.ts\n@@ -1,1 +1,2 @@\n old code\n+new",
      );
      const issues = [
        { file: "changed.ts", line: "1", ruleId: "R1", resolved: "2024-01-01", code: "old code" },
      ] as any[];
      const model = ReviewResultModel.create(createPr(gitProvider), createResult({ issues }), deps);
      const fileContents: Map<string, [string, string][]> = new Map([
        ["changed.ts", [["abc1234", "old code"]]],
      ]);
      await model.invalidateChangedFiles("abc123", fileContents);
      expect(model.issues[0].valid).toBe("false");
    });
  });

  // ─── deleteOldReviews ─────────────────────────────────

  describe("deleteOldReviews", () => {
    it("should delete AI reviews and comments", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      gitProvider.listPullReviews.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> old" },
        { id: 2, body: "normal review" },
      ]);
      gitProvider.listIssueComments.mockResolvedValue([
        { id: 10, body: "<!-- spaceflow-review --> comment" },
      ]);
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      await model.deleteOldReviews();
      expect(gitProvider.deletePullReview).toHaveBeenCalledWith("o", "r", 1, 1);
      expect(gitProvider.deleteIssueComment).toHaveBeenCalledWith("o", "r", 10);
      consoleSpy.mockRestore();
    });

    it("should skip non-AI reviews", async () => {
      gitProvider.listPullReviews.mockResolvedValue([{ id: 1, body: "human review" }]);
      gitProvider.listIssueComments.mockResolvedValue([]);
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      await model.deleteOldReviews();
      expect(gitProvider.deletePullReview).not.toHaveBeenCalled();
    });
  });

  // ─── formatComment ────────────────────────────────────

  describe("formatComment", () => {
    it("should use markdown format in CI with prNumber", () => {
      const model = ReviewResultModel.create(createPr(gitProvider), createResult(), deps);
      model.formatComment({ ci: true, prNumber: 1 });
      expect(deps.reviewReportService.formatMarkdown).toHaveBeenCalled();
    });

    it("should use terminal format by default", () => {
      const model = ReviewResultModel.create(createPr(gitProvider), createResult(), deps);
      model.formatComment({});
      expect(deps.reviewReportService.format).toHaveBeenCalled();
    });

    it("should respect explicit outputFormat", () => {
      const model = ReviewResultModel.create(createPr(gitProvider), createResult(), deps);
      model.formatComment({ outputFormat: "markdown", prNumber: 1 });
      expect(deps.reviewReportService.formatMarkdown).toHaveBeenCalled();
    });
  });

  // ─── lineMatchesPosition ──────────────────────────────

  describe("lineMatchesPosition", () => {
    it("should return false when no position", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      expect(model.lineMatchesPosition("10", undefined)).toBe(false);
    });

    it("should return true when position is in range", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      expect(model.lineMatchesPosition("5-15", 10)).toBe(true);
    });

    it("should return false when position is outside range", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      expect(model.lineMatchesPosition("5-15", 20)).toBe(false);
    });

    it("should handle single line number", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      expect(model.lineMatchesPosition("10", 10)).toBe(true);
      expect(model.lineMatchesPosition("10", 11)).toBe(false);
    });
  });

  // ─── issueToReviewComment ─────────────────────────────

  describe("issueToReviewComment", () => {
    it("should return null for unparseable line", () => {
      (deps.reviewSpecService.parseLineRange as any).mockReturnValueOnce([]);
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const result = model.issueToReviewComment({
        file: "a.ts",
        line: "abc",
        ruleId: "R1",
        specFile: "s.md",
        reason: "bad",
      } as any);
      expect(result).toBeNull();
    });

    it("should create review comment with correct fields", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const comment = model.issueToReviewComment({
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "rule.md",
        reason: "问题描述",
        severity: "error",
      } as any);
      expect(comment).not.toBeNull();
      expect(comment!.path).toBe("test.ts");
      expect(comment!.new_position).toBe(10);
      expect(comment!.body).toContain("🔴");
      expect(comment!.body).toContain("问题描述");
      expect(comment!.body).toContain("issue-key: test.ts:10:R1");
    });

    it("should include suggestion block when present", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const comment = model.issueToReviewComment({
        file: "test.ts",
        line: "10",
        ruleId: "R1",
        specFile: "rule.md",
        reason: "bad",
        severity: "warn",
        suggestion: "const x = 1;",
      } as any);
      expect(comment!.body).toContain("建议");
      expect(comment!.body).toContain("const x = 1;");
    });
  });

  // ─── buildLineReviewBody ──────────────────────────────

  describe("buildLineReviewBody", () => {
    it("should show no issues message when empty", () => {
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const body = model.buildLineReviewBody([], 1, []);
      expect(body).toContain("✅ 未发现新问题");
      expect(body).toContain("Round 1");
    });

    it("should show issue count and file count", () => {
      const issues = [
        { file: "a.ts", line: "1", severity: "error" },
        { file: "b.ts", line: "2", severity: "warn" },
      ] as any[];
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const body = model.buildLineReviewBody(issues, 1, issues);
      expect(body).toContain("2");
      expect(body).toContain("**2** 个文件");
    });

    it("should include previous round review for round > 1", () => {
      const allIssues = [
        { file: "a.ts", line: "1", round: 1, fixed: "2024-01-01" },
        { file: "b.ts", line: "2", round: 2, severity: "error" },
      ] as any[];
      const newIssues = allIssues.filter((i) => i.round === 2);
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const body = model.buildLineReviewBody(newIssues, 2, allIssues);
      expect(body).toContain("Round 1 回顾");
      expect(body).toContain("已验收");
    });
  });

  // ─── parseFromComment ─────────────────────────────────

  describe("parseFromComment", () => {
    it("should return null when parseMarkdown returns null", () => {
      (deps.reviewReportService.parseMarkdown as any).mockReturnValueOnce(null);
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      expect(model.parseFromComment("some body")).toBeNull();
    });

    it("should return result when parseMarkdown succeeds", () => {
      const result = createResult({ round: 2 });
      (deps.reviewReportService.parseMarkdown as any).mockReturnValueOnce({ result });
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const parsed = model.parseFromComment("some body");
      expect(parsed).not.toBeNull();
      expect(parsed!.round).toBe(2);
    });
  });

  // ─── findExistingAiComments ───────────────────────────

  describe("findExistingAiComments", () => {
    it("should return AI comments with marker", async () => {
      gitProvider.listIssueComments.mockResolvedValue([
        { id: 1, body: "<!-- spaceflow-review --> content" },
        { id: 2, body: "normal" },
        { id: 3, body: "<!-- spaceflow-review --> more" },
      ]);
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const comments = await model.findExistingAiComments();
      expect(comments).toHaveLength(2);
      expect(comments[0].id).toBe(1);
      expect(comments[1].id).toBe(3);
    });

    it("should return empty on API error", async () => {
      gitProvider.listIssueComments.mockRejectedValue(new Error("fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const model = ReviewResultModel.empty(createPr(gitProvider), deps);
      const comments = await model.findExistingAiComments();
      expect(comments).toEqual([]);
      consoleSpy.mockRestore();
    });
  });
});
