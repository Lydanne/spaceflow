/**
 * Git Provider 通用类型定义
 * 适用于 Gitea、GitHub 等多种 Git 托管平台
 */

/** Git Provider 平台类型 */
export type GitProviderType = "gitea" | "github" | "gitlab";

/** Git Provider 模块配置选项 */
export interface GitProviderModuleOptions {
  /** Git Provider 平台类型 */
  provider: GitProviderType;
  /** 服务器 URL */
  baseUrl: string;
  /** API Token */
  token: string;
}

/** Git Provider 模块异步配置选项 */
export interface GitProviderModuleAsyncOptions {
  useFactory: (...args: unknown[]) => Promise<GitProviderModuleOptions> | GitProviderModuleOptions;
  inject?: any[];
}

/** 注入令牌 */
export const GIT_PROVIDER_MODULE_OPTIONS = "GIT_PROVIDER_MODULE_OPTIONS";

/** 分支保护规则 */
export interface BranchProtection {
  approvals_whitelist_teams?: string[];
  approvals_whitelist_username?: string[];
  block_admin_merge_override?: boolean;
  block_on_official_review_requests?: boolean;
  block_on_outdated_branch?: boolean;
  block_on_rejected_reviews?: boolean;
  branch_name?: string;
  created_at?: string;
  dismiss_stale_approvals?: boolean;
  enable_approvals_whitelist?: boolean;
  enable_force_push?: boolean;
  enable_force_push_allowlist?: boolean;
  enable_merge_whitelist?: boolean;
  enable_push?: boolean;
  enable_push_whitelist?: boolean;
  enable_status_check?: boolean;
  force_push_allowlist_deploy_keys?: boolean;
  force_push_allowlist_teams?: string[];
  force_push_allowlist_usernames?: string[];
  ignore_stale_approvals?: boolean;
  merge_whitelist_teams?: string[];
  merge_whitelist_usernames?: string[];
  priority?: number;
  protected_file_patterns?: string;
  push_whitelist_deploy_keys?: boolean;
  push_whitelist_teams?: string[];
  push_whitelist_usernames?: string[];
  require_signed_commits?: boolean;
  required_approvals?: number;
  rule_name?: string;
  status_check_contexts?: string[];
  unprotected_file_patterns?: string;
  updated_at?: string;
}

/** 创建分支保护规则选项 */
export interface CreateBranchProtectionOption {
  approvals_whitelist_teams?: string[];
  approvals_whitelist_username?: string[];
  block_admin_merge_override?: boolean;
  block_on_official_review_requests?: boolean;
  block_on_outdated_branch?: boolean;
  block_on_rejected_reviews?: boolean;
  /** 分支名称或通配符规则 */
  branch_name?: string;
  /** 规则名称 */
  rule_name?: string;
  dismiss_stale_approvals?: boolean;
  enable_approvals_whitelist?: boolean;
  enable_force_push?: boolean;
  enable_force_push_allowlist?: boolean;
  enable_merge_whitelist?: boolean;
  /** 是否允许推送 */
  enable_push?: boolean;
  enable_push_whitelist?: boolean;
  enable_status_check?: boolean;
  force_push_allowlist_deploy_keys?: boolean;
  force_push_allowlist_teams?: string[];
  force_push_allowlist_usernames?: string[];
  ignore_stale_approvals?: boolean;
  merge_whitelist_teams?: string[];
  merge_whitelist_usernames?: string[];
  priority?: number;
  protected_file_patterns?: string;
  push_whitelist_deploy_keys?: boolean;
  push_whitelist_teams?: string[];
  push_whitelist_usernames?: string[];
  require_signed_commits?: boolean;
  required_approvals?: number;
  status_check_contexts?: string[];
  unprotected_file_patterns?: string;
}

