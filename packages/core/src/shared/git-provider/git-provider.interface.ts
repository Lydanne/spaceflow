import type {
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
} from "./types";

/** PR 列表查询选项 */
export interface ListPullRequestsOptions {
  state?: "open" | "closed" | "all";
  sort?: "oldest" | "recentupdate" | "leastupdate" | "mostcomment" | "leastcomment" | "priority";
  milestone?: number;
  labels?: string[];
}

/** 锁定分支选项 */
export interface LockBranchOptions {
  /** 允许推送的用户名白名单（如 CI 机器人） */
  pushWhitelistUsernames?: string[];
}

/**
 * Git Provider 抽象接口
 * 定义所有 Git 托管平台需要实现的通用操作
 */
export interface GitProvider {
  // ============ 配置验证 ============
  /** 验证配置是否完整 */
  validateConfig(): void;

  // ============ 仓库操作 ============
  /** 获取仓库信息 */
  getRepository(owner: string, repo: string): Promise<Repository>;

  // ============ 分支操作 ============
  /** 获取分支信息 */
  getBranch(owner: string, repo: string, branch: string): Promise<Branch>;

  // ============ 分支保护 ============
  /** 列出仓库的所有分支保护规则 */
  listBranchProtections(owner: string, repo: string): Promise<BranchProtection[]>;
  /** 获取特定分支保护规则 */
  getBranchProtection(owner: string, repo: string, name: string): Promise<BranchProtection>;
  /** 创建分支保护规则 */
  createBranchProtection(
    owner: string,
    repo: string,
    options: CreateBranchProtectionOption,
  ): Promise<BranchProtection>;
  /** 编辑分支保护规则 */
  editBranchProtection(
    owner: string,
    repo: string,
    name: string,
    options: EditBranchProtectionOption,
  ): Promise<BranchProtection>;
  /** 删除分支保护规则 */
  deleteBranchProtection(owner: string, repo: string, name: string): Promise<void>;
  /** 锁定分支 - 禁止推送（可配置白名单用户） */
  lockBranch(
    owner: string,
    repo: string,
    branch: string,
    options?: LockBranchOptions,
  ): Promise<BranchProtection>;
  /** 解锁分支 - 允许推送 */
  unlockBranch(owner: string, repo: string, branch: string): Promise<BranchProtection | null>;
  /** 同步解锁分支（用于进程退出时的清理） */
  unlockBranchSync(owner: string, repo: string, branch: string): void;

  // ============ Pull Request 操作 ============
  /** 获取 Pull Request 信息 */
  getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest>;
  /** 编辑 Pull Request */
  editPullRequest(
    owner: string,
    repo: string,
    index: number,
    options: EditPullRequestOption,
  ): Promise<PullRequest>;
  /** 列出仓库的 Pull Request */
  listPullRequests(
    owner: string,
    repo: string,
    state?: "open" | "closed" | "all",
  ): Promise<PullRequest[]>;
  /** 列出仓库的所有 Pull Request（支持分页获取全部） */
  listAllPullRequests(
    owner: string,
    repo: string,
    options?: ListPullRequestsOptions,
  ): Promise<PullRequest[]>;
  /** 获取 PR 的 commits */
  getPullRequestCommits(owner: string, repo: string, index: number): Promise<PullRequestCommit[]>;
  /** 获取 PR 的文件变更 */
  getPullRequestFiles(owner: string, repo: string, index: number): Promise<ChangedFile[]>;
  /** 获取 PR 的 diff */
  getPullRequestDiff(owner: string, repo: string, index: number): Promise<string>;

  // ============ Commit 操作 ============
  /** 获取单个 commit 信息 */
  getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo>;
  /** 获取两个 ref 之间的 diff */
  getCompareDiff(owner: string, repo: string, baseSha: string, headSha: string): Promise<string>;
  /** 获取单个 commit 的 diff */
  getCommitDiff(owner: string, repo: string, sha: string): Promise<string>;

  // ============ 文件操作 ============
  /** 获取文件内容 */
  getFileContent(owner: string, repo: string, filepath: string, ref?: string): Promise<string>;
  /** 列出仓库目录下的文件和子目录 */
  listRepositoryContents(
    owner: string,
    repo: string,
    path?: string,
    ref?: string,
  ): Promise<RepositoryContent[]>;

  // ============ Issue 操作 ============
  /** 创建 Issue */
  createIssue(owner: string, repo: string, options: CreateIssueOption): Promise<Issue>;
  /** 列出 Issue/PR 的评论 */
  listIssueComments(owner: string, repo: string, index: number): Promise<IssueComment[]>;
  /** 创建 Issue/PR 评论 */
  createIssueComment(
    owner: string,
    repo: string,
    index: number,
    options: CreateIssueCommentOption,
  ): Promise<IssueComment>;
  /** 更新 Issue/PR 评论 */
  updateIssueComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ): Promise<IssueComment>;
  /** 删除 Issue/PR 评论 */
  deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void>;

  // ============ PR Review 操作 ============
  /** 创建 PR Review */
  createPullReview(
    owner: string,
    repo: string,
    index: number,
    options: CreatePullReviewOption,
  ): Promise<PullReview>;
  /** 列出 PR 的所有 Reviews */
  listPullReviews(owner: string, repo: string, index: number): Promise<PullReview[]>;
  /** 更新 PR Review 的内容 */
  updatePullReview(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
    body: string,
  ): Promise<PullReview>;
  /** 删除 PR Review（仅支持 PENDING 状态） */
  deletePullReview(owner: string, repo: string, index: number, reviewId: number): Promise<void>;
  /** 获取 PR Review 的行级评论列表 */
  listPullReviewComments(
    owner: string,
    repo: string,
    index: number,
    reviewId: number,
  ): Promise<PullReviewComment[]>;
  /** 删除 PR Review 的单条行级评论 */
  deletePullReviewComment(owner: string, repo: string, commentId: number): Promise<void>;

  // ============ Reaction 操作 ============
  /** 获取 Issue/PR 评论的 reactions */
  getIssueCommentReactions(owner: string, repo: string, commentId: number): Promise<Reaction[]>;
  /** 获取 Issue/PR 的 reactions */
  getIssueReactions(owner: string, repo: string, index: number): Promise<Reaction[]>;

  // ============ 用户操作 ============
  /** 搜索用户 */
  searchUsers(query: string, limit?: number): Promise<User[]>;
  /** 获取团队成员列表 */
  getTeamMembers(teamId: number): Promise<User[]>;
}
