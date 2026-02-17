import type {
  GitProvider,
  LockBranchOptions,
  ListPullRequestsOptions,
} from "./git-provider.interface";
import {
  type GitProviderModuleOptions,
  type BranchProtection,
  type CreateBranchProtectionOption,
  type EditBranchProtectionOption,
  type Branch,
  type Repository,
  type PullRequest,
  type PullRequestCommit,
  type ChangedFile,
  type CommitInfo,
  type IssueComment,
  type CreateIssueCommentOption,
  type CreateIssueOption,
  type Issue,
  type CreatePullReviewOption,
  type PullReview,
  type PullReviewComment,
  type Reaction,
  type EditPullRequestOption,
  type User,
  type RepositoryContent,
} from "./types";
import { GiteaAdapter } from "./adapters/gitea.adapter";
import { GithubAdapter } from "./adapters/github.adapter";
import { GitlabAdapter } from "./adapters/gitlab.adapter";

/**
 * Git Provider 统一服务
 * 根据配置的 provider 类型代理到对应的适配器实现
 */
export class GitProviderService implements GitProvider {
  protected readonly adapter: GitProvider;

  constructor(protected readonly options: GitProviderModuleOptions) {
    this.adapter = this.createAdapter(options);
  }

  /**
   * 根据 provider 类型创建对应的适配器
   */
  protected createAdapter(options: GitProviderModuleOptions): GitProvider {
    switch (options.provider) {
      case "gitea":
        return new GiteaAdapter(options);
      case "github":
        return new GithubAdapter(options);
      case "gitlab":
        return new GitlabAdapter(options);
      default:
        throw new Error(`不支持的 Git Provider 类型: ${options.provider}`);
    }
  }

  // ============ 配置验证 ============

  validateConfig(): void {
    this.adapter.validateConfig();
  }

  // ============ 仓库操作 ============

  async getRepository(owner: string, repo: string): Promise<Repository> {
    return this.adapter.getRepository(owner, repo);
  }