/** 编辑分支保护规则选项 */
export interface EditBranchProtectionOption {
  approvals_whitelist_teams?: string[];
  approvals_whitelist_username?: string[];
  block_admin_merge_override?: boolean;
  block_on_official_review_requests?: boolean;
  block_on_outdated_branch?: boolean;
  block_on_rejected_reviews?: boolean;
  dismiss_stale_approvals?: boolean;
  enable_approvals_whitelist?: boolean;
  enable_force_push?: boolean;
  enable_force_push_allowlist?: boolean;
  enable_merge_whitelist?: boolean;
  /** 是否允许推送 */
  enable_push?: boolean;
  enable_push_whitelist?: boolean;
  enable_status_check?: boolean;
  force_push_allowlist_deploy_keys?: boolean;
  force_push_allowlist_teams?: string[];
  force_push_allowlist_usernames?: string[];
  ignore_stale_approvals?: boolean;
  merge_whitelist_teams?: string[];
  merge_whitelist_usernames?: string[];
  priority?: number;
  protected_file_patterns?: string;
  push_whitelist_deploy_keys?: boolean;
  push_whitelist_teams?: string[];
  push_whitelist_usernames?: string[];
  require_signed_commits?: boolean;
  required_approvals?: number;
  status_check_contexts?: string[];
  unprotected_file_patterns?: string;
}

/** 分支信息 */
export interface Branch {
  commit?: {
    id?: string;
    message?: string;
    timestamp?: string;
  };
  effective_branch_protection_name?: string;
  enable_status_check?: boolean;
  name?: string;
  protected?: boolean;
  required_approvals?: number;
  status_check_contexts?: string[];
  user_can_merge?: boolean;
  user_can_push?: boolean;
}

/** 仓库信息 */
export interface Repository {
  id?: number;
  owner?: {
    id?: number;
    login?: string;
    full_name?: string;
  };
  name?: string;
  full_name?: string;
  default_branch?: string;
}

/** Pull Request 信息 */
export interface PullRequest {
  id?: number;
  number?: number;
  title?: string;
  body?: string;
  state?: string;
  head?: {
    ref?: string;
    sha?: string;
    repo?: Repository;
  };
  base?: {
    ref?: string;
    sha?: string;
    repo?: Repository;
  };
  user?: {
    id?: number;
    login?: string;
  };
  /** PR 指定的评审人（个人用户） */
  requested_reviewers?: Array<{
    id?: number;
    login?: string;
  }>;
  /** PR 指定的评审团队 */
  requested_reviewers_teams?: Array<{
    id?: number;
    name?: string;
    /** 团队成员 */
    members?: Array<{
      id?: number;
      login?: string;
    }>;
  }>;
  created_at?: string;
  updated_at?: string;
  merged_at?: string;
  merge_base?: string;
}

/** 编辑 PR 的选项 */
export interface EditPullRequestOption {
  title?: string;
  body?: string;
  state?: "open" | "closed";
  base?: string;
}

/** PR Commit 信息 */
export interface PullRequestCommit {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      name?: string;
      email?: string;
      date?: string;
    };
  };
  author?: {
    id?: number;
    login?: string;
  };
  committer?: {
    id?: number;
    login?: string;
  };
}

/** 文件变更信息 */
export interface ChangedFile {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
  raw_url?: string;
  contents_url?: string;
}

/** Commit 详细信息（包含文件变更） */
export interface CommitInfo extends PullRequestCommit {
  files?: ChangedFile[];
}

/** Issue/PR 评论 */
export interface IssueComment {
  id?: number;
  body?: string;
  user?: {
    id?: number;
    login?: string;
  };
  created_at?: string;
  updated_at?: string;
}

/** 创建 Issue 评论选项 */
export interface CreateIssueCommentOption {
  body: string;
}

/** 创建 Issue 的选项 */
export interface CreateIssueOption {
  /** Issue 标题 */
  title: string;
  /** Issue 内容 */
  body?: string;
  /** 指派人用户名列表 */
  assignees?: string[];
  /** 标签名称列表，各平台 adapter 内部负责名称到 ID 的转换 */
  labels?: string[];
  /** 里程碑 ID */
  milestone?: number;
  /** 截止日期 */
  due_date?: string;
}

