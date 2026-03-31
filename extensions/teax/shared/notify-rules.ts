import type { RepoNotifyEvent } from "./notify-events";

/**
 * 单条通知规则：
 * - events: 触发事件列表
 * - branches/workflows: 过滤器（空数组表示不过滤）
 */
export interface NotifyRule {
  id: string;
  name: string;
  chatId: string;
  events: RepoNotifyEvent[];
  branches: string[];
  workflows: string[];
}

/**
 * 仓库 settings 中与通知相关的字段。
 */
export interface RepoNotifySettings {
  /** 允许在 settings 中扩展其他字段。 */
  [key: string]: unknown;
  notifyRules?: NotifyRule[];
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
  approvalRequired?: boolean;
}

/**
 * 组织 settings 中与通知相关的字段。
 */
export interface OrgNotifySettings {
  /** 允许在 settings 中扩展其他字段。 */
  [key: string]: unknown;
  notifyRules?: NotifyRule[];
}
