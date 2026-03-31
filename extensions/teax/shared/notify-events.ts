/** 仓库事件常量（用于规则配置与偏好开关） */
export const REPO_NOTIFY_EVENTS = [
  "workflow_success",
  "workflow_failure",
  "push",
  "pr_opened",
  "issue_opened",
  "agent_completed",
  "agent_failed",
] as const;

export type RepoNotifyEvent = (typeof REPO_NOTIFY_EVENTS)[number];

/** 个人事件常量（不依赖仓库上下文） */
export const PERSONAL_NOTIFY_EVENTS = [
  "approval",
  "system",
] as const;

export type PersonalNotifyEvent = (typeof PERSONAL_NOTIFY_EVENTS)[number];

/** 前端展示用事件元数据（标签 + 图标） */
export const REPO_NOTIFY_EVENT_OPTIONS: Array<{
  value: RepoNotifyEvent;
  label: string;
  icon: string;
}> = [
  { value: "workflow_success", label: "Action 成功", icon: "i-lucide-check-circle" },
  { value: "workflow_failure", label: "Action 失败", icon: "i-lucide-x-circle" },
  { value: "push", label: "代码推送", icon: "i-lucide-git-commit" },
  { value: "pr_opened", label: "PR 创建", icon: "i-lucide-git-pull-request" },
  { value: "issue_opened", label: "Issue 创建", icon: "i-lucide-circle-dot" },
  { value: "agent_completed", label: "Agent 完成", icon: "i-lucide-bot" },
  { value: "agent_failed", label: "Agent 失败", icon: "i-lucide-bot" },
];

export interface NotifyPreferences {
  repoEvents: Record<RepoNotifyEvent, boolean>;
  personalEvents: Record<PersonalNotifyEvent, boolean>;
}

export interface NotifyPreferencesInput {
  repoEvents?: Partial<Record<RepoNotifyEvent, boolean>>;
  personalEvents?: Partial<Record<PersonalNotifyEvent, boolean>>;
}

/** 通知偏好默认值：push / PR / issue 默认关闭，其余核心事件默认开启 */
export const DEFAULT_NOTIFY_PREFERENCES: NotifyPreferences = {
  repoEvents: {
    workflow_success: true,
    workflow_failure: true,
    push: false,
    pr_opened: false,
    issue_opened: false,
    agent_completed: true,
    agent_failed: true,
  },
  personalEvents: {
    approval: true,
    system: false,
  },
};

/** 将外部输入归一为完整结构，避免缺省字段导致判空分支扩散 */
export function normalizeNotifyPreferences(input?: NotifyPreferencesInput | null): NotifyPreferences {
  const repoEvents = {
    ...DEFAULT_NOTIFY_PREFERENCES.repoEvents,
    ...(input?.repoEvents || {}),
  } as Record<RepoNotifyEvent, boolean>;

  const personalEvents = {
    ...DEFAULT_NOTIFY_PREFERENCES.personalEvents,
    ...(input?.personalEvents || {}),
  } as Record<PersonalNotifyEvent, boolean>;

  return { repoEvents, personalEvents };
}
