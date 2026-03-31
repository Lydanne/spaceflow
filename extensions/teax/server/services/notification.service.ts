import { eq, inArray, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  sendFeishuBatchMessage,
  sendFeishuChatCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/services/messaging";
import { EnhancedCardBuilder } from "~~/server/card-kit";
import type { RepoNotifyEvent } from "~~/shared/notify-events";
import type { NotifyRule, OrgNotifySettings, RepoNotifySettings } from "~~/shared/notify-rules";
import { normalizeUserSettings } from "~~/shared/user-settings";

// ─── 通知类型 ─────────────────────────────────────────────

export type NotificationType = "publish" | "approval" | "agent" | "system";

export interface NotifyContext {
  /** 仓库 ID（用于按 watch 状态过滤接收人） */
  repositoryId: string;
  /** 组织 ID（用于查找团队成员） */
  organizationId: string;
  /** 仓库全名（如 org/repo） */
  repoFullName: string;
  /** 仓库所属 owner（Gitea 组织名） */
  repoOwner: string;
  /** 仓库名 */
  repoName: string;
}

// ─── 构建通知卡片 ─────────────────────────────────────────

/**
 * 构建 Workflow Run 完成通知卡片。
 */
export function buildWorkflowRunCard(params: {
  repoFullName: string;
  runNumber: number;
  displayTitle: string;
  conclusion: string;
  event: string;
  headBranch: string;
  headSha: string;
  actor: string;
  startedAt: string;
  completedAt: string | null;
  htmlUrl: string;
  appUrl: string;
}): FeishuInteractiveCard {
  const normalizedConclusion = String(params.conclusion || "").toLowerCase();
  const isSuccess = normalizedConclusion === "success";
  const conclusionMap: Record<string, string> = {
    success: "✅ 成功",
    failure: "❌ 失败",
    cancelled: "⚫ 已取消",
    skipped: "⏭ 已跳过",
  };
  const conclusionText = conclusionMap[normalizedConclusion] || params.conclusion;
  const template = isSuccess ? "green" : normalizedConclusion === "failure" ? "red" : "grey";

  const eventMap: Record<string, string> = {
    push: "推送",
    workflow_dispatch: "手动触发",
    schedule: "定时",
    pull_request: "PR",
  };
  const eventText = eventMap[params.event] || params.event;

  let duration = "";
  if (params.startedAt && params.completedAt) {
    const ms = new Date(params.completedAt).getTime() - new Date(params.startedAt).getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) duration = `${seconds}s`;
    else if (seconds < 3600) duration = `${Math.floor(seconds / 60)}m${seconds % 60}s`;
    else duration = `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
  }

  const meta = [
    `🌿 ${params.headBranch}`,
    `📝 ${params.headSha.substring(0, 7)}`,
    `🏷 ${eventText}`,
    `👤 ${params.actor}`,
    duration ? `⏱ ${duration}` : "",
  ].filter(Boolean).join("  ");

  return new EnhancedCardBuilder(
    { title: `${conclusionText} ${params.repoFullName} #${params.runNumber}`, theme: template as "green" | "red" | "grey" },
    "",
  )
    .text(`**${params.displayTitle}**`, true)
    .text(meta, true)
    .button("查看详情", { type: "primary", url: params.htmlUrl || `${params.appUrl}/${params.repoFullName}/actions` })
    .build() as FeishuInteractiveCard;
}

/**
 * 构建 Push 事件通知卡片。
 */
export function buildPushCard(params: {
  repoFullName: string;
  branch: string;
  pusher: string;
  commits: Array<{ id: string; message: string }>;
  compareUrl: string;
  appUrl: string;
}): FeishuInteractiveCard {
  const commitLines = params.commits
    .slice(0, 5)
    .map((c) => `\`${c.id.substring(0, 7)}\` ${c.message.split("\n")[0]}`)
    .join("\n");

  const extra = params.commits.length > 5 ? `\n...还有 ${params.commits.length - 5} 个提交` : "";

  const card = new EnhancedCardBuilder(
    { title: `📦 ${params.repoFullName} 新推送`, theme: "blue" },
    "",
  )
    .text(`🌿 **${params.branch}**  👤 ${params.pusher}`, true)
    .text(commitLines + extra, true);

  if (params.compareUrl) {
    card.button("查看对比", { url: params.compareUrl });
  }

  return card.build() as FeishuInteractiveCard;
}

/**
 * 构建 PR 创建通知卡片。
 */
