import {
  GitProviderService,
  PullRequest,
  PullRequestCommit,
  ChangedFile,
  CommitInfo,
  IssueComment,
  CreateIssueCommentOption,
  CreatePullReviewOption,
  PullReview,
  PullReviewComment,
  EditPullRequestOption,
  Reaction,
  ResolvedThread,
  User,
} from "@spaceflow/core";

/**
 * PR 数据模型映射层
 * 封装所有 PR 相关的读写操作，消除 owner/repo/prNumber 三元组的散传
 * 读操作带懒加载缓存，写操作直通 gitProvider
 */
export class PullRequestModel {
  private _info: PullRequest | null = null;
  private _commits: PullRequestCommit[] | null = null;
  private _files: ChangedFile[] | null = null;
  private _diff: string | null = null;
  private _comments: IssueComment[] | null = null;
  private _reviews: PullReview[] | null = null;

  constructor(
    private readonly gitProvider: GitProviderService,
    readonly owner: string,
    readonly repo: string,
    readonly number: number,
  ) {}

  // ============ 懒加载数据（带缓存） ============

  /** 获取 PR 基本信息（懒加载 + 缓存） */
  async getInfo(): Promise<PullRequest> {
    if (!this._info) {
      this._info = await this.gitProvider.getPullRequest(this.owner, this.repo, this.number);
    }
    return this._info;
  }

  /** 获取 head commit SHA */
  async getHeadSha(): Promise<string> {
    const info = await this.getInfo();
    return info.head?.sha || "HEAD";
  }

  /** 获取 PR 的所有 commits（懒加载 + 缓存） */
  async getCommits(): Promise<PullRequestCommit[]> {
    if (!this._commits) {
      this._commits = await this.gitProvider.getPullRequestCommits(
        this.owner,
        this.repo,
        this.number,
      );
    }
    return this._commits;
  }

  /** 获取 PR 的变更文件列表（懒加载 + 缓存） */
  async getFiles(): Promise<ChangedFile[]> {
    if (!this._files) {
      this._files = await this.gitProvider.getPullRequestFiles(
        this.owner,
        this.repo,
        this.number,
      );
    }
    return this._files;
  }

  /** 获取 PR 的 diff 文本（懒加载 + 缓存） */
  async getDiff(): Promise<string> {
    if (!this._diff) {
      this._diff = await this.gitProvider.getPullRequestDiff(this.owner, this.repo, this.number);
    }
    return this._diff;
  }

  // ============ PR 编辑 ============

  /** 编辑 PR（标题、描述等），自动 invalidate info 缓存 */
  async edit(options: EditPullRequestOption): Promise<PullRequest> {
    const result = await this.gitProvider.editPullRequest(
      this.owner,
      this.repo,
      this.number,
      options,
    );
    this._info = result;
    return result;
  }

  // ============ Issue Comments（PR 主评论） ============

  /** 列出 PR 的所有 Issue Comments（懒加载 + 缓存） */
  async getComments(): Promise<IssueComment[]> {
    if (!this._comments) {
      this._comments = await this.gitProvider.listIssueComments(
        this.owner,
        this.repo,
        this.number,
      );
    }
    return this._comments;
  }

  /** 创建 Issue Comment */
  async createComment(options: CreateIssueCommentOption): Promise<IssueComment> {
    const result = await this.gitProvider.createIssueComment(
      this.owner,
      this.repo,
      this.number,
      options,
    );
    this._comments = null; // invalidate
    return result;
  }

  /** 更新 Issue Comment */
  async updateComment(commentId: number, body: string): Promise<IssueComment> {
    const result = await this.gitProvider.updateIssueComment(
      this.owner,
      this.repo,
      commentId,
      body,
    );
    this._comments = null; // invalidate
    return result;
  }

  /** 删除 Issue Comment */
  async deleteComment(commentId: number): Promise<void> {
    await this.gitProvider.deleteIssueComment(this.owner, this.repo, commentId);
    this._comments = null; // invalidate
  }

  // ============ PR Reviews（行级评论） ============

  /** 列出 PR 的所有 Reviews（懒加载 + 缓存） */
  async getReviews(): Promise<PullReview[]> {
    if (!this._reviews) {
      this._reviews = await this.gitProvider.listPullReviews(this.owner, this.repo, this.number);
    }
    return this._reviews;
  }

  /** 创建 PR Review */
  async createReview(options: CreatePullReviewOption): Promise<PullReview> {
    const result = await this.gitProvider.createPullReview(
      this.owner,
      this.repo,
      this.number,
      options,
    );
    this._reviews = null; // invalidate
    return result;
  }

  /** 删除 PR Review */
  async deleteReview(reviewId: number): Promise<void> {
    await this.gitProvider.deletePullReview(this.owner, this.repo, this.number, reviewId);
    this._reviews = null; // invalidate
  }

  /** 获取 PR Review 的行级评论列表 */
  async getReviewComments(reviewId: number): Promise<PullReviewComment[]> {
    return this.gitProvider.listPullReviewComments(this.owner, this.repo, this.number, reviewId);
  }

  /** 获取已解决的 review threads */
  async getResolvedThreads(): Promise<ResolvedThread[]> {
    return this.gitProvider.listResolvedThreads(this.owner, this.repo, this.number);
  }

  // ============ Reaction 操作 ============

  /** 获取 PR Review 行级评论的 reactions */
  async getReviewCommentReactions(commentId: number): Promise<Reaction[]> {
    return this.gitProvider.getPullReviewCommentReactions(this.owner, this.repo, commentId);
  }

  // ============ 仓库级操作（需要 owner/repo 但不需要 prNumber） ============

  /** 获取文件内容 */
  async getFileContent(filepath: string, ref?: string): Promise<string> {
    return this.gitProvider.getFileContent(this.owner, this.repo, filepath, ref);
  }

  /** 获取单个 commit 信息 */
  async getCommit(sha: string): Promise<CommitInfo> {
    return this.gitProvider.getCommit(this.owner, this.repo, sha);
  }

  /** 获取单个 commit 的 diff */
  async getCommitDiff(sha: string): Promise<string> {
    return this.gitProvider.getCommitDiff(this.owner, this.repo, sha);
  }

  /** 搜索用户 */
  async searchUsers(query: string, limit?: number): Promise<User[]> {
    return this.gitProvider.searchUsers(query, limit);
  }

  /** 获取团队成员列表 */
  async getTeamMembers(teamId: number): Promise<User[]> {
    return this.gitProvider.getTeamMembers(teamId);
  }

  /** 列出 workflow runs */
  async listWorkflowRuns(options?: { status?: string; sha?: string }) {
    return this.gitProvider.listWorkflowRuns(this.owner, this.repo, options);
  }

  // ============ 缓存控制 ============

  /** 清除指定或所有缓存 */
  invalidate(key?: "info" | "commits" | "files" | "diff" | "comments" | "reviews"): void {
    if (key) {
      switch (key) {
        case "info":
          this._info = null;
          break;
        case "commits":
          this._commits = null;
          break;
        case "files":
          this._files = null;
          break;
        case "diff":
          this._diff = null;
          break;
        case "comments":
          this._comments = null;
          break;
        case "reviews":
          this._reviews = null;
          break;
      }
    } else {
      this._info = null;
      this._commits = null;
      this._files = null;
      this._diff = null;
      this._comments = null;
      this._reviews = null;
    }
  }
}
