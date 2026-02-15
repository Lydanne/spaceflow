import { vi } from "vitest";
import { GitProviderService } from "./git-provider.service";
import type { GitProviderModuleOptions } from "./types";
import { GiteaAdapter } from "./adapters/gitea.adapter";
import { GithubAdapter } from "./adapters/github.adapter";
import { GitlabAdapter } from "./adapters/gitlab.adapter";

/** 直接实例化 service（绕过 NestJS DI） */
function createService(options: GitProviderModuleOptions): GitProviderService {
  return new (GitProviderService as any)(options);
}

describe("GitProviderService", () => {
  describe("createAdapter", () => {
    it("provider=gitea 时应创建 GiteaAdapter", () => {
      const service = createService({ provider: "gitea", baseUrl: "https://g.com", token: "t" });
      expect((service as any).adapter).toBeInstanceOf(GiteaAdapter);
    });

    it("provider=github 时应创建 GithubAdapter", () => {
      const service = createService({
        provider: "github",
        baseUrl: "https://api.github.com",
        token: "t",
      });
      expect((service as any).adapter).toBeInstanceOf(GithubAdapter);
    });

    it("provider=gitlab 时应创建 GitlabAdapter", () => {
      const service = createService({
        provider: "gitlab",
        baseUrl: "https://gitlab.com",
        token: "t",
      });
      expect((service as any).adapter).toBeInstanceOf(GitlabAdapter);
    });

    it("不支持的 provider 应抛出异常", () => {
      expect(() =>
        createService({ provider: "bitbucket" as any, baseUrl: "x", token: "t" }),
      ).toThrow("不支持的 Git Provider 类型: bitbucket");
    });
  });

  describe("代理方法", () => {
    let service: GitProviderService;
    let mockAdapter: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      service = createService({ provider: "gitea", baseUrl: "https://g.com", token: "t" });
      mockAdapter = {
        validateConfig: vi.fn(),
        getRepository: vi.fn().mockResolvedValue({ id: 1 }),
        getBranch: vi.fn().mockResolvedValue({ name: "main" }),
        listBranchProtections: vi.fn().mockResolvedValue([]),
        getBranchProtection: vi.fn().mockResolvedValue({}),
        createBranchProtection: vi.fn().mockResolvedValue({}),
        editBranchProtection: vi.fn().mockResolvedValue({}),
        deleteBranchProtection: vi.fn().mockResolvedValue(undefined),
        lockBranch: vi.fn().mockResolvedValue({}),
        unlockBranch: vi.fn().mockResolvedValue(null),
        unlockBranchSync: vi.fn(),
        getPullRequest: vi.fn().mockResolvedValue({ id: 1 }),
        editPullRequest: vi.fn().mockResolvedValue({}),
        listPullRequests: vi.fn().mockResolvedValue([]),
        listAllPullRequests: vi.fn().mockResolvedValue([]),
        getPullRequestCommits: vi.fn().mockResolvedValue([]),
        getPullRequestFiles: vi.fn().mockResolvedValue([]),
        getPullRequestDiff: vi.fn().mockResolvedValue("diff"),
        getCommit: vi.fn().mockResolvedValue({}),
        getCompareDiff: vi.fn().mockResolvedValue("diff"),
        getCommitDiff: vi.fn().mockResolvedValue("diff"),
        getFileContent: vi.fn().mockResolvedValue("content"),
        createIssue: vi.fn().mockResolvedValue({}),
        listIssueComments: vi.fn().mockResolvedValue([]),
        createIssueComment: vi.fn().mockResolvedValue({}),
        updateIssueComment: vi.fn().mockResolvedValue({}),
        deleteIssueComment: vi.fn().mockResolvedValue(undefined),
        createPullReview: vi.fn().mockResolvedValue({}),
        listPullReviews: vi.fn().mockResolvedValue([]),
        deletePullReview: vi.fn().mockResolvedValue(undefined),
        listPullReviewComments: vi.fn().mockResolvedValue([]),
        getIssueCommentReactions: vi.fn().mockResolvedValue([]),
        getIssueReactions: vi.fn().mockResolvedValue([]),
        searchUsers: vi.fn().mockResolvedValue([]),
        getTeamMembers: vi.fn().mockResolvedValue([]),
      };
      (service as any).adapter = mockAdapter;
    });

    it("validateConfig 应代理到 adapter", () => {
      service.validateConfig();
      expect(mockAdapter.validateConfig).toHaveBeenCalled();
    });

    it("getRepository 应代理到 adapter", async () => {
      const result = await service.getRepository("o", "r");
      expect(mockAdapter.getRepository).toHaveBeenCalledWith("o", "r");
      expect(result).toEqual({ id: 1 });
    });

    it("getPullRequest 应代理到 adapter", async () => {
      await service.getPullRequest("o", "r", 42);
      expect(mockAdapter.getPullRequest).toHaveBeenCalledWith("o", "r", 42);
    });

    it("lockBranch 应代理到 adapter", async () => {
      await service.lockBranch("o", "r", "main", { pushWhitelistUsernames: ["bot"] });
      expect(mockAdapter.lockBranch).toHaveBeenCalledWith("o", "r", "main", {
        pushWhitelistUsernames: ["bot"],
      });
    });

    it("unlockBranchSync 应代理到 adapter", () => {
      service.unlockBranchSync("o", "r", "main");
      expect(mockAdapter.unlockBranchSync).toHaveBeenCalledWith("o", "r", "main");
    });

    it("createPullReview 应代理到 adapter", async () => {
      const opts = { event: "COMMENT" as const, body: "ok" };
      await service.createPullReview("o", "r", 1, opts);
      expect(mockAdapter.createPullReview).toHaveBeenCalledWith("o", "r", 1, opts);
    });

    it("getFileContent 应代理到 adapter", async () => {
      const result = await service.getFileContent("o", "r", "a.ts", "main");
      expect(mockAdapter.getFileContent).toHaveBeenCalledWith("o", "r", "a.ts", "main");
      expect(result).toBe("content");
    });

    it("searchUsers 应代理到 adapter", async () => {
      await service.searchUsers("test", 5);
      expect(mockAdapter.searchUsers).toHaveBeenCalledWith("test", 5);
    });

    it("getTeamMembers 应代理到 adapter", async () => {
      await service.getTeamMembers(99);
      expect(mockAdapter.getTeamMembers).toHaveBeenCalledWith(99);
    });

    it("getBranch 应代理到 adapter", async () => {
      await service.getBranch("o", "r", "main");
      expect(mockAdapter.getBranch).toHaveBeenCalledWith("o", "r", "main");
    });

    it("listBranchProtections 应代理到 adapter", async () => {
      await service.listBranchProtections("o", "r");
      expect(mockAdapter.listBranchProtections).toHaveBeenCalledWith("o", "r");
    });

    it("getBranchProtection 应代理到 adapter", async () => {
      await service.getBranchProtection("o", "r", "main");
      expect(mockAdapter.getBranchProtection).toHaveBeenCalledWith("o", "r", "main");
    });

    it("createBranchProtection 应代理到 adapter", async () => {
      const opts = { branchName: "main" };
      await service.createBranchProtection("o", "r", opts as any);
      expect(mockAdapter.createBranchProtection).toHaveBeenCalledWith("o", "r", opts);
    });

    it("editBranchProtection 应代理到 adapter", async () => {
      const opts = { enablePush: true };
      await service.editBranchProtection("o", "r", "main", opts as any);
      expect(mockAdapter.editBranchProtection).toHaveBeenCalledWith("o", "r", "main", opts);
    });

    it("deleteBranchProtection 应代理到 adapter", async () => {
      await service.deleteBranchProtection("o", "r", "main");
      expect(mockAdapter.deleteBranchProtection).toHaveBeenCalledWith("o", "r", "main");
    });

    it("unlockBranch 应代理到 adapter", async () => {
      await service.unlockBranch("o", "r", "main");
      expect(mockAdapter.unlockBranch).toHaveBeenCalledWith("o", "r", "main");
    });

    it("editPullRequest 应代理到 adapter", async () => {
      const opts = { title: "new" };
      await service.editPullRequest("o", "r", 1, opts as any);
      expect(mockAdapter.editPullRequest).toHaveBeenCalledWith("o", "r", 1, opts);
    });

    it("listPullRequests 应代理到 adapter", async () => {
      await service.listPullRequests("o", "r", "open");
      expect(mockAdapter.listPullRequests).toHaveBeenCalledWith("o", "r", "open");
    });

    it("listAllPullRequests 应代理到 adapter", async () => {
      await service.listAllPullRequests("o", "r", { state: "open" } as any);
      expect(mockAdapter.listAllPullRequests).toHaveBeenCalledWith("o", "r", { state: "open" });
    });

    it("getPullRequestCommits 应代理到 adapter", async () => {
      await service.getPullRequestCommits("o", "r", 1);
      expect(mockAdapter.getPullRequestCommits).toHaveBeenCalledWith("o", "r", 1);
    });

    it("getPullRequestFiles 应代理到 adapter", async () => {
      await service.getPullRequestFiles("o", "r", 1);
      expect(mockAdapter.getPullRequestFiles).toHaveBeenCalledWith("o", "r", 1);
    });

    it("getPullRequestDiff 应代理到 adapter", async () => {
      await service.getPullRequestDiff("o", "r", 1);
      expect(mockAdapter.getPullRequestDiff).toHaveBeenCalledWith("o", "r", 1);
    });

    it("getCommit 应代理到 adapter", async () => {
      await service.getCommit("o", "r", "abc");
      expect(mockAdapter.getCommit).toHaveBeenCalledWith("o", "r", "abc");
    });

    it("getCompareDiff 应代理到 adapter", async () => {
      await service.getCompareDiff("o", "r", "a", "b");
      expect(mockAdapter.getCompareDiff).toHaveBeenCalledWith("o", "r", "a", "b");
    });

    it("getCommitDiff 应代理到 adapter", async () => {
      await service.getCommitDiff("o", "r", "abc");
      expect(mockAdapter.getCommitDiff).toHaveBeenCalledWith("o", "r", "abc");
    });

    it("listRepositoryContents 应代理到 adapter", async () => {
      mockAdapter.listRepositoryContents = vi.fn().mockResolvedValue([]);
      await service.listRepositoryContents("o", "r", "src", "main");
      expect(mockAdapter.listRepositoryContents).toHaveBeenCalledWith("o", "r", "src", "main");
    });

    it("createIssue 应代理到 adapter", async () => {
      const opts = { title: "bug" };
      await service.createIssue("o", "r", opts as any);
      expect(mockAdapter.createIssue).toHaveBeenCalledWith("o", "r", opts);
    });

    it("listIssueComments 应代理到 adapter", async () => {
      await service.listIssueComments("o", "r", 1);
      expect(mockAdapter.listIssueComments).toHaveBeenCalledWith("o", "r", 1);
    });

    it("createIssueComment 应代理到 adapter", async () => {
      const opts = { body: "comment" };
      await service.createIssueComment("o", "r", 1, opts as any);
      expect(mockAdapter.createIssueComment).toHaveBeenCalledWith("o", "r", 1, opts);
    });

    it("updateIssueComment 应代理到 adapter", async () => {
      await service.updateIssueComment("o", "r", 1, "updated");
      expect(mockAdapter.updateIssueComment).toHaveBeenCalledWith("o", "r", 1, "updated");
    });

    it("deleteIssueComment 应代理到 adapter", async () => {
      await service.deleteIssueComment("o", "r", 1);
      expect(mockAdapter.deleteIssueComment).toHaveBeenCalledWith("o", "r", 1);
    });

    it("listPullReviews 应代理到 adapter", async () => {
      await service.listPullReviews("o", "r", 1);
      expect(mockAdapter.listPullReviews).toHaveBeenCalledWith("o", "r", 1);
    });

    it("deletePullReview 应代理到 adapter", async () => {
      await service.deletePullReview("o", "r", 1, 2);
      expect(mockAdapter.deletePullReview).toHaveBeenCalledWith("o", "r", 1, 2);
    });

    it("listPullReviewComments 应代理到 adapter", async () => {
      await service.listPullReviewComments("o", "r", 1, 2);
      expect(mockAdapter.listPullReviewComments).toHaveBeenCalledWith("o", "r", 1, 2);
    });

    it("getIssueCommentReactions 应代理到 adapter", async () => {
      await service.getIssueCommentReactions("o", "r", 1);
      expect(mockAdapter.getIssueCommentReactions).toHaveBeenCalledWith("o", "r", 1);
    });

    it("getIssueReactions 应代理到 adapter", async () => {
      await service.getIssueReactions("o", "r", 1);
      expect(mockAdapter.getIssueReactions).toHaveBeenCalledWith("o", "r", 1);
    });
  });
});