export function buildPullRequestOpenedCard(params: {
  repoFullName: string;
  number: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  htmlUrl: string;
  appUrl: string;
}): FeishuInteractiveCard {
  const card = new EnhancedCardBuilder(
    { title: `🔀 ${params.repoFullName} 新 PR #${params.number}`, theme: "blue" },
    "",
  )
    .text(`**${params.title}**`, true)
    .text(`👤 ${params.author}  🌿 ${params.sourceBranch} → ${params.targetBranch}`, true)
    .button("查看 PR", { type: "primary", url: params.htmlUrl || `${params.appUrl}/${params.repoFullName}/pulls/${params.number}` });

  return card.build() as FeishuInteractiveCard;
}

/**
 * 构建 Issue 创建通知卡片。
 */
export function buildIssueOpenedCard(params: {
  repoFullName: string;
  number: number;
  title: string;
  author: string;
  htmlUrl: string;
  appUrl: string;
}): FeishuInteractiveCard {
  const card = new EnhancedCardBuilder(
    { title: `🐞 ${params.repoFullName} 新 Issue #${params.number}`, theme: "blue" },
    "",
  )
    .text(`**${params.title}**`, true)
    .text(`👤 ${params.author}`, true)
    .button("查看 Issue", { type: "primary", url: params.htmlUrl || `${params.appUrl}/${params.repoFullName}/issues/${params.number}` });

  return card.build() as FeishuInteractiveCard;
}

/**
 * 构建 Agent 运行结果通知卡片。
 */
export function buildAgentResultCard(params: {
  repoFullName: string;
  agentName: string;
  sessionId: string;
  status: "completed" | "failed" | "stopped";
  summary?: string;
  prUrl?: string;
  appUrl: string;
}): FeishuInteractiveCard {
  const statusMap = {
    completed: "✅ 完成",
    failed: "❌ 失败",
    stopped: "⏹ 已停止",
  };
  const template = params.status === "completed" ? "green" : params.status === "failed" ? "red" : "grey";

  const card = new EnhancedCardBuilder(
    { title: `🤖 Agent ${statusMap[params.status]}`, theme: template as "green" | "red" | "grey" },
    "",
  )
    .text(`**Agent**: ${params.agentName}\n**Session**: ${params.sessionId}\n**状态**: ${statusMap[params.status]}`, true);

  if (params.summary) {
    card.text(params.summary, true);
  }

  if (params.prUrl) {
    card.button("查看 PR", { type: "primary", url: params.prUrl });
  }
  card.button("查看详情", { url: `${params.appUrl}/${params.repoFullName}/agents` });

  return card.build() as FeishuInteractiveCard;
}

// ─── 通配符匹配 ─────────────────────────────────────────

/**
 * 检查字符串是否匹配通配符模式列表。
 * 空数组表示不过滤（匹配所有）。
 */
export function matchPattern(value: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => {
    if (p.includes("*")) {
      const regex = new RegExp("^" + p.replace(/\*/g, ".*") + "$");
      return regex.test(value);
    }
    return p === value;
  });
}

// ─── 规则匹配引擎 ─────────────────────────────────────────

/**
 * 根据事件类型、分支、workflow 文件名匹配 notifyRules，返回命中的 chatId 列表。
 */
export function matchRules(
  rules: NotifyRule[],
  event: RepoNotifyEvent,
  branch?: string,
  workflowFile?: string,
): string[] {
  const chatIds: string[] = [];
  for (const rule of rules) {
    if (!rule.events.includes(event)) continue;
    if (branch && !matchPattern(branch, rule.branches)) continue;
    if (workflowFile && !matchPattern(workflowFile, rule.workflows)) continue;
    chatIds.push(rule.chatId);
  }
  return [...new Set(chatIds)];
}

/**
 * 查询组织的默认通知规则（从 organizations.settings.notifyRules 获取）。
 */
async function getOrgNotifyRules(organizationId: string): Promise<NotifyRule[]> {
  try {
    const db = useDB();
    const [org] = await db
      .select({ settings: schema.organizations.settings })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1);
    const settings = (org?.settings || {}) as OrgNotifySettings;
    return settings.notifyRules || [];
  } catch {
    return [];
  }
}

/**
 * 基于通知规则分发卡片。
 * 优先级：仓库规则 → 组织默认规则 → 私信组织成员。
 */
