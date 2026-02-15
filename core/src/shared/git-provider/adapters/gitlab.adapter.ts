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
 * GitLab 平台适配器
 *
 * GitLab API 特点：
 * - 使用 PRIVATE-TOKEN 认证
 * - 项目通过 URL-encoded path（owner/repo）标识
 * - Merge Request（MR）对应 Pull Request
 * - Notes 对应 Comments/Reviews
 * - API 前缀 /api/v4
 */
export class GitlabAdapter implements GitProvider {
  protected readonly baseUrl: string;
  protected readonly token: string;

  constructor(protected readonly options: GitProviderModuleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
  }

  /** 将 owner/repo 编码为 GitLab 项目路径 */
  protected encodeProject(owner: string, repo: string): string {
    return encodeURIComponent(`${owner}/${repo}`);
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
    const url = `${this.baseUrl}/api/v4${path}`;
    const headers: Record<string, string> = {
      "PRIVATE-TOKEN": this.token,
      "Content-Type": "application/json",
    };
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    if (response.status === 204) {
      return {} as T;
    }
    return response.json() as Promise<T>;
  }

  protected async fetchText(path: string): Promise<string> {
    const url = `${this.baseUrl}/api/v4${path}`;
    const response = await fetch(url, {
      headers: { "PRIVATE-TOKEN": this.token },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.text();
  }

  // ============ 仓库操作 ============

  async getRepository(owner: string, repo: string): Promise<Repository> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<Record<string, unknown>>("GET", `/projects/${project}`);
    const namespace = result.namespace as Record<string, unknown> | undefined;
    return {
      id: result.id as number,
      name: result.name as string,
      full_name: result.path_with_namespace as string,
      default_branch: result.default_branch as string,
      owner: namespace
        ? {
            id: namespace.id as number,
            login: namespace.path as string,
            full_name: namespace.name as string,
          }
        : undefined,
    };
  }

  // ============ 分支操作 ============

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/projects/${project}/repository/branches/${encodeURIComponent(branch)}`,
    );
    const commit = result.commit as Record<string, unknown> | undefined;
    return {
      name: result.name as string,
      protected: result.protected as boolean,
      commit: commit ? { id: commit.id as string, message: commit.message as string } : undefined,
    };
  }

  // ============ 分支保护 ============

  async listBranchProtections(owner: string, repo: string): Promise<BranchProtection[]> {
    const project = this.encodeProject(owner, repo);
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/protected_branches`,
    );
    return results.map((p) => this.mapProtection(p));
  }

  async getBranchProtection(owner: string, repo: string, name: string): Promise<BranchProtection> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/projects/${project}/protected_branches/${encodeURIComponent(name)}`,
    );
    return this.mapProtection(result);
  }

  async createBranchProtection(
    owner: string,
    repo: string,
    options: CreateBranchProtectionOption,
  ): Promise<BranchProtection> {
    const project = this.encodeProject(owner, repo);
    const branchName = options.branch_name || options.rule_name || "";
    const body: Record<string, unknown> = {
      name: branchName,
      push_access_level: options.enable_push ? 30 : 0, // 30=Developer, 0=No one
      merge_access_level: 30,
    };
    const result = await this.request<Record<string, unknown>>(
      "POST",
      `/projects/${project}/protected_branches`,
      body,
    );
    return this.mapProtection(result);
  }

  async editBranchProtection(
    owner: string,
    repo: string,
    name: string,
    options: EditBranchProtectionOption,
  ): Promise<BranchProtection> {
    // GitLab 不支持直接编辑，需要先删除再创建
    await this.deleteBranchProtection(owner, repo, name);
    return this.createBranchProtection(owner, repo, {
      branch_name: name,
      rule_name: name,
      ...options,
    });
  }

  async deleteBranchProtection(owner: string, repo: string, name: string): Promise<void> {
    const project = this.encodeProject(owner, repo);
    await this.request<void>(
      "DELETE",
      `/projects/${project}/protected_branches/${encodeURIComponent(name)}`,
    );
  }

  async lockBranch(
    owner: string,
    repo: string,
    branch: string,
    options?: LockBranchOptions,
  ): Promise<BranchProtection> {
    // 先尝试删除已有保护
    try {
      await this.deleteBranchProtection(owner, repo, branch);
    } catch {
      // 不存在时忽略
    }
    const pushLevel = options?.pushWhitelistUsernames?.length ? 30 : 0;
    return this.createBranchProtection(owner, repo, {
      branch_name: branch,
      rule_name: branch,
      enable_push: pushLevel > 0,
    });
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
    const project = this.encodeProject(owner, repo);
    try {
      execSync(
        `curl -s -X DELETE "${this.baseUrl}/api/v4/projects/${project}/protected_branches/${encodeURIComponent(branch)}" -H "PRIVATE-TOKEN: ${this.token}"`,
        { encoding: "utf-8" },
      );
      console.log(`✅ 分支已解锁（同步）: ${branch}`);
    } catch (error) {
      console.error("⚠️ 同步解锁分支失败:", error instanceof Error ? error.message : error);
    }
  }

  // ============ Merge Request（对应 Pull Request） ============

  async getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/projects/${project}/merge_requests/${index}`,
    );
    return this.mapMergeRequest(result);
  }

  async editPullRequest(
    owner: string,
    repo: string,
    index: number,
    options: EditPullRequestOption,
  ): Promise<PullRequest> {
    const project = this.encodeProject(owner, repo);
    const body: Record<string, unknown> = {};
    if (options.title) body.title = options.title;
    if (options.body !== undefined) body.description = options.body;
    if (options.state) body.state_event = options.state === "closed" ? "close" : "reopen";
    const result = await this.request<Record<string, unknown>>(
      "PUT",
      `/projects/${project}/merge_requests/${index}`,
      body,
    );
    return this.mapMergeRequest(result);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state?: "open" | "closed" | "all",
  ): Promise<PullRequest[]> {
    const project = this.encodeProject(owner, repo);
    const glState = this.mapStateParam(state);
    const query = glState ? `?state=${glState}` : "";
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/merge_requests${query}`,
    );
    return results.map((mr) => this.mapMergeRequest(mr));
  }

  async listAllPullRequests(
    owner: string,
    repo: string,
    options?: ListPullRequestsOptions,
  ): Promise<PullRequest[]> {
    const project = this.encodeProject(owner, repo);
    const allMRs: PullRequest[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (options?.state) params.set("state", this.mapStateParam(options.state) || "all");
      if (options?.labels?.length) params.set("labels", options.labels.join(","));
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/projects/${project}/merge_requests?${params.toString()}`,
      );
      if (!results || results.length === 0) break;
      allMRs.push(...results.map((mr) => this.mapMergeRequest(mr)));
      if (results.length < perPage) break;
      page++;
    }
    return allMRs;
  }

  async getPullRequestCommits(
    owner: string,
    repo: string,
    index: number,
  ): Promise<PullRequestCommit[]> {
    const project = this.encodeProject(owner, repo);
    const allCommits: PullRequestCommit[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/projects/${project}/merge_requests/${index}/commits?page=${page}&per_page=${perPage}`,
      );
      if (!results || results.length === 0) break;
      allCommits.push(...results.map((c) => this.mapGitlabCommit(c)));
      if (results.length < perPage) break;
      page++;
    }
    return allCommits;
  }

  async getPullRequestFiles(owner: string, repo: string, index: number): Promise<ChangedFile[]> {
    const project = this.encodeProject(owner, repo);
    const allFiles: ChangedFile[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/projects/${project}/merge_requests/${index}/diffs?page=${page}&per_page=${perPage}`,
      );
      if (!results || results.length === 0) break;
      allFiles.push(...results.map((d) => this.mapDiffToChangedFile(d)));
      if (results.length < perPage) break;
      page++;
    }
    return allFiles;
  }

  async getPullRequestDiff(owner: string, repo: string, index: number): Promise<string> {
    const project = this.encodeProject(owner, repo);
    return this.fetchText(`/projects/${project}/merge_requests/${index}/raw_diffs`);
  }

  // ============ Commit 操作 ============

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/projects/${project}/repository/commits/${sha}`,
    );
    // 获取 commit 的 diff 来填充 files
    let files: ChangedFile[] = [];
    try {
      const diffs = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/projects/${project}/repository/commits/${sha}/diff`,
      );
      files = diffs.map((d) => this.mapDiffToChangedFile(d));
    } catch {
      // diff 获取失败时忽略
    }
    const commit = this.mapGitlabCommit(result);
    return { ...commit, files };
  }

  async getCompareDiff(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
  ): Promise<string> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<{ diffs: Array<Record<string, unknown>> }>(
      "GET",
      `/projects/${project}/repository/compare?from=${encodeURIComponent(baseSha)}&to=${encodeURIComponent(headSha)}`,
    );
    // 将 diffs 拼接为 unified diff 文本
    return (result.diffs || [])
      .map((d) => {
        const oldPath = d.old_path as string;
        const newPath = d.new_path as string;
        const diff = d.diff as string;
        return `diff --git a/${oldPath} b/${newPath}\n${diff}`;
      })
      .join("\n");
  }

  async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    const project = this.encodeProject(owner, repo);
    const diffs = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/repository/commits/${sha}/diff`,
    );
    return diffs
      .map((d) => {
        const oldPath = d.old_path as string;
        const newPath = d.new_path as string;
        const diff = d.diff as string;
        return `diff --git a/${oldPath} b/${newPath}\n${diff}`;
      })
      .join("\n");
  }

  // ============ 文件操作 ============

  async getFileContent(
    owner: string,
    repo: string,
    filepath: string,
    ref?: string,
  ): Promise<string> {
    const project = this.encodeProject(owner, repo);
    const encodedPath = encodeURIComponent(filepath);
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    try {
      const url = `${this.baseUrl}/api/v4/projects/${project}/repository/files/${encodedPath}/raw${query}`;
      const response = await fetch(url, {
        headers: { "PRIVATE-TOKEN": this.token },
      });
      if (!response.ok) {
        if (response.status === 404) {
          return "";
        }
        const errorText = await response.text();
        throw new Error(
          `GitLab API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }
      return response.text();
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
    const project = this.encodeProject(owner, repo);
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (ref) params.set("ref", ref);
    const result = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/repository/tree?${params.toString()}`,
    );
    return result.map((item) => ({
      name: item.name as string,
      path: item.path as string,
      type: (item.type as string) === "tree" ? ("dir" as const) : ("file" as const),
    }));
  }

  // ============ Issue 操作 ============

  async createIssue(owner: string, repo: string, options: CreateIssueOption): Promise<Issue> {
    const project = this.encodeProject(owner, repo);
    const body: Record<string, unknown> = {
      title: options.title,
      description: options.body,
      assignee_ids: options.assignees,
      labels: options.labels?.join(","),
      milestone_id: options.milestone,
    };
    const result = await this.request<Record<string, unknown>>(
      "POST",
      `/projects/${project}/issues`,
      body,
    );
    return this.mapIssue(result);
  }

  async listIssueComments(owner: string, repo: string, index: number): Promise<IssueComment[]> {
    const project = this.encodeProject(owner, repo);
    // GitLab: MR notes 作为 issue comments
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/merge_requests/${index}/notes?sort=asc`,
    );
    return results.filter((n) => !(n.system as boolean)).map((n) => this.mapNote(n));
  }

  async createIssueComment(
    owner: string,
    repo: string,
    index: number,
    options: CreateIssueCommentOption,
  ): Promise<IssueComment> {
    const project = this.encodeProject(owner, repo);
    const result = await this.request<Record<string, unknown>>(
      "POST",
      `/projects/${project}/merge_requests/${index}/notes`,
      { body: options.body },
    );
    return this.mapNote(result);
  }

  async updateIssueComment(
    _owner: string,
    _repo: string,
    _commentId: number,
    _body: string,
  ): Promise<IssueComment> {
    // GitLab 更新 note 需要 noteable_iid，接口签名不含此信息
    throw new Error("GitLab 适配器暂不支持通过 commentId 更新评论，请使用 createIssueComment 替代");
  }

  async deleteIssueComment(_owner: string, _repo: string, _commentId: number): Promise<void> {
    throw new Error("GitLab 适配器暂不支持通过 commentId 删除评论");
  }

  // ============ MR Review（对应 PR Review） ============

  async createPullReview(
    owner: string,
    repo: string,
    index: number,
    options: CreatePullReviewOption,
  ): Promise<PullReview> {
    const project = this.encodeProject(owner, repo);
    // GitLab 没有 review 概念，用 note 模拟
    // 如果有 body，创建一个总体评论
    if (options.body) {
      const result = await this.request<Record<string, unknown>>(
        "POST",
        `/projects/${project}/merge_requests/${index}/notes`,
        { body: options.body },
      );
      const note = this.mapNote(result);
      return {
        id: note.id,
        body: note.body,
        state: options.event || "COMMENT",
        user: note.user,
        created_at: note.created_at,
        updated_at: note.updated_at,
      };
    }
    // 如果有行级评论，逐个创建
    if (options.comments?.length) {
      for (const comment of options.comments) {
        await this.request<Record<string, unknown>>(
          "POST",
          `/projects/${project}/merge_requests/${index}/notes`,
          { body: `**${comment.path}** (line ${comment.new_position})\n\n${comment.body}` },
        );
      }
    }
    // 如果是 APPROVE 事件，调用 approve API
    if (options.event === "APPROVE") {
      await this.request<void>("POST", `/projects/${project}/merge_requests/${index}/approve`);
    }
    return {
      id: 0,
      body: options.body || "",
      state: options.event || "COMMENT",
    };
  }

  async listPullReviews(owner: string, repo: string, index: number): Promise<PullReview[]> {
    const project = this.encodeProject(owner, repo);
    // GitLab 没有 review 概念，用 notes 模拟
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/merge_requests/${index}/notes?sort=asc`,
    );
    return results
      .filter((n) => !(n.system as boolean))
      .map((n) => {
        const note = this.mapNote(n);
        return {
          id: note.id,
          body: note.body,
          state: "COMMENT",
          user: note.user,
          created_at: note.created_at,
          updated_at: note.updated_at,
        };
      });
  }

  async deletePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
  ): Promise<void> {
    const project = this.encodeProject(owner, repo);
    await this.request<void>(
      "DELETE",
      `/projects/${project}/merge_requests/${index}/notes/${reviewId}`,
    );
  }

  async listPullReviewComments(
    owner: string,
    repo: string,
    index: number,
    _reviewId: number,
  ): Promise<PullReviewComment[]> {
    // GitLab 没有 review 下的 comments 概念，返回所有 diff notes
    const project = this.encodeProject(owner, repo);
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/projects/${project}/merge_requests/${index}/notes?sort=asc`,
    );
    return results
      .filter((n) => !!(n.position as Record<string, unknown> | undefined))
      .map((n) => {
        const user = (n.author as Record<string, unknown>) || {};
        const position = (n.position as Record<string, unknown>) || {};
        return {
          id: n.id as number,
          body: n.body as string,
          path: (position.new_path || position.old_path) as string,
          position: position.new_line as number,
          original_position: position.old_line as number,
          user: { id: user.id as number, login: user.username as string },
          created_at: n.created_at as string,
          updated_at: n.updated_at as string,
        };
      });
  }

  // ============ Reaction 操作 ============

  async getIssueCommentReactions(
    _owner: string,
    _repo: string,
    _commentId: number,
  ): Promise<Reaction[]> {
    // GitLab: award emoji on notes（需要 noteable_iid，此处简化返回空）
    return [];
  }

  async getIssueReactions(owner: string, repo: string, index: number): Promise<Reaction[]> {
    const project = this.encodeProject(owner, repo);
    try {
      const results = await this.request<Array<Record<string, unknown>>>(
        "GET",
        `/projects/${project}/merge_requests/${index}/award_emoji`,
      );
      return results.map((r) => {
        const user = r.user as Record<string, unknown> | undefined;
        return {
          user: user ? { id: user.id as number, login: user.username as string } : undefined,
          content: r.name as string,
          created_at: r.created_at as string,
        };
      });
    } catch {
      return [];
    }
  }

  // ============ 用户操作 ============

  async searchUsers(query: string, limit = 10): Promise<User[]> {
    const params = new URLSearchParams();
    params.set("search", query);
    params.set("per_page", String(limit));
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/users?${params.toString()}`,
    );
    return results.map((u) => ({
      id: u.id as number,
      login: u.username as string,
      full_name: u.name as string,
      email: u.email as string,
      avatar_url: u.avatar_url as string,
    }));
  }

  async getTeamMembers(teamId: number): Promise<User[]> {
    // GitLab: group members
    const results = await this.request<Array<Record<string, unknown>>>(
      "GET",
      `/groups/${teamId}/members`,
    );
    return results.map((u) => ({
      id: u.id as number,
      login: u.username as string,
      full_name: u.name as string,
      avatar_url: u.avatar_url as string,
    }));
  }

  // ============ 映射辅助方法 ============

  protected mapProtection(data: Record<string, unknown>): BranchProtection {
    const pushAccess = data.push_access_levels as Array<Record<string, unknown>> | undefined;
    return {
      branch_name: data.name as string,
      rule_name: data.name as string,
      enable_push: pushAccess ? pushAccess.some((l) => (l.access_level as number) > 0) : false,
    };
  }

  protected mapMergeRequest(data: Record<string, unknown>): PullRequest {
    const author = data.author as Record<string, unknown> | undefined;
    const reviewers = data.reviewers as Array<Record<string, unknown>> | undefined;
    return {
      id: data.id as number,
      number: data.iid as number,
      title: data.title as string,
      body: data.description as string,
      state: data.state as string,
      head: {
        ref: data.source_branch as string,
        sha: data.sha as string,
      },
      base: {
        ref: data.target_branch as string,
        sha: data.diff_refs
          ? ((data.diff_refs as Record<string, unknown>).base_sha as string)
          : undefined,
      },
      user: author ? { id: author.id as number, login: author.username as string } : undefined,
      requested_reviewers: reviewers?.map((r) => ({
        id: r.id as number,
        login: r.username as string,
      })),
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      merged_at: data.merged_at as string,
      merge_base: data.merge_commit_sha as string,
    };
  }

  protected mapGitlabCommit(data: Record<string, unknown>): PullRequestCommit {
    return {
      sha: (data.id || data.sha) as string,
      commit: {
        message: (data.message || data.title) as string,
        author: {
          name: data.author_name as string,
          email: data.author_email as string,
          date: (data.authored_date || data.created_at) as string,
        },
      },
      author: data.author_name ? { login: data.author_name as string } : undefined,
      committer: data.committer_name ? { login: data.committer_name as string } : undefined,
    };
  }

  protected mapDiffToChangedFile(data: Record<string, unknown>): ChangedFile {
    let status = "modified";
    if (data.new_file) status = "added";
    else if (data.deleted_file) status = "deleted";
    else if (data.renamed_file) status = "renamed";
    const diff = data.diff as string | undefined;
    // 从 diff 中计算 additions/deletions
    let additions = 0;
    let deletions = 0;
    if (diff) {
      for (const line of diff.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) deletions++;
      }
    }
    return {
      filename: (data.new_path || data.old_path) as string,
      status,
      additions,
      deletions,
      changes: additions + deletions,
      patch: diff,
    };
  }

  protected mapNote(data: Record<string, unknown>): IssueComment {
    const author = data.author as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      body: data.body as string,
      user: author ? { id: author.id as number, login: author.username as string } : undefined,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
    };
  }

  protected mapIssue(data: Record<string, unknown>): Issue {
    const author = data.author as Record<string, unknown> | undefined;
    const labels = data.labels as string[] | undefined;
    const assignees = data.assignees as Array<Record<string, unknown>> | undefined;
    const milestone = data.milestone as Record<string, unknown> | undefined;
    return {
      id: data.id as number,
      number: data.iid as number,
      title: data.title as string,
      body: data.description as string,
      state: data.state as string,
      user: author ? { id: author.id as number, login: author.username as string } : undefined,
      labels: labels?.map((l) => ({ name: l })),
      assignees: assignees?.map((a) => ({ id: a.id as number, login: a.username as string })),
      milestone: milestone
        ? { id: milestone.id as number, title: milestone.title as string }
        : undefined,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      closed_at: data.closed_at as string,
      html_url: data.web_url as string,
    };
  }

  protected mapStateParam(state?: "open" | "closed" | "all"): string | undefined {
    if (!state) return undefined;
    const stateMap: Record<string, string> = {
      open: "opened",
      closed: "closed",
      all: "all",
    };
    return stateMap[state] || state;
  }
}