  // ============ 分支操作 ============

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    return this.adapter.getBranch(owner, repo, branch);
  }

  // ============ 分支保护 ============

  async listBranchProtections(owner: string, repo: string): Promise<BranchProtection[]> {
    return this.adapter.listBranchProtections(owner, repo);
  }

  async getBranchProtection(owner: string, repo: string, name: string): Promise<BranchProtection> {
    return this.adapter.getBranchProtection(owner, repo, name);
  }

  async createBranchProtection(
    owner: string,
    repo: string,
    options: CreateBranchProtectionOption,
  ): Promise<BranchProtection> {
    return this.adapter.createBranchProtection(owner, repo, options);
  }

  async editBranchProtection(
    owner: string,
    repo: string,
    name: string,
    options: EditBranchProtectionOption,
  ): Promise<BranchProtection> {
    return this.adapter.editBranchProtection(owner, repo, name, options);
  }

  async deleteBranchProtection(owner: string, repo: string, name: string): Promise<void> {
    return this.adapter.deleteBranchProtection(owner, repo, name);
  }

  async lockBranch(
    owner: string,
    repo: string,
    branch: string,
    options?: LockBranchOptions,
  ): Promise<BranchProtection> {
    return this.adapter.lockBranch(owner, repo, branch, options);
  }

  async unlockBranch(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<BranchProtection | null> {
    return this.adapter.unlockBranch(owner, repo, branch);
  }

  unlockBranchSync(owner: string, repo: string, branch: string): void {
    this.adapter.unlockBranchSync(owner, repo, branch);
  }

  // ============ Pull Request 操作 ============

  async getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest> {
    return this.adapter.getPullRequest(owner, repo, index);
  }

  async editPullRequest(
    owner: string,
    repo: string,
    index: number,
    options: EditPullRequestOption,
  ): Promise<PullRequest> {
    return this.adapter.editPullRequest(owner, repo, index, options);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state?: "open" | "closed" | "all",
  ): Promise<PullRequest[]> {
    return this.adapter.listPullRequests(owner, repo, state);
  }

  async listAllPullRequests(
    owner: string,
    repo: string,
    options?: ListPullRequestsOptions,
  ): Promise<PullRequest[]> {
    return this.adapter.listAllPullRequests(owner, repo, options);
  }

  async getPullRequestCommits(
    owner: string,
    repo: string,
    index: number,
  ): Promise<PullRequestCommit[]> {
    return this.adapter.getPullRequestCommits(owner, repo, index);
  }

  async getPullRequestFiles(owner: string, repo: string, index: number): Promise<ChangedFile[]> {
    return this.adapter.getPullRequestFiles(owner, repo, index);
  }

  async getPullRequestDiff(owner: string, repo: string, index: number): Promise<string> {
    return this.adapter.getPullRequestDiff(owner, repo, index);
  }

  // ============ Commit 操作 ============

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    return this.adapter.getCommit(owner, repo, sha);
  }

  async getCompareDiff(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
  ): Promise<string> {
    return this.adapter.getCompareDiff(owner, repo, baseSha, headSha);
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    return this.adapter.getCommitDiff(owner, repo, sha);
  }

  // ============ 文件操作 ============

  async getFileContent(
    owner: string,
    repo: string,
    filepath: string,
    ref?: string,
  ): Promise<string> {
    return this.adapter.getFileContent(owner, repo, filepath, ref);
  }

  async listRepositoryContents(
    owner: string,
    repo: string,
    path?: string,
    ref?: string,
  ): Promise<RepositoryContent[]> {
    return this.adapter.listRepositoryContents(owner, repo, path, ref);
  }

  // ============ Issue 操作 ============

  async createIssue(owner: string, repo: string, options: CreateIssueOption): Promise<Issue> {
    return this.adapter.createIssue(owner, repo, options);
  }

  async listIssueComments(owner: string, repo: string, index: number): Promise<IssueComment[]> {
    return this.adapter.listIssueComments(owner, repo, index);
  }

  async createIssueComment(
    owner: string,
    repo: string,
    index: number,
    options: CreateIssueCommentOption,
  ): Promise<IssueComment> {
    return this.adapter.createIssueComment(owner, repo, index, options);
  }

  async updateIssueComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ): Promise<IssueComment> {
    return this.adapter.updateIssueComment(owner, repo, commentId, body);
  }

  async deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void> {
    return this.adapter.deleteIssueComment(owner, repo, commentId);
  }

  // ============ PR Review 操作 ============

  async createPullReview(
    owner: string,
    repo: string,
    index: number,
    options: CreatePullReviewOption,
  ): Promise<PullReview> {
    return this.adapter.createPullReview(owner, repo, index, options);
  }

  async listPullReviews(owner: string, repo: string, index: number): Promise<PullReview[]> {
    return this.adapter.listPullReviews(owner, repo, index);
  }

  async updatePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
    body: string,
  ): Promise<PullReview> {
    return this.adapter.updatePullReview(owner, repo, index, reviewId, body);
  }

  async deletePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
  ): Promise<void> {
    return this.adapter.deletePullReview(owner, repo, index, reviewId);
  }

  async listPullReviewComments(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
  ): Promise<PullReviewComment[]> {
    return this.adapter.listPullReviewComments(owner, repo, index, reviewId);
  }

  // ============ Reaction 操作 ============

  async getIssueCommentReactions(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<Reaction[]> {
    return this.adapter.getIssueCommentReactions(owner, repo, commentId);
  }

  async getIssueReactions(owner: string, repo: string, index: number): Promise<Reaction[]> {
    return this.adapter.getIssueReactions(owner, repo, index);
  }

  // ============ 用户操作 ============

  async searchUsers(query: string, limit?: number): Promise<User[]> {
    return this.adapter.searchUsers(query, limit);
  }

  async getTeamMembers(teamId: number): Promise<User[]> {
    return this.adapter.getTeamMembers(teamId);
  }
}
