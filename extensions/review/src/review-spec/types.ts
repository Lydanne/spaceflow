export type Severity = "off" | "warn" | "error";

/** 文件内容行：[commitHash, lineCode]，commitHash 为 7 位短 hash 或 "-------" 表示非变更行 */
export type FileContentLine = [string, string];

/** 文件内容映射：filename -> 每行的 [commitHash, lineCode] 数组 */
export type FileContentsMap = Map<string, FileContentLine[]>;

export const SEVERITY_EMOJI: Record<Severity, string> = {
  off: "⚪",
  warn: "🟡",
  error: "🔴",
};

export interface ReviewSpec {
  filename: string;
  extensions: string[];
  type: string;
  content: string;
  rules: ReviewRule[];
  overrides: string[]; // 文件级别的 override
  severity: Severity; // 文件级别的默认 severity
  includes: string[]; // 文件级别的 includes，只有匹配的文件才应用此规范
}

export interface RuleExample {
  lang: string;
  code: string;
  type: "good" | "bad";
}

export interface ReviewRule {
  id: string;
  title: string;
  description: string;
  examples: RuleExample[];
  overrides: string[]; // 规则级别的 override
  severity?: Severity; // 规则级别的 severity，可覆盖文件级别
  includes?: string[]; // 规则级别的 includes，可覆盖文件级别
}

/** 问题的 Reaction 记录 */
export interface IssueReaction {
  /** reaction 内容，如 +1, -1, laugh, hooray, confused, heart, rocket, eyes */
  content: string;
  /** 点击该 reaction 的用户列表 */
  users: string[];
}

/** 用户信息 */
export interface UserInfo {
  /** 用户 ID */
  id?: string;
  /** 用户登录名 */
  login: string;
}

/** 问题评论的回复记录 */
export interface IssueReply {
  /** 回复用户 */
  user: UserInfo;
  /** 回复内容 */
  body: string;
  /** 回复时间 */
  createdAt: string;
}

export interface ReviewIssue {
  file: string;
  line: string; // 格式 12 或者 12-14
  code: string; // 当前行代码, 去除首尾空白
  ruleId: string;
  specFile: string;
  reason: string;
  date?: string; // 发现问题的时间
  fixed?: string; // AI 验证修复时间
  fixedBy?: UserInfo; // AI 验证修复者
  resolved?: string; // 用户手动点击 resolve 的时间
  resolvedBy?: UserInfo; // 手动 resolve 的操作者
  valid?: string; // 问题是否有效
  suggestion?: string;
  commit?: string;
  severity: Severity;
  round: number; // 发现问题的轮次
  /** 问题的作者 */
  author?: UserInfo;
  /** 问题评论的 reactions 记录 */
  reactions?: IssueReaction[];
  /** 问题评论的回复/聊天记录 */
  replies?: IssueReply[];
  /** 原始行号（行号更新前的值） */
  originalLine?: string;
}

export interface FileSummary {
  file: string;
  resolved: number;
  unresolved: number;
  summary: string;
}

export interface DeletionImpact {
  file: string;
  deletedCode: string;
  riskLevel: "high" | "medium" | "low" | "none";
  affectedFiles: string[];
  reason: string;
  suggestion?: string;
}

export interface DeletionImpactResult {
  impacts: DeletionImpact[];
  summary: string;
}

/** Review 统计信息 */
export interface ReviewStats {
  /** 总问题数 */
  total: number;
  /** AI 验证已修复数 */
  fixed: number;
  /** 用户手动 resolve 数 */
  resolved: number;
  /** 无效问题数 */
  invalid: number;
  /** 待处理数 */
  pending: number;
  /** 修复率 (0-100)，仅计算代码修复：fixed / validTotal */
  fixRate: number;
  /** 解决率 (0-100)，计算已解决：resolved / validTotal */
  resolveRate: number;
}

export interface ReviewResult {
  success: boolean;
  /**
   * AI 生成的 PR 标题
   */
  title?: string;
  /**
   * 通过 commit 和 文件总结一下这个 PR 开发的什么功能
   */
  description: string;
  issues: ReviewIssue[];
  summary: FileSummary[];
  deletionImpact?: DeletionImpactResult;
  round: number; // 当前 review 的轮次
  /** 问题统计信息 */
  stats?: ReviewStats;
}
