import { execSync } from "child_process";
import type {
  GitProvider,
  LockBranchOptions,
  ListPullRequestsOptions,
} from "../git-provider.interface";
import type {
  GitProviderModuleOptions,
  BranchProtection,
  CreateBranchProtectionOption,
  EditBranchProtectionOption,
  Branch,
  Repository,
  PullRequest,
  PullRequestCommit,
  ChangedFile,
  CommitInfo,
  IssueComment,
  CreateIssueCommentOption,
  CreateIssueOption,
  Issue,
  CreatePullReviewOption,
  PullReview,
  PullReviewComment,
  Reaction,
  EditPullRequestOption,
  User,
  RepositoryContent,
} from "../types";

/**
 * GitHub 平台适配器
 */
export class GithubAdapter implements GitProvider {
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
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    if (response.status === 204) {
      return {} as T;
    }
    return response.json() as Promise<T>;
  }

  protected async fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.text();
  }

  // ============ 仓库操作 ============

  async getRepository(owner: string, repo: string): Promise<Repository> {
    const result = await this.request<Record<string, unknown>>("GET", `/repos/${owner}/${repo}`);
    return this.mapRepository(result);
  }

  // ============ 分支操作 ============

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    );
    return this.mapBranch(result);
  }

  // ============ 分支保护 ============

  async listBranchProtections(owner: string, repo: string): Promise<BranchProtection[]> {
    try {
      const rules = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/repos/${owner}/${repo}/rules/rulesets`,
      );
      return rules.map((rule) => this.mapRulesetToProtection(rule));
    } catch {
      return [];
    }
  }

  async getBranchProtection(owner: string, repo: string, name: string): Promise<BranchProtection> {
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(name)}/protection`,
    );
    return this.mapGithubProtection(result, name);
  }

  async createBranchProtection(
    owner: string,
    repo: string,
    options: CreateBranchProtectionOption,
  ): Promise<BranchProtection> {
    const branchName = options.branch_name || options.rule_name || "";
    const body = this.buildGithubProtectionBody(options);
    const result = await this.request<Record<string, unknown>>(
      "PUT",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branchName)}/protection`,
      body,
    );
    return this.mapGithubProtection(result, branchName);
  }

  async editBranchProtection(
    owner: string,
    repo: string,
    name: string,
    options: EditBranchProtectionOption,
  ): Promise<BranchProtection> {
    const body = this.buildGithubProtectionBody(options);
    const result = await this.request<Record<string, unknown>>(
      "PUT",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(name)}/protection`,
      body,
    );
    return this.mapGithubProtection(result, name);
  }

  async deleteBranchProtection(owner: string, repo: string, name: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(name)}/protection`,
    );
  }

  async lockBranch(
    owner: string,
    repo: string,
    branch: string,
    options?: LockBranchOptions,
  ): Promise<BranchProtection> {
    const pushWhitelistUsernames = options?.pushWhitelistUsernames;
    const hasWhitelist = pushWhitelistUsernames && pushWhitelistUsernames.length > 0;
    const body: Record<string, unknown> = {
      required_status_checks: null,
      enforce_admins: true,
      required_pull_request_reviews: null,
      restrictions: hasWhitelist
        ? { users: pushWhitelistUsernames, teams: [] }
        : { users: [], teams: [] },
    };
    const result = await this.request<Record<string, unknown>>(
      "PUT",
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
      body,
    );
    return this.mapGithubProtection(result, branch);
  }

  async unlockBranch(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<BranchProtection | null> {
    try {
      const existing = await this.getBranchProtection(owner, repo, branch);
      await this.deleteBranchProtection(owner, repo, branch);
      return existing;
    } catch {
      return null;
    }
  }

  unlockBranchSync(owner: string, repo: string, branch: string): void {
    try {
      execSync(
        `curl -s -X DELETE "${this.baseUrl}/repos/${owner}/${repo}/branches/${branch}/protection" -H "Authorization: Bearer ${this.token}" -H "Accept: application/vnd.github+json"`,
        { encoding: "utf-8" },
      );
      console.log(`✅ 分支已解锁（同步）: ${branch}`);
    } catch (error) {
      console.error("⚠️ 同步解锁分支失败:", error instanceof Error ? error.message : error);
    }
  }

  // ============ Pull Request 操作 ============

  async getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest> {
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/repos/${owner}/${repo}/pulls/${index}`,
    );
    return this.mapPullRequest(result);
  }

  async editPullRequest(
    owner: string,
    repo: string,
    index: number,
    options: EditPullRequestOption,
  ): Promise<PullRequest> {
    const result = await this.request<Record<string, unknown>>(
      "PATCH",
      `/repos/${owner}/${repo}/pulls/${index}`,
      options,
    );
    return this.mapPullRequest(result);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state?: "open" | "closed" | "all",
  ): Promise<PullRequest[]> {
    const query = state ? `?state=${state}` : "";
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/pulls${query}`,
    );
    return results.map((pr) => this.mapPullRequest(pr));
  }

  async listAllPullRequests(
    owner: string,
    repo: string,
    options?: ListPullRequestsOptions,
  ): Promise<PullRequest[]> {
    const allPRs: PullRequest[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (options?.state) params.set("state", options.state);
      if (options?.sort) params.set("sort", this.mapSortParam(options.sort));
      if (options?.labels?.length) params.set("labels", options.labels.join(","));
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/repos/${owner}/${repo}/pulls?${params.toString()}`,
      );
      if (!results || results.length === 0) break;
      allPRs.push(...results.map((pr) => this.mapPullRequest(pr)));
      if (results.length < perPage) break;
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
    const perPage = 100;
    while (true) {
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/repos/${owner}/${repo}/pulls/${index}/commits?page=${page}&per_page=${perPage}`,
      );
      if (!results || results.length === 0) break;
      allCommits.push(...results.map((c) => this.mapCommit(c)));
      if (results.length < perPage) break;
      page++;
    }
    return allCommits;
  }

  async getPullRequestFiles(owner: string, repo: string, index: number): Promise<ChangedFile[]> {
    const allFiles: ChangedFile[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/repos/${owner}/${repo}/pulls/${index}/files?page=${page}&per_page=${perPage}`,
      );
      if (!results || results.length === 0) break;
      allFiles.push(...results.map((f) => this.mapChangedFile(f)));
      if (results.length < perPage) break;
      page++;
    }
    return allFiles;
  }

  async getPullRequestDiff(owner: string, repo: string, index: number): Promise<string> {
    return this.fetchText(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${index}`);
  }

  // ============ Commit 操作 ============

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/repos/${owner}/${repo}/commits/${sha}`,
    );
    const commit = this.mapCommit(result);
    const files = ((result.files as Array<Record<string, unknown>>) || []).map((f) =>
      this.mapChangedFile(f),
    );
    return { ...commit, files };
  }

  async getCompareDiff(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
  ): Promise<string> {
    return this.fetchText(`${this.baseUrl}/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`);
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    return this.fetchText(`${this.baseUrl}/repos/${owner}/${repo}/commits/${sha}`);
  }

  // ============ 文件操作 ============

  async getFileContent(
    owner: string,
    repo: string,
    filepath: string,
    ref?: string,
  ): Promise<string> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    try {
      const result = await this.request<{ content?: string; encoding?: string }>(
        "GET",
        `/repos/${owner}/${repo}/contents/${filepath}${query}`,
      );
      if (result.content && result.encoding === "base64") {
        return Buffer.from(result.content, "base64").toString("utf-8");
      }
      return result.content || "";
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return "";
      }
      throw error;
    }
  }

  async listRepositoryContents(
    owner: string,
    repo: string,
    path = "",
    ref?: string,
  ): Promise<RepositoryContent[]> {
    const encodedPath = path ? `/${path}` : "";
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const result = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/contents${encodedPath}${query}`,
    );
    return result.map((item) => ({
      name: item.name as string,
      path: item.path as string,
      type: (item.type as string) === "dir" ? ("dir" as const) : ("file" as const),
      size: item.size as number,
      download_url: item.download_url as string,
    }));
  }

  // ============ Issue 操作 ============

  async createIssue(owner: string, repo: string, options: CreateIssueOption): Promise<Issue> {
    const body: Record<string, unknown> = {
      title: options.title,
      body: options.body,
      assignees: options.assignees,
      labels: options.labels,
      milestone: options.milestone,
    };
    const result = await this.request<Record<string, unknown>>(
      "POST",
      `/repos/${owner}/${repo}/issues`,
      body,
    );
    return this.mapIssue(result);
  }

  async listIssueComments(owner: string, repo: string, index: number): Promise<IssueComment[]> {
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/issues/${index}/comments`,
    );
    return results.map((c) => this.mapIssueComment(c));
  }

  async createIssueComment(
    owner: string,
    repo: string,
    index: number,
    options: CreateIssueCommentOption,
  ): Promise<IssueComment> {
    const result = await this.request<Record<string, unknown>>(
      "POST",
      `/repos/${owner}/${repo}/issues/${index}/comments`,
      { body: options.body },
    );
    return this.mapIssueComment(result);
  }

  async updateIssueComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ): Promise<IssueComment> {
    const result = await this.request<Record<string, unknown>>(
      "PATCH",
      `/repos/${owner}/${repo}/issues/comments/${commentId}`,
      { body },
    );
    return this.mapIssueComment(result);
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
    const body: Record<string, unknown> = {
      event: this.mapReviewEvent(options.event),
      body: options.body,
      commit_id: options.commit_id,
    };
    if (options.comments?.length) {
      body.comments = options.comments.map((c) => ({
        path: c.path,
        body: c.body,
        position: c.new_position,
      }));
    }
    const result = await this.request<Record<string, unknown>>(
      "POST",
      `/repos/${owner}/${repo}/pulls/${index}/reviews`,
      body,
    );
    return this.mapPullReview(result);
  }

  async listPullReviews(owner: string, repo: string, index: number): Promise<PullReview[]> {
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/pulls/${index}/reviews`,
    );
    return results.map((r) => this.mapPullReview(r));
  }

  async updatePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
    body: string,
  ): Promise<PullReview> {
    const result = await this.request<Record<string, unknown>>(
      "PUT",
      `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}`,
      { body },
    );
    return this.mapPullReview(result);
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
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}/comments`,
    );
    return results.map((c) => this.mapPullReviewComment(c));
  }

  // ============ Reaction 操作 ============

  async getIssueCommentReactions(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<Reaction[]> {
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    );
    return results.map((r) => this.mapReaction(r));
  }

  async getIssueReactions(owner: string, repo: string, index: number): Promise<Reaction[]> {
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/issues/${index}/reactions`,
    );
    return results.map((r) => this.mapReaction(r));
  }

  // ============ 用户操作 ============

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("per_page", String(limit));
    const result = await this.request<{ items: Array<Record<string, unknown>> }>(
      "GET",
      `/search/users?${params.toString()}`,
    );
    return (result.items || []).map((u) => this.mapUser(u));
  }

  async getTeamMembers(teamId: number): Promise<User[]> {
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/teams/${teamId}/members`,
    );
    return results.map((u) => this.mapUser(u));
  }

  // ============ 映射辅助方法 ============

  protected mapRepository(data: Record<string, unknown>): Repository {
    const owner = data.owner as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      owner: owner
        ? {
            id: owner.id as number,
            login: owner.login as string,
            full_name: owner.full_name as string,
          }
        : undefined,
      name: data.name as string,
      full_name: data.full_name as string,
      default_branch: data.default_branch as string,
    };
  }

  protected mapBranch(data: Record<string, unknown>): Branch {
    const commit = data.commit as Record<string, unknown> | undefined;
    const commitObj = commit?.commit as Record<string, unknown> | undefined;
    return {
      name: data.name as string,
      protected: data.protected as boolean,
      commit: commit
        ? {
            id: commit.sha as string,
            message: commitObj?.message as string,
          }
        : undefined,
    };
  }

  protected mapPullRequest(data: Record<string, unknown>): PullRequest {
    const head = data.head as Record<string, unknown> | undefined;
    const base = data.base as Record<string, unknown> | undefined;
    const user = data.user as Record<string, unknown> | undefined;
    const reviewers = data.requested_reviewers as Array<Record<string, unknown>> | undefined;
    const teams = data.requested_teams as Array<Record<string, unknown>> | undefined;
    return {
      id: data.id as number,
      number: data.number as number,
      title: data.title as string,
      body: data.body as string,
      state: data.state as string,
      head: head
        ? {
            ref: head.ref as string,
            sha: head.sha as string,
            repo: head.repo ? this.mapRepository(head.repo as Record<string, unknown>) : undefined,
          }
        : undefined,
      base: base
        ? {
            ref: base.ref as string,
            sha: base.sha as string,
            repo: base.repo ? this.mapRepository(base.repo as Record<string, unknown>) : undefined,
          }
        : undefined,
      user: user ? { id: user.id as number, login: user.login as string } : undefined,
      requested_reviewers: reviewers?.map((r) => ({
        id: r.id as number,
        login: r.login as string,
      })),
      requested_reviewers_teams: teams?.map((t) => ({
        id: t.id as number,
        name: t.name as string,
      })),
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      merged_at: data.merged_at as string,
      merge_base: data.merge_commit_sha as string,
    };
  }

  protected mapCommit(data: Record<string, unknown>): PullRequestCommit {
    const commit = data.commit as Record<string, unknown> | undefined;
    const author = commit?.author as Record<string, unknown> | undefined;
    const ghAuthor = data.author as Record<string, unknown> | undefined;
    const ghCommitter = data.committer as Record<string, unknown> | undefined;
    return {
      sha: data.sha as string,
      commit: commit
        ? {
            message: commit.message as string,
            author: author
              ? {
                  name: author.name as string,
                  email: author.email as string,
                  date: author.date as string,
                }
              : undefined,
          }
        : undefined,
      author: ghAuthor ? { id: ghAuthor.id as number, login: ghAuthor.login as string } : undefined,
      committer: ghCommitter
        ? { id: ghCommitter.id as number, login: ghCommitter.login as string }
        : undefined,
    };
  }

  protected mapChangedFile(data: Record<string, unknown>): ChangedFile {
    return {
      filename: data.filename as string,
      status: data.status as string,
      additions: data.additions as number,
      deletions: data.deletions as number,
      changes: data.changes as number,
      patch: data.patch as string,
      raw_url: data.raw_url as string,
      contents_url: data.contents_url as string,
    };
  }

  protected mapIssueComment(data: Record<string, unknown>): IssueComment {
    const user = data.user as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      body: data.body as string,
      user: user ? { id: user.id as number, login: user.login as string } : undefined,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
    };
  }

  protected mapIssue(data: Record<string, unknown>): Issue {
    const user = data.user as Record<string, unknown> | undefined;
    const labels = data.labels as Array<Record<string, unknown>> | undefined;
    const assignees = data.assignees as Array<Record<string, unknown>> | undefined;
    const milestone = data.milestone as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      number: data.number as number,
      title: data.title as string,
      body: data.body as string,
      state: data.state as string,
      user: user ? { id: user.id as number, login: user.login as string } : undefined,
      labels: labels?.map((l) => ({
        id: l.id as number,
        name: l.name as string,
        color: l.color as string,
      })),
      assignees: assignees?.map((a) => ({ id: a.id as number, login: a.login as string })),
      milestone: milestone
        ? { id: milestone.id as number, title: milestone.title as string }
        : undefined,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      closed_at: data.closed_at as string,
      html_url: data.html_url as string,
    };
  }

  protected mapPullReview(data: Record<string, unknown>): PullReview {
    const user = data.user as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      body: data.body as string,
      state: data.state as string,
      user: user ? { id: user.id as number, login: user.login as string } : undefined,
      created_at: data.submitted_at as string,
      updated_at: data.submitted_at as string,
      commit_id: data.commit_id as string,
    };
  }

  protected mapPullReviewComment(data: Record<string, unknown>): PullReviewComment {
    const user = data.user as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      body: data.body as string,
      path: data.path as string,
      position: data.position as number,
      original_position: data.original_position as number,
      commit_id: data.commit_id as string,
      original_commit_id: data.original_commit_id as string,
      diff_hunk: data.diff_hunk as string,
      pull_request_review_id: data.pull_request_review_id as number,
      user: user ? { id: user.id as number, login: user.login as string } : undefined,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      html_url: data.html_url as string,
    };
  }

  protected mapReaction(data: Record<string, unknown>): Reaction {
    const user = data.user as Record<string, unknown> | undefined;
    return {
      user: user ? { id: user.id as number, login: user.login as string } : undefined,
      content: data.content as string,
      created_at: data.created_at as string,
    };
  }

  protected mapUser(data: Record<string, unknown>): User {
    return {
      id: data.id as number,
      login: data.login as string,
      full_name: data.name as string,
      email: data.email as string,
      avatar_url: data.avatar_url as string,
    };
  }

  protected mapGithubProtection(
    data: Record<string, unknown>,
    branchName: string,
  ): BranchProtection {
    const requiredReviews = data.required_pull_request_reviews as
      | Record<string, unknown>
      | undefined;
    return {
      branch_name: branchName,
      rule_name: branchName,
      required_approvals: requiredReviews?.required_approving_review_count as number,
      dismiss_stale_approvals: requiredReviews?.dismiss_stale_reviews as boolean,
      enable_push: true,
    };
  }

  protected mapRulesetToProtection(data: Record<string, unknown>): BranchProtection {
    return {
      rule_name: data.name as string,
      branch_name: data.name as string,
    };
  }

  protected buildGithubProtectionBody(
    options: CreateBranchProtectionOption | EditBranchProtectionOption,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      required_status_checks: options.enable_status_check
        ? { strict: true, contexts: options.status_check_contexts || [] }
        : null,
      enforce_admins: options.block_admin_merge_override ?? false,
      required_pull_request_reviews: options.required_approvals
        ? {
            required_approving_review_count: options.required_approvals,
            dismiss_stale_reviews: options.dismiss_stale_approvals ?? false,
          }
        : null,
      restrictions: options.enable_push_whitelist
        ? {
            users: options.push_whitelist_usernames || [],
            teams: options.push_whitelist_teams || [],
          }
        : null,
    };
    return body;
  }

  protected mapReviewEvent(event?: string): string {
    const eventMap: Record<string, string> = {
      APPROVE: "APPROVE",
      REQUEST_CHANGES: "REQUEST_CHANGES",
      COMMENT: "COMMENT",
      PENDING: "PENDING",
    };
    return event ? eventMap[event] || event : "COMMENT";
  }

  protected mapSortParam(sort: string): string {
    const sortMap: Record<string, string> = {
      oldest: "created",
      recentupdate: "updated",
      leastupdate: "updated",
      mostcomment: "comments",
      leastcomment: "comments",
    };
    return sortMap[sort] || "created";
  }
}
