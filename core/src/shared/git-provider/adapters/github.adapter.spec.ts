import { vi, type MockInstance } from "vitest";
import { GithubAdapter } from "./github.adapter";
import type { GitProviderModuleOptions } from "../types";

const mockOptions: GitProviderModuleOptions = {
  provider: "github",
  baseUrl: "https://api.github.com",
  token: "ghp-test-token",
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

describe("GithubAdapter", () => {
  let adapter: GithubAdapter;
  let fetchSpy: MockInstance;

  beforeEach(() => {
    adapter = new GithubAdapter(mockOptions);
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
      const a = new GithubAdapter({ ...mockOptions, baseUrl: "" });
      expect(() => a.validateConfig()).toThrow("缺少配置 gitProvider.baseUrl");
    });

    it("缺少 token 时应抛出异常", () => {
      const a = new GithubAdapter({ ...mockOptions, token: "" });
      expect(() => a.validateConfig()).toThrow("缺少配置 gitProvider.token");
    });
  });

  // ============ request 基础方法 ============

  describe("request", () => {
    it("应使用 Bearer 认证和 GitHub Accept header", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1, name: "repo" }));
      await adapter.getRepository("owner", "repo");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer ghp-test-token",
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          }),
        }),
      );
    });

    it("API 返回错误时应抛出异常", async () => {
      fetchSpy.mockResolvedValue(mockResponse("Not Found", 404));
      await expect(adapter.getRepository("owner", "repo")).rejects.toThrow("GitHub API error: 404");
    });
  });

  // ============ 仓库操作 ============

  describe("getRepository", () => {
    it("应正确映射 GitHub 响应", async () => {
      const ghRepo = {
        id: 123,
        name: "my-repo",
        full_name: "owner/my-repo",
        default_branch: "main",
        owner: { id: 1, login: "owner", full_name: "Owner" },
      };
      fetchSpy.mockResolvedValue(mockResponse(ghRepo));
      const result = await adapter.getRepository("owner", "my-repo");
      expect(result.id).toBe(123);
      expect(result.name).toBe("my-repo");
      expect(result.default_branch).toBe("main");
      expect(result.owner?.login).toBe("owner");
    });
  });

  // ============ 分支操作 ============

  describe("getBranch", () => {
    it("应正确映射 GitHub 分支响应", async () => {
      const ghBranch = {
        name: "main",
        protected: true,
        commit: { sha: "abc123", commit: { message: "init" } },
      };
      fetchSpy.mockResolvedValue(mockResponse(ghBranch));
      const result = await adapter.getBranch("owner", "repo", "main");
      expect(result.name).toBe("main");
      expect(result.protected).toBe(true);
      expect(result.commit?.id).toBe("abc123");
    });
  });

  // ============ 分支保护 ============

  describe("lockBranch", () => {
    it("无白名单时应设置 restrictions", async () => {
      fetchSpy.mockResolvedValue(mockResponse({}));
      await adapter.lockBranch("owner", "repo", "main");
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.restrictions).toEqual({ users: [], teams: [] });
      expect(body.enforce_admins).toBe(true);
    });

    it("有白名单时应设置 restrictions.users", async () => {
      fetchSpy.mockResolvedValue(mockResponse({}));
      await adapter.lockBranch("owner", "repo", "main", {
        pushWhitelistUsernames: ["bot"],
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.restrictions.users).toEqual(["bot"]);
    });
  });

  describe("unlockBranch", () => {
    it("有保护规则时应删除并返回", async () => {
      // getBranchProtection
      fetchSpy.mockResolvedValueOnce(mockResponse({ url: "..." }));
      // deleteBranchProtection
      fetchSpy.mockResolvedValueOnce(mockResponse("", 204));
      const result = await adapter.unlockBranch("owner", "repo", "main");
      expect(result).not.toBeNull();
      expect(fetchSpy.mock.calls[1][1].method).toBe("DELETE");
    });

    it("无保护规则时应返回 null", async () => {
      fetchSpy.mockResolvedValue(mockResponse("Not Found", 404));
      const result = await adapter.unlockBranch("owner", "repo", "main");
      expect(result).toBeNull();
    });
  });

  // ============ Pull Request ============

  describe("getPullRequest", () => {
    it("应正确映射 GitHub PR 响应", async () => {
      const ghPR = {
        id: 1,
        number: 42,
        title: "Fix bug",
        body: "desc",
        state: "open",
        head: {
          ref: "feature",
          sha: "abc",
          repo: { id: 1, name: "r", full_name: "o/r", owner: { id: 1, login: "o" } },
        },
        base: {
          ref: "main",
          sha: "def",
          repo: { id: 1, name: "r", full_name: "o/r", owner: { id: 1, login: "o" } },
        },
        user: { id: 1, login: "author" },
        requested_reviewers: [{ id: 2, login: "reviewer" }],
        requested_teams: [{ id: 10, name: "team-a" }],
        created_at: "2025-01-01",
        merge_commit_sha: "merge123",
      };
      fetchSpy.mockResolvedValue(mockResponse(ghPR));
      const result = await adapter.getPullRequest("owner", "repo", 42);
      expect(result.number).toBe(42);
      expect(result.title).toBe("Fix bug");
      expect(result.head?.ref).toBe("feature");
      expect(result.user?.login).toBe("author");
      expect(result.requested_reviewers?.[0]?.login).toBe("reviewer");
      expect(result.requested_reviewers_teams?.[0]?.name).toBe("team-a");
      expect(result.merge_base).toBe("merge123");
    });
  });

  describe("listAllPullRequests", () => {
    it("应支持分页获取全部", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i, number: i }));
      const page2 = [{ id: 100, number: 100 }];
      fetchSpy
        .mockResolvedValueOnce(mockResponse(page1))
        .mockResolvedValueOnce(mockResponse(page2));
      const result = await adapter.listAllPullRequests("o", "r", { state: "all" });
      expect(result).toHaveLength(101);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("getPullRequestFiles", () => {
    it("应正确映射文件变更", async () => {
      const ghFiles = [
        { filename: "a.ts", status: "modified", additions: 5, deletions: 2, patch: "@@ ..." },
      ];
      fetchSpy.mockResolvedValue(mockResponse(ghFiles));
      const result = await adapter.getPullRequestFiles("o", "r", 1);
      expect(result[0].filename).toBe("a.ts");
      expect(result[0].additions).toBe(5);
      expect(result[0].patch).toBe("@@ ...");
    });

    it("应支持分页获取全部文件", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ filename: `f${i}.ts` }));
      const page2 = [{ filename: "f100.ts" }];
      fetchSpy
        .mockResolvedValueOnce(mockResponse(page1))
        .mockResolvedValueOnce(mockResponse(page2));
      const result = await adapter.getPullRequestFiles("o", "r", 1);
      expect(result).toHaveLength(101);
    });
  });

  // ============ Commit ============

  describe("getCommit", () => {
    it("应正确映射 commit 和 files", async () => {
      const ghCommit = {
        sha: "abc123",
        commit: { message: "fix", author: { name: "A", email: "a@b.c", date: "2025-01-01" } },
        author: { id: 1, login: "a" },
        files: [{ filename: "x.ts", status: "modified", additions: 1 }],
      };
      fetchSpy.mockResolvedValue(mockResponse(ghCommit));
      const result = await adapter.getCommit("o", "r", "abc123");
      expect(result.sha).toBe("abc123");
      expect(result.commit?.message).toBe("fix");
      expect(result.files).toHaveLength(1);
      expect(result.files?.[0].filename).toBe("x.ts");
    });
  });

  // ============ 文件操作 ============

  describe("getFileContent", () => {
    it("应解码 base64 内容", async () => {
      const content = Buffer.from("hello world").toString("base64");
      fetchSpy.mockResolvedValue(mockResponse({ content, encoding: "base64" }));
      const result = await adapter.getFileContent("o", "r", "a.ts");
      expect(result).toBe("hello world");
    });

    it("404 时应返回空字符串", async () => {
      fetchSpy.mockResolvedValue(mockResponse("Not Found", 404));
      const result = await adapter.getFileContent("o", "r", "missing.ts");
      expect(result).toBe("");
    });

    it("指定 ref 时应添加 query 参数", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ content: "", encoding: "base64" }));
      await adapter.getFileContent("o", "r", "a.ts", "dev");
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("?ref=dev"), expect.anything());
    });
  });

  // ============ Issue 操作 ============

  describe("createIssue", () => {
    it("应正确映射 issue 响应", async () => {
      const ghIssue = {
        id: 1,
        number: 10,
        title: "Bug",
        state: "open",
        user: { id: 1, login: "u" },
        html_url: "https://github.com/o/r/issues/10",
      };
      fetchSpy.mockResolvedValue(mockResponse(ghIssue));
      const result = await adapter.createIssue("o", "r", { title: "Bug" });
      expect(result.number).toBe(10);
      expect(result.html_url).toBe("https://github.com/o/r/issues/10");
    });
  });

  // ============ PR Review ============

  describe("createPullReview", () => {
    it("应正确映射 review 选项", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ id: 1 }));
      await adapter.createPullReview("o", "r", 1, {
        event: "COMMENT",
        body: "LGTM",
        comments: [{ path: "a.ts", body: "fix", new_position: 10 }],
      });
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.event).toBe("COMMENT");
      expect(body.comments[0].position).toBe(10);
      expect(body.comments[0].path).toBe("a.ts");
    });
  });

  describe("listPullReviews", () => {
    it("应正确映射 review 响应", async () => {
      const ghReviews = [
        {
          id: 1,
          body: "ok",
          state: "APPROVED",
          user: { id: 1, login: "r" },
          submitted_at: "2025-01-01",
        },
      ];
      fetchSpy.mockResolvedValue(mockResponse(ghReviews));
      const result = await adapter.listPullReviews("o", "r", 1);
      expect(result[0].state).toBe("APPROVED");
      expect(result[0].created_at).toBe("2025-01-01");
    });
  });

  // ============ 用户操作 ============

  describe("searchUsers", () => {
    it("应请求 /search/users 并解构 items 字段", async () => {
      fetchSpy.mockResolvedValue(mockResponse({ items: [{ id: 1, login: "u", name: "User" }] }));
      const result = await adapter.searchUsers("u", 5);
      expect(result).toHaveLength(1);
      expect(result[0].login).toBe("u");
      expect(result[0].full_name).toBe("User");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/search/users?q=u&per_page=5"),
        expect.anything(),
      );
    });
  });
});
