import { execFileSync } from "child_process";
import type {
  GitProvider,
  LockBranchOptions,
  ListPullRequestsOptions,
} from "../git-provider.interface";
import {
  REVIEW_STATE,
  DIFF_SIDE,
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
  type WorkflowRun,
} from "../types";

/** GraphQL review thread 节点类型 */
interface GraphQLReviewThread {
  isResolved: boolean;
  resolvedBy?: { login: string; databaseId: number } | null;
  path?: string | null;
  line?: number | null;
  comments: { nodes: Array<{ databaseId: number; body?: string }> };
}

/**
 * GitHub 平台适配器
 */
export class GithubAdapter implements GitProvider {
  protected readonly baseUrl: string;
  protected readonly token: string;
  private readonly branchProtectionBackups = new Map<string, Record<string, unknown> | null>();

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

  protected async requestGraphQL<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const graphqlUrl =
      this.baseUrl.replace(/\/v3\/?$/, "").replace(/\/api\/v3\/?$/, "") + "/graphql";
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub GraphQL error: ${response.status} - ${errorText}`);
    }
    const json = (await response.json()) as { data: T; errors?: unknown[] };
    if (json.errors) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
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

  private branchProtectionKey(owner: string, repo: string, branch: string): string {
    return `${owner}/${repo}:${branch}`;
  }

  private branchProtectionPath(owner: string, repo: string, branch: string): string {
    return `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`;
  }

  private async backupBranchProtection(owner: string, repo: string, branch: string): Promise<void> {
    const key = this.branchProtectionKey(owner, repo, branch);
    if (this.branchProtectionBackups.has(key)) return;

    try {
      const protection = await this.request<Record<string, unknown>>(
        "GET",
        this.branchProtectionPath(owner, repo, branch),
      );
      this.branchProtectionBackups.set(key, protection);
    } catch (error) {
      if (!this.isNotFoundError(error)) throw error;
      this.branchProtectionBackups.set(key, null);
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Error && error.message.includes("GitHub API error: 404");
  }

  private requestSync<T>(method: string, path: string, body?: unknown): T {
    const args = [
      "-fsS",
      "-X",
      method,
      `${this.baseUrl}${path}`,
      "-H",
      `Authorization: Bearer ${this.token}`,
      "-H",
      "Accept: application/vnd.github+json",
      "-H",
      "Content-Type: application/json",
      "-H",
      "X-GitHub-Api-Version: 2022-11-28",
    ];
    if (body) {
      args.push("--data", JSON.stringify(body));
    }
    const output = execFileSync("curl", args, { encoding: "utf-8" });
    return output ? (JSON.parse(output) as T) : ({} as T);
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
    await this.backupBranchProtection(owner, repo, branch);
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
    const key = this.branchProtectionKey(owner, repo, branch);
    if (this.branchProtectionBackups.has(key)) {
      const backup = this.branchProtectionBackups.get(key);
      this.branchProtectionBackups.delete(key);

      if (backup) {
        const body = this.buildGithubProtectionRestoreBody(backup);
        const result = await this.request<Record<string, unknown>>(
          "PUT",
          this.branchProtectionPath(owner, repo, branch),
          body,
        );
        return this.mapGithubProtection(result, branch);
      }

      try {
        const existing = await this.getBranchProtection(owner, repo, branch);
        await this.deleteBranchProtection(owner, repo, branch);
        return existing;
      } catch {
        return null;
      }
    }

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
      const key = this.branchProtectionKey(owner, repo, branch);
      if (this.branchProtectionBackups.has(key)) {
        const backup = this.branchProtectionBackups.get(key);
        this.branchProtectionBackups.delete(key);
        if (backup) {
          this.requestSync<Record<string, unknown>>(
            "PUT",
            this.branchProtectionPath(owner, repo, branch),
            this.buildGithubProtectionRestoreBody(backup),
          );
          console.log(`✅ 分支保护已恢复（同步）: ${branch}`);
          return;
        }
      }

      this.requestSync<void>("DELETE", this.branchProtectionPath(owner, repo, branch));
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
      {
        body: options.body,
      },
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
        line: c.new_position,
        side: DIFF_SIDE.RIGHT,
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
    // GitHub 的 updatePullReview 只能更新 PENDING 状态的 review
    // 已提交的 review 无法更新，所以使用删除+创建的方式
    try {
      await this.deletePullReview(owner, repo, index, reviewId);
    } catch {
      // 已提交的 review 无法删除，忽略错误
    }
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
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/pulls/${index}/reviews/${reviewId}/comments`,
    );
    const comments = results.map((c) => this.mapPullReviewComment(c));
    // 通过 GraphQL 补充 resolved 状态
    try {
      const resolvedMap = await this.fetchResolvedThreads(owner, repo, index);
      for (const comment of comments) {
        if (comment.id && resolvedMap.has(comment.id)) {
          comment.resolver = resolvedMap.get(comment.id) ?? null;
        }
      }
    } catch {
      // GraphQL 查询失败不影响主流程
    }
    return comments;
  }

  async deletePullReviewComment(owner: string, repo: string, commentId: number): Promise<void> {
    await this.request<void>("DELETE", `/repos/${owner}/${repo}/pulls/comments/${commentId}`);
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

  async getPullReviewCommentReactions(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<Reaction[]> {
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/repos/${owner}/${repo}/pulls/comments/${commentId}/reactions`,
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

  // ============ Actions 操作 ============

  async listWorkflowRuns(
    owner: string,
    repo: string,
    options?: { status?: string; sha?: string },
  ): Promise<WorkflowRun[]> {
    const params = new URLSearchParams();
    if (options?.status) {
      params.set("status", options.status);
    }
    if (options?.sha) {
      params.set("head_sha", options.sha);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const result = await this.request<{ workflow_runs: Array<Record<string, unknown>> }>(
      "GET",
      `/repos/${owner}/${repo}/actions/runs${query}`,
    );
    return (result.workflow_runs || []).map((run) => ({
      id: run.id as number,
      run_number: run.run_number as number,
      name: (run.name as string) || undefined,
      status: run.status as string,
      branch: (run.head_branch as string) || undefined,
      sha: (run.head_sha as string) || undefined,
      actor: run.actor
        ? {
            id: (run.actor as Record<string, unknown>).id as number,
            login: (run.actor as Record<string, unknown>).login as string,
          }
        : undefined,
      created_at: run.created_at as string,
      updated_at: run.updated_at as string,
    }));
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

  /**
   * 通过 GraphQL 查询 PR 的 review threads resolved 状态
   * 返回 Map<commentId, resolver>（用于 listPullReviewComments 内部补充 resolver）
   *
   * 一个 thread 下所有 comment 都视为已解决，避免同 thread 下不同 comment（如
   * 同 path:line 多个 ruleId 的 AI 评论）只有首条被标记。
   */
  protected async fetchResolvedThreads(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<Map<number, { id?: number; login?: string } | null>> {
    const threads = await this.queryReviewThreads(owner, repo, prNumber);
    const resolvedMap = new Map<number, { id?: number; login?: string } | null>();
    for (const thread of threads) {
      if (!thread.isResolved) continue;
      const resolver = thread.resolvedBy
        ? { id: thread.resolvedBy.databaseId, login: thread.resolvedBy.login }
        : null;
      for (const comment of thread.comments.nodes) {
        if (!comment?.databaseId) continue;
        resolvedMap.set(comment.databaseId, resolver);
      }
    }
    return resolvedMap;
  }

  async listResolvedThreads(owner: string, repo: string, index: number): Promise<ResolvedThread[]> {
    const threads = await this.queryReviewThreads(owner, repo, index);
    const result: ResolvedThread[] = [];
    for (const thread of threads) {
      if (!thread.isResolved) continue;
      const resolvedBy = thread.resolvedBy
        ? { id: thread.resolvedBy.databaseId, login: thread.resolvedBy.login }
        : null;
      // 展开 thread 下所有 comment —— GitHub review thread 对应一次
      // Resolve Conversation 操作，但 thread 内可能有多条 comment（含 reply
      // 或同 path:line 分组），需保证每条都能被 syncResolved 匹配到 issue。
      for (const comment of thread.comments.nodes) {
        result.push({
          path: thread.path ?? undefined,
          line: thread.line ?? undefined,
          resolvedBy,
          body: comment?.body,
        });
      }
    }
    return result;
  }

  /**
   * GraphQL 查询 PR 的所有 review threads
   */
  protected async queryReviewThreads(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<GraphQLReviewThread[]> {
    const QUERY = `
      query($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            reviewThreads(first: 100) {
              nodes {
                isResolved
                resolvedBy { login databaseId }
                path
                line
                comments(first: 100) {
                  nodes { databaseId body }
                }
              }
            }
          }
        }
      }
    `;
    interface GraphQLResult {
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: GraphQLReviewThread[];
          };
        };
      };
    }
    const data = await this.requestGraphQL<GraphQLResult>(QUERY, {
      owner,
      repo,
      prNumber,
    });
    return data.repository.pullRequest.reviewThreads.nodes;
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

  protected buildGithubProtectionRestoreBody(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      required_status_checks: this.buildGithubStatusChecks(data.required_status_checks),
      enforce_admins: this.buildGithubEnforceAdmins(data.enforce_admins),
      required_pull_request_reviews: this.buildGithubPullRequestReviews(
        data.required_pull_request_reviews,
      ),
      restrictions: this.buildGithubRestrictions(data.restrictions),
    };
  }

  private buildGithubStatusChecks(value: unknown): Record<string, unknown> | null {
    if (!this.isRecord(value)) return null;

    const contexts = this.toStringArray(value.contexts);
    const checks = Array.isArray(value.checks)
      ? value.checks
          .filter((check): check is Record<string, unknown> => this.isRecord(check))
          .map((check) => ({
            context: typeof check.context === "string" ? check.context : "",
            app_id: typeof check.app_id === "number" ? check.app_id : null,
          }))
          .filter((check) => check.context)
      : [];

    return {
      strict: Boolean(value.strict),
      contexts,
      checks,
    };
  }

  private buildGithubEnforceAdmins(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (this.isRecord(value)) return Boolean(value.enabled);
    return false;
  }

  private buildGithubPullRequestReviews(value: unknown): Record<string, unknown> | null {
    if (!this.isRecord(value)) return null;

    const result: Record<string, unknown> = {};
    const optionalBooleans = [
      "dismiss_stale_reviews",
      "require_code_owner_reviews",
      "require_last_push_approval",
    ];
    for (const key of optionalBooleans) {
      if (typeof value[key] === "boolean") {
        result[key] = value[key];
      }
    }

    if (typeof value.required_approving_review_count === "number") {
      result.required_approving_review_count = value.required_approving_review_count;
    }

    const dismissalRestrictions = this.buildGithubRestrictions(value.dismissal_restrictions);
    if (dismissalRestrictions) {
      result.dismissal_restrictions = dismissalRestrictions;
    }

    const bypassAllowances = this.buildGithubRestrictions(value.bypass_pull_request_allowances);
    if (bypassAllowances) {
      result.bypass_pull_request_allowances = bypassAllowances;
    }

    return result;
  }

  private buildGithubRestrictions(value: unknown): Record<string, string[]> | null {
    if (!this.isRecord(value)) return null;
    return {
      users: this.pickGithubActors(value.users, "login"),
      teams: this.pickGithubActors(value.teams, "slug"),
      apps: this.pickGithubActors(value.apps, "slug", "name"),
    };
  }

  private pickGithubActors(value: unknown, ...keys: string[]): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!this.isRecord(item)) return [];
      for (const key of keys) {
        const actorName = item[key];
        if (typeof actorName === "string" && actorName.length > 0) {
          return [actorName];
        }
      }
      return [];
    });
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  protected mapReviewEvent(event?: string): string {
    const eventMap: Record<string, string> = {
      [REVIEW_STATE.APPROVE]: REVIEW_STATE.APPROVE,
      [REVIEW_STATE.REQUEST_CHANGES]: REVIEW_STATE.REQUEST_CHANGES,
      [REVIEW_STATE.COMMENT]: REVIEW_STATE.COMMENT,
      [REVIEW_STATE.PENDING]: REVIEW_STATE.PENDING,
    };
    return event ? eventMap[event] || event : REVIEW_STATE.COMMENT;
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
