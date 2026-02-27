import { execSync } from "child_process";
import { parseDiffText } from "../../git-sdk/git-sdk-diff.utils";
import type {
  GitProvider,
  LockBranchOptions,
  ListPullRequestsOptions,
} from "../git-provider.interface";
import {
  REVIEW_STATE,
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
  type ResolvedThread,
} from "../types";

/**
 * Gitea 平台适配器
 */
export class GiteaAdapter implements GitProvider {
  protected readonly baseUrl: string;
  protected readonly token: string;

  constructor(protected readonly options: GitProviderModuleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
  }

  validateConfig(): void {
    if (!this.options?.baseUrl) {
      throw new Error("缺少配置 gitProvider.baseUrl (环境变量 GIT_PROVIDER_URL)");
    }
    if (!this.options?.token) {
      throw new Error("缺少配置 gitProvider.token (环境变量 GIT_PROVIDER_TOKEN)");
    }
  }

  protected async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `token ${this.token}`,
      "Content-Type": "application/json",
    };
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gitea API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    if (response.status === 204) {
      return {} as T;
    }
    return response.json() as Promise<T>;
  }

  protected async fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { Authorization: `token ${this.token}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gitea API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.text();
  }

  // ============ 仓库操作 ============

  async getRepository(owner: string, repo: string): Promise<Repository> {
    return this.request<Repository>("GET", `/repos/${owner}/${repo}`);
  }

  // ============ 分支操作 ============

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    return this.request<Branch>(
      "GET",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    );
  }

  // ============ 分支保护 ============

  async listBranchProtections(owner: string, repo: string): Promise<BranchProtection[]> {
    return this.request<BranchProtection[]>("GET", `/repos/${owner}/${repo}/branch_protections`);
  }

  async getBranchProtection(owner: string, repo: string, name: string): Promise<BranchProtection> {
    return this.request<BranchProtection>(
      "GET",
      `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(name)}`,
    );
  }

  async createBranchProtection(
    owner: string,
    repo: string,
    options: CreateBranchProtectionOption,
  ): Promise<BranchProtection> {
    return this.request<BranchProtection>(
      "POST",
      `/repos/${owner}/${repo}/branch_protections`,
      options,
    );
  }

  async editBranchProtection(
    owner: string,
    repo: string,
    name: string,
    options: EditBranchProtectionOption,
  ): Promise<BranchProtection> {
    return this.request<BranchProtection>(
      "PATCH",
      `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(name)}`,
      options,
    );
  }

  async deleteBranchProtection(owner: string, repo: string, name: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(name)}`,
    );
  }

  async lockBranch(
    owner: string,
    repo: string,
    branch: string,
    options?: LockBranchOptions,
  ): Promise<BranchProtection> {
    const protections = await this.listBranchProtections(owner, repo);
    const existing = protections.find((p) => p.rule_name === branch || p.branch_name === branch);
    const pushWhitelistUsernames = options?.pushWhitelistUsernames;
    const hasWhitelist = pushWhitelistUsernames && pushWhitelistUsernames.length > 0;
    const protectionOptions = hasWhitelist
      ? {
          enable_push: true,
          enable_push_whitelist: true,
          push_whitelist_usernames: pushWhitelistUsernames,
        }
      : { enable_push: false };
    if (existing) {
      return this.editBranchProtection(
        owner,
        repo,
        existing.rule_name || branch,
        protectionOptions,
      );
    } else {
      return this.createBranchProtection(owner, repo, {
        rule_name: branch,
        branch_name: branch,
        ...protectionOptions,
      });
    }
  }

  async unlockBranch(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<BranchProtection | null> {
    const protections = await this.listBranchProtections(owner, repo);
    const existing = protections.find((p) => p.rule_name === branch || p.branch_name === branch);
    if (existing) {
      await this.deleteBranchProtection(owner, repo, existing.rule_name || branch);
      return existing;
    }
    return null;
  }

  unlockBranchSync(owner: string, repo: string, branch: string): void {
    try {
      const listResult = execSync(
        `curl -s -X GET "${this.baseUrl}/api/v1/repos/${owner}/${repo}/branch_protections" -H "Authorization: token ${this.token}"`,
        { encoding: "utf-8" },
      );
      const protections = JSON.parse(listResult) as Array<{
        rule_name?: string;
        branch_name?: string;
      }>;
      const existing = protections.find((p) => p.rule_name === branch || p.branch_name === branch);
      if (existing) {
        const ruleName = existing.rule_name || branch;
        execSync(
          `curl -s -X DELETE "${this.baseUrl}/api/v1/repos/${owner}/${repo}/branch_protections/${ruleName}" -H "Authorization: token ${this.token}"`,
          { encoding: "utf-8" },
        );
        console.log(`✅ 分支已解锁（同步）: ${ruleName}`);
      } else {
        console.log(`✅ 分支本身没有保护规则，无需解锁`);
      }
    } catch (error) {
      console.error("⚠️ 同步解锁分支失败:", error instanceof Error ? error.message : error);
    }
  }

  // ============ Pull Request 操作 ============

  async getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest> {
    return this.request<PullRequest>("GET", `/repos/${owner}/${repo}/pulls/${index}`);
  }

  async editPullRequest(
    owner: string,
    repo: string,
    index: number,
    options: EditPullRequestOption,
  ): Promise<PullRequest> {
    return this.request<PullRequest>("PATCH", `/repos/${owner}/${repo}/pulls/${index}`, options);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state?: "open" | "closed" | "all",
  ): Promise<PullRequest[]> {
    const query = state ? `?state=${state}` : "";
    return this.request<PullRequest[]>("GET", `/repos/${owner}/${repo}/pulls${query}`);
  }

  async listAllPullRequests(
    owner: string,
    repo: string,
    options?: ListPullRequestsOptions,
  ): Promise<PullRequest[]> {
    const allPRs: PullRequest[] = [];
    let page = 1;
    const limit = 50;
    while (true) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (options?.state) params.set("state", options.state);
      if (options?.sort) params.set("sort", options.sort);
      if (options?.milestone) params.set("milestone", String(options.milestone));
      if (options?.labels?.length) params.set("labels", options.labels.join(","));
      const prs = await this.request<PullRequest[]>(
        "GET",
        `/repos/${owner}/${repo}/pulls?${params.toString()}`,
      );
      if (!prs || prs.length === 0) break;
      allPRs.push(...prs);
      if (prs.length < limit) break;
      page++;
    }
    return allPRs;
  }

  async getPullRequestCommits(
    owner: string,
    repo: string,
    index: number,
  ): Promise<PullRequestCommit[]> {
    const allCommits: PullRequestCommit[] = [];
    let page = 1;
    const limit = 50;
    while (true) {
      const commits = await this.request<PullRequestCommit[]>(
        "GET",
        `/repos/${owner}/${repo}/pulls/${index}/commits?page=${page}&limit=${limit}`,
      );
      if (!commits || commits.length === 0) break;
      allCommits.push(...commits);
      if (commits.length < limit) break;
      page++;
    }
    return allCommits;
  }

  async getPullRequestFiles(owner: string, repo: string, index: number): Promise<ChangedFile[]> {
    const files = await this.request<ChangedFile[]>(
      "GET",
      `/repos/${owner}/${repo}/pulls/${index}/files`,
    );
    const needsPatch = files.some((f) => !f.patch && f.status !== "deleted");
    if (!needsPatch) {
      return files;
    }
    try {
      const diffText = await this.getPullRequestDiff(owner, repo, index);
      const diffFiles = parseDiffText(diffText);
      const patchMap = new Map(diffFiles.map((f) => [f.filename, f.patch]));
      for (const file of files) {
        if (!file.patch && file.filename) {
          file.patch = patchMap.get(file.filename);
        }
      }
    } catch (error) {
      console.warn(`警告: 无法获取 PR diff 来填充 patch 字段:`, error);
    }
    return files;
  }

  async getPullRequestDiff(owner: string, repo: string, index: number): Promise<string> {
    return this.fetchText(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${index}.diff`);
  }

  // ============ Commit 操作 ============

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    return this.request<CommitInfo>("GET", `/repos/${owner}/${repo}/git/commits/${sha}`);
  }

  async getCompareDiff(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
  ): Promise<string> {
    return this.fetchText(
      `${this.baseUrl}/api/v1/repos/${owner}/${repo}/compare/${baseSha}...${headSha}.diff`,
    );
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    return this.fetchText(`${this.baseUrl}/api/v1/repos/${owner}/${repo}/git/commits/${sha}.diff`);
  }

  // ============ 文件操作 ============

  async getFileContent(
    owner: string,
    repo: string,
    filepath: string,
    ref?: string,
  ): Promise<string> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const url = `${this.baseUrl}/api/v1/repos/${owner}/${repo}/raw/${encodeURIComponent(filepath)}${query}`;
    const response = await fetch(url, {
      headers: { Authorization: `token ${this.token}` },
    });
    if (!response.ok) {
      if (response.status === 404) {
        return "";
      }
      const errorText = await response.text();
      throw new Error(`Gitea API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.text();
  }

  async listRepositoryContents(
    owner: string,
    repo: string,
    path = "",
    ref?: string,
  ): Promise<RepositoryContent[]> {
    const encodedPath = path ? `/${encodeURIComponent(path)}` : "";
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const result = await this.request<
      Array<{ name: string; path: string; type: string; size: number; download_url?: string }>
    >("GET", `/repos/${owner}/${repo}/contents${encodedPath}${query}`);
    return result.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === "dir" ? ("dir" as const) : ("file" as const),
      size: item.size,
      download_url: item.download_url,
    }));
  }

  // ============ Issue 操作 ============

  async createIssue(owner: string, repo: string, options: CreateIssueOption): Promise<Issue> {
    return this.request<Issue>("POST", `/repos/${owner}/${repo}/issues`, options);
  }

  async listIssueComments(owner: string, repo: string, index: number): Promise<IssueComment[]> {
    return this.request<IssueComment[]>("GET", `/repos/${owner}/${repo}/issues/${index}/comments`);
  }

  async createIssueComment(
    owner: string,
    repo: string,
    index: number,
    options: CreateIssueCommentOption,
  ): Promise<IssueComment> {
    return this.request<IssueComment>(
      "POST",
      `/repos/${owner}/${repo}/issues/${index}/comments`,
      options,
    );
  }

  async updateIssueComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ): Promise<IssueComment> {
    return this.request<IssueComment>(
      "PATCH",
      `/repos/${owner}/${repo}/issues/comments/${commentId}`,
      { body },
    );
  }

  async deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void> {
    await this.request<void>("DELETE", `/repos/${owner}/${repo}/issues/comments/${commentId}`);
  }

  // ============ PR Review 操作 ============

  async createPullReview(
    owner: string,
    repo: string,
    index: number,
    options: CreatePullReviewOption,
  ): Promise<PullReview> {
    return this.request<PullReview>(
      "POST",
      `/repos/${owner}/${repo}/pulls/${index}/reviews`,
      options,
    );
  }

  async listPullReviews(owner: string, repo: string, index: number): Promise<PullReview[]> {
    const allReviews: PullReview[] = [];
    let page = 1;
    const limit = 50;
    while (true) {
      const reviews = await this.request<PullReview[]>(
        "GET",
        `/repos/${owner}/${repo}/pulls/${index}/reviews?page=${page}&limit=${limit}`,
      );
      if (!reviews || reviews.length === 0) break;
      allReviews.push(...reviews);
      if (reviews.length < limit) break;
      page++;
    }
    return allReviews;
  }

  async updatePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
    body: string,
  ): Promise<PullReview> {
    // Gitea 不支持更新 review，使用删除+创建的方式模拟
    await this.deletePullReview(owner, repo, index, reviewId);
    return this.createPullReview(owner, repo, index, {
      event: REVIEW_STATE.COMMENT,
      body,
    });
  }

  async deletePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}`,
    );
  }

  async listPullReviewComments(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
  ): Promise<PullReviewComment[]> {
    return this.request<PullReviewComment[]>(
      "GET",
      `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}/comments`,
    );
  }

  async deletePullReviewComment(owner: string, repo: string, commentId: number): Promise<void> {
    await this.request<void>("DELETE", `/repos/${owner}/${repo}/pulls/comments/${commentId}`);
  }

  async listResolvedThreads(owner: string, repo: string, index: number): Promise<ResolvedThread[]> {
    const result: ResolvedThread[] = [];
    try {
      const reviews = await this.listPullReviews(owner, repo, index);
      for (const review of reviews) {
        if (!review.id) continue;
        const comments = await this.listPullReviewComments(owner, repo, index, review.id);
        for (const comment of comments) {
          if (!comment.resolver) continue;
          result.push({
            path: comment.path,
            line: comment.position,
            resolvedBy: {
              id: comment.resolver.id,
              login: comment.resolver.login,
            },
            body: comment.body,
          });
        }
      }
    } catch {
      // 获取失败时返回空数组，不影响主流程
    }
    return result;
  }

  // ============ Reaction 操作 ============

  async getIssueCommentReactions(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<Reaction[]> {
    return this.request<Reaction[]>(
      "GET",
      `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    );
  }

  async getPullReviewCommentReactions(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<Reaction[]> {
    // Gitea: PR review comment reactions 使用与 issue comment 相同的路径
    return this.request<Reaction[]>(
      "GET",
      `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    );
  }

  async getIssueReactions(owner: string, repo: string, index: number): Promise<Reaction[]> {
    return this.request<Reaction[]>("GET", `/repos/${owner}/${repo}/issues/${index}/reactions`);
  }

  // ============ 用户操作 ============

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", String(limit));
    const result = await this.request<{ data: User[] }>(
      "GET",
      `/users/search?${params.toString()}`,
    );
    return result.data || [];
  }

  async getTeamMembers(teamId: number): Promise<User[]> {
    return this.request<User[]>("GET", `/teams/${teamId}/members`);
  }
}
