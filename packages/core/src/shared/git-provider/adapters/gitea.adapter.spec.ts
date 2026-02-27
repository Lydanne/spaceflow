import { vi, type MockInstance } from "vitest";
import { GiteaAdapter } from "./gitea.adapter";
import type { GitProviderModuleOptions } from "../types";

const mockOptions: GitProviderModuleOptions = {
  provider: "gitea",
  baseUrl: "https://gitea.example.com",
  token: "test-token",
};

/** 构造 mock Response */
function mockResponse(body: unknown, status = 200): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as Response;
}

describe("GiteaAdapter", () => {
  let adapter: GiteaAdapter;
  let fetchSpy: MockInstance;

  beforeEach(() => {
    adapter = new GiteaAdapter(mockOptions);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({}));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ============ 配置验证 ============

  describe("validateConfig", () => {
    it("配置完整时不应抛出异常", () => {
      expect(() => adapter.validateConfig()).not.toThrow();
    });

    it("缺少 baseUrl 时应抛出异常", () => {
      const a = new GiteaAdapter({ ...mockOptions, baseUrl: "" });
      expect(() => a.validateConfig()).toThrow("缺少配置 gitProvider.baseUrl");
    });

    it("缺少 token 时应抛出异常", () => {
      const a = new GiteaAdapter({ ...mockOptions, token: "" });
      expect(() => a.validateConfig()).toThrow("缺少配置 gitProvider.token");
    });
  });

  // ============ request 基础方法 ============

  describe("request", () => {
    it("GET 请求应拼接正确的 URL 和 headers", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1 }));
      await adapter.getRepository("owner", "repo");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "token test-token",
          }),
        }),
      );
    });

    it("POST 请求应正确序列化 body", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1 }));
      await adapter.createIssue("owner", "repo", { title: "test" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/issues",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "test" }),
        }),
      );
    });

    it("API 返回错误时应抛出异常", async () => {
      fetchSpy.mockResolvedValue(mockResponse("Not Found", 404));
      await expect(adapter.getRepository("owner", "repo")).rejects.toThrow("Gitea API error: 404");
    });

    it("204 响应应返回空对象", async () => {
      fetchSpy.mockResolvedValue(mockResponse("", 204));
      const result = await adapter.deleteBranchProtection("owner", "repo", "main");
      expect(result).toBeUndefined();
    });
  });

  // ============ 分支保护 ============

  describe("listBranchProtections", () => {
    it("应返回分支保护规则列表", async () => {
      const protections = [{ rule_name: "main", enable_push: false }];
      fetchSpy.mockResolvedValue(mockResponse(protections));
      const result = await adapter.listBranchProtections("owner", "repo");
      expect(result).toEqual(protections);
    });
  });

  describe("lockBranch", () => {
    it("无现有规则时应创建新规则（无白名单）", async () => {
      // listBranchProtections 返回空
      fetchSpy.mockResolvedValueOnce(mockResponse([]));
      // createBranchProtection 返回新规则
      const newProtection = { rule_name: "main", enable_push: false };
      fetchSpy.mockResolvedValueOnce(mockResponse(newProtection));
      const result = await adapter.lockBranch("owner", "repo", "main");
      expect(result).toEqual(newProtection);
      // 第二次调用应该是 POST 创建
      const createCall = fetchSpy.mock.calls[1];
      expect(createCall[0]).toContain("/branch_protections");
      expect(createCall[1].method).toBe("POST");
      const body = JSON.parse(createCall[1].body);
      expect(body.enable_push).toBe(false);
    });

    it("有现有规则时应更新规则", async () => {
      const existing = [{ rule_name: "main", enable_push: true }];
      fetchSpy.mockResolvedValueOnce(mockResponse(existing));
      const updated = { rule_name: "main", enable_push: false };
      fetchSpy.mockResolvedValueOnce(mockResponse(updated));
      const result = await adapter.lockBranch("owner", "repo", "main");
      expect(result).toEqual(updated);
      // 第二次调用应该是 PATCH 更新
      const editCall = fetchSpy.mock.calls[1];
      expect(editCall[1].method).toBe("PATCH");
    });

    it("有白名单时应启用推送白名单", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse([]));
      fetchSpy.mockResolvedValueOnce(mockResponse({ rule_name: "main" }));
      await adapter.lockBranch("owner", "repo", "main", {
        pushWhitelistUsernames: ["bot-user"],
      });
      const body = JSON.parse(fetchSpy.mock.calls[1][1].body);
      expect(body.enable_push).toBe(true);
      expect(body.enable_push_whitelist).toBe(true);
      expect(body.push_whitelist_usernames).toEqual(["bot-user"]);
    });
  });

  describe("unlockBranch", () => {
    it("有保护规则时应删除并返回", async () => {
      const existing = [{ rule_name: "main", enable_push: false }];
      fetchSpy.mockResolvedValueOnce(mockResponse(existing));
      // deleteBranchProtection 返回 204
      fetchSpy.mockResolvedValueOnce(mockResponse("", 204));
      const result = await adapter.unlockBranch("owner", "repo", "main");
      expect(result).toEqual(existing[0]);
      expect(fetchSpy.mock.calls[1][1].method).toBe("DELETE");
    });

    it("无保护规则时应返回 null", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse([]));
      const result = await adapter.unlockBranch("owner", "repo", "main");
      expect(result).toBeNull();
    });
  });

  // ============ Pull Request ============

  describe("getPullRequest", () => {
    it("应请求正确的 URL", async () => {
      const pr = { id: 1, number: 42, title: "Test PR" };
      fetchSpy.mockResolvedValue(mockResponse(pr));
      const result = await adapter.getPullRequest("owner", "repo", 42);
      expect(result).toEqual(pr);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/pulls/42",
        expect.anything(),
      );
    });
  });

  describe("listAllPullRequests", () => {
    it("应支持分页获取全部", async () => {
      const page1 = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      const page2 = [{ id: 50 }, { id: 51 }];
      fetchSpy
        .mockResolvedValueOnce(mockResponse(page1))
        .mockResolvedValueOnce(mockResponse(page2));
      const result = await adapter.listAllPullRequests("owner", "repo", { state: "closed" });
      expect(result).toHaveLength(52);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("单页不满时应停止分页", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse([{ id: 1 }]));
      const result = await adapter.listAllPullRequests("owner", "repo");
      expect(result).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPullRequestCommits", () => {
    it("应支持分页获取全部 commits", async () => {
      const page1 = Array.from({ length: 50 }, (_, i) => ({ sha: `sha${i}` }));
      const page2 = [{ sha: "sha50" }];
      fetchSpy
        .mockResolvedValueOnce(mockResponse(page1))
        .mockResolvedValueOnce(mockResponse(page2));
      const result = await adapter.getPullRequestCommits("owner", "repo", 1);
      expect(result).toHaveLength(51);
    });
  });

  describe("getPullRequestFiles", () => {
    it("文件有 patch 时应直接返回", async () => {
      const files = [{ filename: "a.ts", patch: "@@ -1 +1 @@", status: "modified" }];
      fetchSpy.mockResolvedValue(mockResponse(files));
      const result = await adapter.getPullRequestFiles("owner", "repo", 1);
      expect(result).toEqual(files);
      // 只调用一次（不需要获取 diff）
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("文件缺少 patch 时应从 diff 回填", async () => {
      const files = [{ filename: "a.ts", status: "modified" }];
      fetchSpy.mockResolvedValueOnce(mockResponse(files));
      // getPullRequestDiff 返回 diff 文本
      const diffText = "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new";
      fetchSpy.mockResolvedValueOnce(mockResponse(diffText));
      const result = await adapter.getPullRequestFiles("owner", "repo", 1);
      expect(result[0].filename).toBe("a.ts");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("deleted 文件缺少 patch 不应触发 diff 回填", async () => {
      const files = [{ filename: "a.ts", status: "deleted" }];
      fetchSpy.mockResolvedValue(mockResponse(files));
      await adapter.getPullRequestFiles("owner", "repo", 1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPullRequestDiff", () => {
    it("应请求 .diff 后缀 URL", async () => {
      fetchSpy.mockResolvedValue(mockResponse("diff text"));
      await adapter.getPullRequestDiff("owner", "repo", 1);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/pulls/1.diff",
        expect.anything(),
      );
    });
  });

  // ============ Commit ============

  describe("getCommit", () => {
    it("应请求 /git/commits/ 路径", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ sha: "abc123" }));
      await adapter.getCommit("owner", "repo", "abc123");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/git/commits/abc123",
        expect.anything(),
      );
    });
  });

  describe("getCompareDiff", () => {
    it("应请求 compare URL", async () => {
      fetchSpy.mockResolvedValue(mockResponse("diff"));
      await adapter.getCompareDiff("owner", "repo", "base", "head");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/compare/base...head.diff",
        expect.anything(),
      );
    });
  });

  describe("getCommitDiff", () => {
    it("应请求 /git/commits/sha.diff", async () => {
      fetchSpy.mockResolvedValue(mockResponse("diff"));
      await adapter.getCommitDiff("owner", "repo", "abc");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/git/commits/abc.diff",
        expect.anything(),
      );
    });
  });

  // ============ 文件操作 ============

  describe("getFileContent", () => {
    it("应请求 /raw/ 路径", async () => {
      fetchSpy.mockResolvedValue(mockResponse("file content"));
      const result = await adapter.getFileContent("owner", "repo", "src/index.ts");
      expect(result).toBe("file content");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/raw/src%2Findex.ts"),
        expect.anything(),
      );
    });

    it("指定 ref 时应添加 query 参数", async () => {
      fetchSpy.mockResolvedValue(mockResponse("content"));
      await adapter.getFileContent("owner", "repo", "a.ts", "main");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("?ref=main"),
        expect.anything(),
      );
    });

    it("404 时应返回空字符串", async () => {
      fetchSpy.mockResolvedValue(mockResponse("Not Found", 404));
      const result = await adapter.getFileContent("owner", "repo", "missing.ts");
      expect(result).toBe("");
    });
  });

  // ============ Issue 操作 ============

  describe("createIssue", () => {
    it("应 POST 创建 issue", async () => {
      const issue = { id: 1, title: "Bug" };
      fetchSpy.mockResolvedValue(mockResponse(issue));
      const result = await adapter.createIssue("owner", "repo", { title: "Bug" });
      expect(result).toEqual(issue);
    });
  });

  describe("listIssueComments", () => {
    it("应请求正确的 URL", async () => {
      fetchSpy.mockResolvedValue(mockResponse([]));
      await adapter.listIssueComments("owner", "repo", 5);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/issues/5/comments",
        expect.anything(),
      );
    });
  });

  describe("createIssueComment", () => {
    it("应 POST 创建评论", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1, body: "hello" }));
      await adapter.createIssueComment("owner", "repo", 5, { body: "hello" });
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body).toEqual({ body: "hello" });
    });
  });

  describe("updateIssueComment", () => {
    it("应 PATCH 更新评论", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1, body: "updated" }));
      await adapter.updateIssueComment("owner", "repo", 10, "updated");
      expect(fetchSpy.mock.calls[0][1].method).toBe("PATCH");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/issues/comments/10",
        expect.anything(),
      );
    });
  });

  describe("deleteIssueComment", () => {
    it("应 DELETE 删除评论", async () => {
      fetchSpy.mockResolvedValue(mockResponse("", 204));
      await adapter.deleteIssueComment("owner", "repo", 10);
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
    });
  });

  // ============ PR Review ============

  describe("createPullReview", () => {
    it("应 POST 创建 review", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1 }));
      await adapter.createPullReview("owner", "repo", 1, {
        event: "COMMENT",
        body: "LGTM",
        comments: [{ path: "a.ts", body: "fix this", new_position: 10 }],
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.event).toBe("COMMENT");
      expect(body.comments).toHaveLength(1);
    });
  });

  describe("listPullReviews", () => {
    it("应请求正确的 URL（带分页参数）", async () => {
      fetchSpy.mockResolvedValue(mockResponse([]));
      await adapter.listPullReviews("owner", "repo", 42);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/pulls/42/reviews?page=1&limit=50",
        expect.anything(),
      );
    });
  });

  describe("deletePullReview", () => {
    it("应 DELETE 删除 review", async () => {
      fetchSpy.mockResolvedValue(mockResponse("", 204));
      await adapter.deletePullReview("owner", "repo", 42, 100);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/pulls/42/reviews/100",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("listPullReviewComments", () => {
    it("应请求正确的 URL", async () => {
      fetchSpy.mockResolvedValue(mockResponse([]));
      await adapter.listPullReviewComments("owner", "repo", 42, 100);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/pulls/42/reviews/100/comments",
        expect.anything(),
      );
    });
  });

  // ============ Reaction ============

  describe("getIssueCommentReactions", () => {
    it("应请求正确的 URL", async () => {
      fetchSpy.mockResolvedValue(mockResponse([]));
      await adapter.getIssueCommentReactions("owner", "repo", 10);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/issues/comments/10/reactions",
        expect.anything(),
      );
    });
  });

  describe("getIssueReactions", () => {
    it("应请求正确的 URL", async () => {
      fetchSpy.mockResolvedValue(mockResponse([]));
      await adapter.getIssueReactions("owner", "repo", 5);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/repos/owner/repo/issues/5/reactions",
        expect.anything(),
      );
    });
  });

  // ============ 用户操作 ============

  describe("searchUsers", () => {
    it("应请求 /users/search 并解构 data 字段", async () => {
      const users = [{ id: 1, login: "test" }];
      fetchSpy.mockResolvedValue(mockResponse({ data: users }));
      const result = await adapter.searchUsers("test", 5);
      expect(result).toEqual(users);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/users/search?q=test&limit=5"),
        expect.anything(),
      );
    });

    it("data 为空时应返回空数组", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ data: null }));
      const result = await adapter.searchUsers("nobody");
      expect(result).toEqual([]);
    });
  });

  describe("getTeamMembers", () => {
    it("应请求 /teams/{id}/members", async () => {
      fetchSpy.mockResolvedValue(mockResponse([{ id: 1 }]));
      await adapter.getTeamMembers(99);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://gitea.example.com/api/v1/teams/99/members",
        expect.anything(),
      );
    });
  });
});