/** Issue 响应 */
export interface Issue {
  id?: number;
  number?: number;
  title?: string;
  body?: string;
  state?: string;
  user?: {
    id?: number;
    login?: string;
  };
  labels?: Array<{
    id?: number;
    name?: string;
    color?: string;
  }>;
  assignees?: Array<{
    id?: number;
    login?: string;
  }>;
  milestone?: {
    id?: number;
    title?: string;
  };
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  html_url?: string;
}

/** PR Review 事件类型 */
export type ReviewStateType = "APPROVE" | "REQUEST_CHANGES" | "COMMENT" | "PENDING";

/** PR Review 事件常量 */
export const REVIEW_STATE = {
  APPROVE: "APPROVE",
  REQUEST_CHANGES: "REQUEST_CHANGES",
  COMMENT: "COMMENT",
  PENDING: "PENDING",
} as const;

/** PR Review 行级评论 Diff 方向 */
export const DIFF_SIDE = {
  RIGHT: "RIGHT",
  LEFT: "LEFT",
} as const;

/** PR Review 行级评论 */
export interface CreatePullReviewComment {
  /** 文件路径 */
  path: string;
  /** 评论内容 */
  body: string;
  /** 旧文件行号（删除行），新增行设为 0 */
  old_position?: number;
  /** 新文件行号（新增/修改行），删除行设为 0 */
  new_position?: number;
}

/** 创建 PR Review 的选项 */
export interface CreatePullReviewOption {
  /** Review 事件类型 */
  event?: ReviewStateType;
  /** Review 主体评论 */
  body?: string;
  /** 行级评论列表 */
  comments?: CreatePullReviewComment[];
  /** 提交 SHA（可选） */
  commit_id?: string;
}

/** PR Review 响应 */
export interface PullReview {
  id?: number;
  body?: string;
  state?: string;
  user?: {
    id?: number;
    login?: string;
  };
  created_at?: string;
  updated_at?: string;
  commit_id?: string;
}

/** PR Review 行级评论响应 */
export interface PullReviewComment {
  id?: number;
  body?: string;
  path?: string;
  position?: number;
  original_position?: number;
  commit_id?: string;
  original_commit_id?: string;
  diff_hunk?: string;
  pull_request_review_id?: number;
  user?: {
    id?: number;
    login?: string;
  };
  /** 解决者，如果不为 null 表示评论已被标记为已解决 */
  resolver?: {
    id?: number;
    login?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
}

/** PR Review Thread 已解决信息 */
export interface ResolvedThread {
  /** 文件路径 */
  path?: string;
  /** 行号（新文件中的行号） */
  line?: number;
  /** 解决者 */
  resolvedBy?: {
    id?: number;
    login?: string;
  } | null;
  /** 评论内容（用于提取 issue key 精确匹配） */
  body?: string;
}

/** 用户信息 */
export interface User {
  id?: number;
  login?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
}

/** 仓库目录/文件条目 */
export interface RepositoryContent {
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 类型：file 或 dir */
  type: "file" | "dir";
  /** 文件大小（字节） */
  size?: number;
  /** 下载 URL */
  download_url?: string;
}

/** 远程仓库引用（解析自浏览器 URL） */
export interface RemoteRepoRef {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** 子目录路径（空字符串表示根目录） */
  path: string;
  /** 分支/标签（undefined 表示默认分支） */
  ref?: string;
  /** 来源平台类型 */
  provider: GitProviderType;
  /** 原始服务器 URL（如 https://git.bjxgj.com） */
  serverUrl: string;
}

/** 评论/Issue 的 Reaction（表情符号反应） */
export interface Reaction {
  /** 添加 reaction 的用户 */
  user?: {
    id?: number;
    login?: string;
  };
  /** reaction 内容，如 +1, -1, laugh, hooray, confused, heart, rocket, eyes */
  content?: string;
  /** 创建时间 */
  created_at?: string;
}
