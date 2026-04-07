import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  REVIEW_COMMENT_MARKER,
  REVIEW_LINE_COMMENTS_MARKER,
  extractIssueKeyFromBody,
  isAiGeneratedComment,
  generateIssueKey,
  syncRepliesToIssues,
  deleteExistingAiReviews,
  calculateIssueStats,
} from "./review-pr-comment";

describe("utils/review-pr-comment", () => {
  // ─── 常量 ────────────────────────────────────────────────

  describe("markers", () => {
    it("REVIEW_COMMENT_MARKER 包含预期字符串", () => {
      expect(REVIEW_COMMENT_MARKER).toBe("<!-- spaceflow-review -->");
    });

    it("REVIEW_LINE_COMMENTS_MARKER 包含预期字符串", () => {
      expect(REVIEW_LINE_COMMENTS_MARKER).toBe("<!-- spaceflow-review-lines -->");
    });
  });

  // ─── extractIssueKeyFromBody ─────────────────────────────

  describe("extractIssueKeyFromBody", () => {
    it("提取标准格式的 issue key", () => {
      expect(extractIssueKeyFromBody("<!-- issue-key: src/a.ts:10:R1 -->")).toBe(
        "src/a.ts:10:R1",
      );
    });

    it("body 不含 issue-key 时返回 null", () => {
      expect(extractIssueKeyFromBody("普通评论内容")).toBeNull();
    });

    it("issue key 含空格时正确提取（trim）", () => {
      expect(extractIssueKeyFromBody("<!-- issue-key: a.ts:1:R1 -->")).toBe("a.ts:1:R1");
    });
  });

  // ─── isAiGeneratedComment ────────────────────────────────

  describe("isAiGeneratedComment", () => {
    it("含 issue-key 标记时返回 true", () => {
      expect(isAiGeneratedComment("some body <!-- issue-key: a.ts:1:R1 --> end")).toBe(true);
    });

    it("同时含规则和文件字段时返回 true", () => {
      expect(isAiGeneratedComment("- **规则**: R1\n- **文件**: a.ts:1")).toBe(true);
    });

    it("普通用户评论返回 false", () => {
      expect(isAiGeneratedComment("LGTM")).toBe(false);
    });

    it("空字符串返回 false", () => {
      expect(isAiGeneratedComment("")).toBe(false);
    });

    it("只含规则字段（不含文件字段）返回 false", () => {
      expect(isAiGeneratedComment("- **规则**: R1")).toBe(false);
    });
  });

  // ─── generateIssueKey ───────────────────────────────────

  describe("generateIssueKey", () => {
    it("拼接 file:line:ruleId", () => {
      expect(
        generateIssueKey({ file: "src/a.ts", line: "10", ruleId: "R1" } as any),
      ).toBe("src/a.ts:10:R1");
    });
  });

  // ─── calculateIssueStats ────────────────────────────────

  describe("calculateIssueStats", () => {
    it("空数组返回全零统计", () => {
      const stats = calculateIssueStats([]);
      expect(stats).toEqual({
        total: 0,
        validTotal: 0,
        fixed: 0,
        resolved: 0,
        invalid: 0,
        pending: 0,
        fixRate: 0,
        resolveRate: 0,
      });
    });

    it("全部待处理问题", () => {
      const issues = [
        { file: "a.ts", line: "1", ruleId: "R1" },
        { file: "b.ts", line: "2", ruleId: "R2" },
      ] as any[];
      const stats = calculateIssueStats(issues);
      expect(stats.total).toBe(2);
      expect(stats.validTotal).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.fixed).toBe(0);
      expect(stats.resolved).toBe(0);
      expect(stats.invalid).toBe(0);
    });

    it("valid=false 的问题计入 invalid，不计入 pending", () => {
      const issues = [
        { file: "a.ts", line: "1", ruleId: "R1", valid: "false" },
        { file: "b.ts", line: "2", ruleId: "R2" },
      ] as any[];
      const stats = calculateIssueStats(issues);
      expect(stats.total).toBe(2);
      expect(stats.invalid).toBe(1);
      expect(stats.validTotal).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it("fixed 问题计入 fixed，不计入 pending", () => {
      const issues = [
        { file: "a.ts", line: "1", ruleId: "R1", fixed: "2024-01-01" },
        { file: "b.ts", line: "2", ruleId: "R2" },
      ] as any[];
      const stats = calculateIssueStats(issues);
      expect(stats.fixed).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it("resolved（非 fixed）计入 resolved，不计入 pending", () => {
      const issues = [
        { file: "a.ts", line: "1", ruleId: "R1", resolved: "2024-01-01" },
      ] as any[];
      const stats = calculateIssueStats(issues);
      expect(stats.resolved).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it("fixed 同时有 resolved 时只计入 fixed", () => {
      const issues = [
        { file: "a.ts", line: "1", ruleId: "R1", fixed: "2024-01-01", resolved: "2024-01-01" },
      ] as any[];
      const stats = calculateIssueStats(issues);
      expect(stats.fixed).toBe(1);
      expect(stats.resolved).toBe(0);
    });

    it("fixRate 计算正确（2/4 = 50%）", () => {
      const issues = Array.from({ length: 4 }, (_, i) => ({
        file: "a.ts",
        line: String(i + 1),
        ruleId: "R1",
        ...(i < 2 ? { fixed: "2024-01-01" } : {}),
      })) as any[];
      const stats = calculateIssueStats(issues);
      expect(stats.fixRate).toBe(50);
    });
  });

  // ─── syncRepliesToIssues ─────────────────────────────────

  describe("syncRepliesToIssues", () => {
    const lineMatchesPosition = (line: string, pos?: number) =>
      pos !== undefined && String(pos) === line;

    it("单条评论（无回复）不产生 replies", async () => {
      const issue = { file: "a.ts", line: "1", ruleId: "R1" } as any;
      const result = { issues: [issue] } as any;
      const comments = [
        {
          id: 1,
          path: "a.ts",
          position: 1,
          body: `🔴 **问题**\n<!-- issue-key: a.ts:1:R1 -->`,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];
      await syncRepliesToIssues(comments, result, lineMatchesPosition);
      expect(issue.replies).toBeUndefined();
    });

    it("用户回复通过 issue-key 精确匹配后加入 replies", async () => {
      const issue = { file: "a.ts", line: "1", ruleId: "R1" } as any;
      const result = { issues: [issue] } as any;
      const comments = [
        {
          id: 1,
          path: "a.ts",
          position: 1,
          body: `🔴 问题\n<!-- issue-key: a.ts:1:R1 -->`,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          path: "a.ts",
          position: 1,
          body: "已修复",
          user: { id: 42, login: "dev1" },
          created_at: "2024-01-01T01:00:00Z",
        },
      ];
      await syncRepliesToIssues(comments, result, lineMatchesPosition);
      expect(issue.replies).toHaveLength(1);
      expect(issue.replies[0].body).toBe("已修复");
      expect(issue.replies[0].user.login).toBe("dev1");
    });

    it("AI 格式特征的评论不被计为用户回复", async () => {
      const issue = { file: "a.ts", line: "1", ruleId: "R1" } as any;
      const result = { issues: [issue] } as any;
      const comments = [
        {
          id: 1,
          path: "a.ts",
          position: 1,
          body: `🔴 问题\n<!-- issue-key: a.ts:1:R1 -->`,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          path: "a.ts",
          position: 1,
          body: "- **规则**: R2\n- **文件**: b.ts:2",
          created_at: "2024-01-01T01:00:00Z",
        },
      ];
      await syncRepliesToIssues(comments, result, lineMatchesPosition);
      expect(issue.replies).toBeUndefined();
    });

    it("同一 issue 多条用户回复全部追加", async () => {
      const issue = { file: "a.ts", line: "1", ruleId: "R1" } as any;
      const result = { issues: [issue] } as any;
      const comments = [
        {
          id: 1,
          path: "a.ts",
          position: 1,
          body: `<!-- issue-key: a.ts:1:R1 -->`,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          path: "a.ts",
          position: 1,
          body: "回复1",
          user: { login: "u1" },
          created_at: "2024-01-01T01:00:00Z",
        },
        {
          id: 3,
          path: "a.ts",
          position: 1,
          body: "回复2",
          user: { login: "u2" },
          created_at: "2024-01-01T02:00:00Z",
        },
      ];
      await syncRepliesToIssues(comments, result, lineMatchesPosition);
      expect(issue.replies).toHaveLength(2);
    });
  });

  // ─── deleteExistingAiReviews ─────────────────────────────

  describe("deleteExistingAiReviews", () => {
    let pr: any;

    beforeEach(() => {
      pr = {
        getReviews: vi.fn(),
        deleteReview: vi.fn(),
        getComments: vi.fn(),
        deleteComment: vi.fn(),
      };
    });

    it("删除含 REVIEW_LINE_COMMENTS_MARKER 的 PR Review", async () => {
      pr.getReviews.mockResolvedValue([
        { id: 1, body: `${REVIEW_LINE_COMMENTS_MARKER} Round 1` },
        { id: 2, body: "普通 review" },
      ]);
      pr.deleteReview.mockResolvedValue(undefined);
      pr.getComments.mockResolvedValue([]);

      await deleteExistingAiReviews(pr);

      expect(pr.deleteReview).toHaveBeenCalledTimes(1);
      expect(pr.deleteReview).toHaveBeenCalledWith(1);
    });

    it("删除含 REVIEW_COMMENT_MARKER 的 Issue Comment", async () => {
      pr.getReviews.mockResolvedValue([]);
      pr.getComments.mockResolvedValue([
        { id: 10, body: `${REVIEW_COMMENT_MARKER} 报告内容` },
        { id: 11, body: "普通评论" },
      ]);
      pr.deleteComment.mockResolvedValue(undefined);

      await deleteExistingAiReviews(pr);

      expect(pr.deleteComment).toHaveBeenCalledTimes(1);
      expect(pr.deleteComment).toHaveBeenCalledWith(10);
    });

    it("deleteReview 失败时静默忽略，继续处理其他", async () => {
      pr.getReviews.mockResolvedValue([
        { id: 1, body: REVIEW_LINE_COMMENTS_MARKER },
        { id: 2, body: REVIEW_LINE_COMMENTS_MARKER },
      ]);
      pr.deleteReview
        .mockRejectedValueOnce(new Error("submitted review cannot be deleted"))
        .mockResolvedValueOnce(undefined);
      pr.getComments.mockResolvedValue([]);

      await expect(deleteExistingAiReviews(pr)).resolves.not.toThrow();
      expect(pr.deleteReview).toHaveBeenCalledTimes(2);
    });

    it("getReviews 失败时静默忽略，继续处理 comments", async () => {
      pr.getReviews.mockRejectedValue(new Error("API error"));
      pr.getComments.mockResolvedValue([{ id: 10, body: REVIEW_COMMENT_MARKER }]);
      pr.deleteComment.mockResolvedValue(undefined);

      await expect(deleteExistingAiReviews(pr)).resolves.not.toThrow();
      expect(pr.deleteComment).toHaveBeenCalledWith(10);
    });

    it("无 AI 评论时不调用任何 delete", async () => {
      pr.getReviews.mockResolvedValue([{ id: 1, body: "普通 review" }]);
      pr.getComments.mockResolvedValue([{ id: 10, body: "普通评论" }]);

      await deleteExistingAiReviews(pr);

      expect(pr.deleteReview).not.toHaveBeenCalled();
      expect(pr.deleteComment).not.toHaveBeenCalled();
    });
  });
});