async function dispatchByRules(
  card: FeishuInteractiveCard,
  settings: RepoNotifySettings,
  repositoryId: string,
  organizationId: string,
  event: RepoNotifyEvent,
  notifyType: NotificationType,
  branch?: string,
  workflowFile?: string,
): Promise<void> {
  let chatIds: string[] = [];

  // 1. 仓库级规则
  const repoRules = settings.notifyRules || [];
  if (repoRules.length > 0) {
    chatIds = matchRules(repoRules, event, branch, workflowFile);
  } else {
    // 2. 组织级默认规则
    const orgRules = await getOrgNotifyRules(organizationId);
    if (orgRules.length > 0) {
      chatIds = matchRules(orgRules, event, branch, workflowFile);
    }
  }

  if (chatIds.length > 0) {
    await Promise.allSettled(
      chatIds.map(async (chatId) => {
        await sendFeishuChatCardMessage(chatId, card);
        console.log(`[notification] sent to chat ${chatId}`);
      }),
    );
  } else {
    // 4. 最终 fallback：私信组织成员
    const targets = await getNotifyTargets(organizationId, notifyType, event, repositoryId);
    if (targets.length === 0) return;
    const result = await sendFeishuBatchMessage(targets, card);
    console.log(`[notification] sent=${result.sent}, failed=${result.failed}`);
  }
}

// ─── 通知对象查找 ─────────────────────────────────────────

/**
 * 获取组织内所有已绑定飞书且启用指定通知类型的用户 open_id 列表。
 */
export async function getNotifyTargets(
  organizationId: string,
  notifyType: NotificationType,
  event?: RepoNotifyEvent,
  repositoryId?: string,
): Promise<string[]> {
  const db = useDB();

  // 查找组织下所有团队的成员 user_id
  const teamRows = await db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(eq(schema.teams.organization_id, organizationId));

  if (teamRows.length === 0) return [];

  const memberRows = await db
    .select({ user_id: schema.teamMembers.user_id })
    .from(schema.teamMembers)
    .where(inArray(schema.teamMembers.team_id, teamRows.map((t) => t.id)));

  const userIds = [...new Set(memberRows.map((m) => m.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return [];

  let candidateUserIds = userIds;
  if (repositoryId && (notifyType === "publish" || notifyType === "agent")) {
    const watchRows = await db
      .select({ user_id: schema.repositoryWatches.user_id })
      .from(schema.repositoryWatches)
      .where(and(
        eq(schema.repositoryWatches.repository_id, repositoryId),
        eq(schema.repositoryWatches.watching, true),
        inArray(schema.repositoryWatches.user_id, userIds),
      ));

    candidateUserIds = [...new Set(watchRows.map((r) => r.user_id).filter(Boolean))] as string[];
    if (candidateUserIds.length === 0) return [];
  }

  const feishuBindings = await db
    .select({
      feishu_open_id: schema.userFeishu.feishu_open_id,
      user_settings: schema.users.settings,
    })
    .from(schema.userFeishu)
    .innerJoin(schema.users, eq(schema.userFeishu.user_id, schema.users.id))
    .where(
      inArray(schema.userFeishu.user_id, candidateUserIds),
    );

  const matched = feishuBindings.filter((b) => {
    const prefs = normalizeUserSettings(b.user_settings).notifyPreferences;
    if (notifyType === "approval") return prefs.personalEvents.approval;
    if (notifyType === "system") return prefs.personalEvents.system;

    if (notifyType === "publish") {
      if (event === "workflow_success") return prefs.repoEvents.workflow_success;
      if (event === "workflow_failure") return prefs.repoEvents.workflow_failure;
      if (event === "push") return prefs.repoEvents.push;
      if (event === "pr_opened") return prefs.repoEvents.pr_opened;
      if (event === "issue_opened") return prefs.repoEvents.issue_opened;
      return false;
    }

    if (notifyType === "agent") {
      if (event === "agent_completed") return prefs.repoEvents.agent_completed;
      if (event === "agent_failed") return prefs.repoEvents.agent_failed;
      return false;
    }

    return false;
  });

  return matched.map((b) => b.feishu_open_id);
}

// ─── 通知发送入口 ─────────────────────────────────────────

/**
 * 发送 Workflow Run 完成通知。
 * 基于 notifyRules 匹配事件 + 分支 + workflow 进行分发。
 */
export async function notifyWorkflowRunComplete(
  ctx: NotifyContext,
  run: {
    run_number: number;
    display_title: string;
    conclusion: string;
    event: string;
    head_branch: string;
    head_sha: string;
    actor: string;
    started_at: string;
    completed_at: string | null;
    html_url: string;
    workflow_name?: string;
  },
  repoSettings: RepoNotifySettings,
): Promise<void> {
  const normalizedConclusion = String(run.conclusion || "").toLowerCase();
  const isSuccess = normalizedConclusion === "success";
  const isFailure = normalizedConclusion === "failure";

  if (isSuccess && repoSettings.notifyOnSuccess === false) return;
  if (isFailure && repoSettings.notifyOnFailure === false) return;
  if (!isSuccess && !isFailure) return;

  const event: RepoNotifyEvent = isSuccess ? "workflow_success" : "workflow_failure";

  try {
    const config = useRuntimeConfig();
    const card = buildWorkflowRunCard({
      ...run,
      repoFullName: ctx.repoFullName,
      runNumber: run.run_number,
      displayTitle: run.display_title,
      conclusion: normalizedConclusion,
      headBranch: run.head_branch,
      headSha: run.head_sha,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      htmlUrl: run.html_url,
      appUrl: config.public.appUrl,
    });

    await dispatchByRules(
      card, repoSettings, ctx.repositoryId, ctx.organizationId, event, "publish",
      run.head_branch, run.workflow_name,
    );
  } catch (err) {
    console.error("[notification] Failed to send workflow run notification:", err);
  }
}

/**
 * 发送 Push 事件通知。
 */
export async function notifyPushEvent(
  ctx: NotifyContext,
  push: {
    branch: string;
    pusher: string;
    commits: Array<{ id: string; message: string }>;
    compareUrl: string;
  },
  repoSettings: RepoNotifySettings = {},
): Promise<void> {
  try {
    const config = useRuntimeConfig();
    const card = buildPushCard({
      repoFullName: ctx.repoFullName,
      branch: push.branch,
      pusher: push.pusher,
      commits: push.commits,
      compareUrl: push.compareUrl,
      appUrl: config.public.appUrl,
    });

    await dispatchByRules(
      card, repoSettings, ctx.repositoryId, ctx.organizationId, "push", "publish",
      push.branch,
    );
  } catch (err) {
    console.error("[notification] Failed to send push notification:", err);
  }
}

/**
 * 发送 PR 创建通知。
 */
export async function notifyPullRequestOpened(
  ctx: NotifyContext,
  pr: {
    number: number;
    title: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    htmlUrl: string;
  },
  repoSettings: RepoNotifySettings = {},
): Promise<void> {
  try {
    const config = useRuntimeConfig();
    const card = buildPullRequestOpenedCard({
      repoFullName: ctx.repoFullName,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      htmlUrl: pr.htmlUrl,
      appUrl: config.public.appUrl,
    });

    await dispatchByRules(
      card, repoSettings, ctx.repositoryId, ctx.organizationId, "pr_opened", "publish",
      pr.targetBranch,
    );
  } catch (err) {
    console.error("[notification] Failed to send pull request notification:", err);
  }
}

/**
 * 发送 Issue 创建通知。
 */
export async function notifyIssueOpened(
  ctx: NotifyContext,
  issue: {
    number: number;
    title: string;
    author: string;
    htmlUrl: string;
  },
  repoSettings: RepoNotifySettings = {},
): Promise<void> {
  try {
    const config = useRuntimeConfig();
    const card = buildIssueOpenedCard({
      repoFullName: ctx.repoFullName,
      number: issue.number,
      title: issue.title,
      author: issue.author,
      htmlUrl: issue.htmlUrl,
      appUrl: config.public.appUrl,
    });

    await dispatchByRules(
      card, repoSettings, ctx.repositoryId, ctx.organizationId, "issue_opened", "publish",
    );
  } catch (err) {
    console.error("[notification] Failed to send issue notification:", err);
  }
}

/**
 * 发送 Agent 运行结果通知。
 */
export async function notifyAgentResult(
  ctx: NotifyContext,
  agent: {
    agentName: string;
    sessionId: string;
    status: "completed" | "failed" | "stopped";
    summary?: string;
    prUrl?: string;
  },
  repoSettings: RepoNotifySettings = {},
): Promise<void> {
  const eventMap: Record<string, RepoNotifyEvent> = {
    completed: "agent_completed",
    failed: "agent_failed",
    stopped: "agent_failed",
  };
  const event = eventMap[agent.status] || "agent_completed";

  try {
    const config = useRuntimeConfig();
    const card = buildAgentResultCard({
      repoFullName: ctx.repoFullName,
      ...agent,
      appUrl: config.public.appUrl,
    });

    await dispatchByRules(
      card, repoSettings, ctx.repositoryId, ctx.organizationId, event, "agent",
    );
  } catch (err) {
    console.error("[notification] Failed to send agent notification:", err);
  }
}
