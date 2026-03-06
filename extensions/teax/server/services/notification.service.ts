import { eq, and, inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  sendFeishuBatchMessage,
  type FeishuInteractiveCard,
} from "~~/server/utils/feishu";

// ─── 通知类型 ─────────────────────────────────────────────

export type NotificationType = "publish" | "approval" | "agent" | "system";

export interface NotifyContext {
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
  const isSuccess = params.conclusion === "success";
  const conclusionMap: Record<string, string> = {
    success: "✅ 成功",
    failure: "❌ 失败",
    cancelled: "⚫ 已取消",
    skipped: "⏭ 已跳过",
  };
  const conclusionText = conclusionMap[params.conclusion] || params.conclusion;
  const template = isSuccess ? "green" : params.conclusion === "failure" ? "red" : "grey";

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

  return {
    header: {
      title: { tag: "plain_text", content: `${conclusionText} ${params.repoFullName} #${params.runNumber}` },
      template,
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**${params.displayTitle}**`,
        },
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: [
            `🌿 ${params.headBranch}`,
            `📝 ${params.headSha.substring(0, 7)}`,
            `🏷 ${eventText}`,
            `👤 ${params.actor}`,
            duration ? `⏱ ${duration}` : "",
          ].filter(Boolean).join("  "),
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "查看详情" },
            url: params.htmlUrl || `${params.appUrl}/${params.repoFullName}/actions`,
            type: "primary",
          },
        ],
      },
    ],
  };
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

  return {
    header: {
      title: { tag: "plain_text", content: `📦 ${params.repoFullName} 新推送` },
      template: "blue",
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `🌿 **${params.branch}**  👤 ${params.pusher}`,
        },
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: commitLines + extra,
        },
      },
      ...(params.compareUrl
        ? [{
            tag: "action" as const,
            actions: [
              {
                tag: "button" as const,
                text: { tag: "plain_text" as const, content: "查看对比" },
                url: params.compareUrl,
                type: "default" as const,
              },
            ],
          }]
        : []),
    ],
  };
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

  const elements: FeishuInteractiveCard["elements"] = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**Agent**: ${params.agentName}\n**Session**: ${params.sessionId}\n**状态**: ${statusMap[params.status]}`,
      },
    },
  ];

  if (params.summary) {
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: params.summary,
      },
    });
  }

  const actions: Array<{ tag: string; text: { tag: string; content: string }; url: string; type: string }> = [];
  if (params.prUrl) {
    actions.push({
      tag: "button",
      text: { tag: "plain_text", content: "查看 PR" },
      url: params.prUrl,
      type: "primary",
    });
  }
  actions.push({
    tag: "button",
    text: { tag: "plain_text", content: "查看详情" },
    url: `${params.appUrl}/${params.repoFullName}/agents`,
    type: "default",
  });

  elements.push({ tag: "action", actions });

  return {
    header: {
      title: { tag: "plain_text", content: `🤖 ${params.repoFullName} Agent ${statusMap[params.status]}` },
      template,
    },
    elements,
  };
}

// ─── 通知对象查找 ─────────────────────────────────────────

/**
 * 获取组织内所有已绑定飞书且启用指定通知类型的用户 open_id 列表。
 */
export async function getNotifyTargets(
  organizationId: string,
  notifyType: NotificationType,
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

  // 查找已绑定飞书且启用通知的用户
  const notifyColumn = {
    publish: schema.userFeishu.notify_publish,
    approval: schema.userFeishu.notify_approval,
    agent: schema.userFeishu.notify_agent,
    system: schema.userFeishu.notify_system,
  }[notifyType];

  const feishuBindings = await db
    .select({ feishu_open_id: schema.userFeishu.feishu_open_id })
    .from(schema.userFeishu)
    .where(
      and(
        inArray(schema.userFeishu.user_id, userIds),
        eq(notifyColumn, true),
      ),
    );

  return feishuBindings.map((b) => b.feishu_open_id);
}

// ─── 通知发送入口 ─────────────────────────────────────────

/**
 * 发送 Workflow Run 完成通知到组织成员。
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
  },
  repoSettings: { notifyOnSuccess?: boolean; notifyOnFailure?: boolean },
): Promise<void> {
  const isSuccess = run.conclusion === "success";
  const isFailure = run.conclusion === "failure";

  // 根据项目设置判断是否发送
  if (isSuccess && !repoSettings.notifyOnSuccess) return;
  if (isFailure && !repoSettings.notifyOnFailure) return;
  if (!isSuccess && !isFailure) return;

  try {
    const targets = await getNotifyTargets(ctx.organizationId, "publish");
    if (targets.length === 0) return;

    const config = useRuntimeConfig();
    const card = buildWorkflowRunCard({
      ...run,
      repoFullName: ctx.repoFullName,
      runNumber: run.run_number,
      displayTitle: run.display_title,
      headBranch: run.head_branch,
      headSha: run.head_sha,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      htmlUrl: run.html_url,
      appUrl: config.public.appUrl,
    });

    const result = await sendFeishuBatchMessage(targets, card);
    console.log(`[notification] workflow run #${run.run_number}: sent=${result.sent}, failed=${result.failed}`);
  } catch (err) {
    console.error("[notification] Failed to send workflow run notification:", err);
  }
}

/**
 * 发送 Push 事件通知到组织成员。
 */
export async function notifyPushEvent(
  ctx: NotifyContext,
  push: {
    branch: string;
    pusher: string;
    commits: Array<{ id: string; message: string }>;
    compareUrl: string;
  },
): Promise<void> {
  try {
    const targets = await getNotifyTargets(ctx.organizationId, "publish");
    if (targets.length === 0) return;

    const config = useRuntimeConfig();
    const card = buildPushCard({
      repoFullName: ctx.repoFullName,
      branch: push.branch,
      pusher: push.pusher,
      commits: push.commits,
      compareUrl: push.compareUrl,
      appUrl: config.public.appUrl,
    });

    const result = await sendFeishuBatchMessage(targets, card);
    console.log(`[notification] push event: sent=${result.sent}, failed=${result.failed}`);
  } catch (err) {
    console.error("[notification] Failed to send push notification:", err);
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
): Promise<void> {
  try {
    const targets = await getNotifyTargets(ctx.organizationId, "agent");
    if (targets.length === 0) return;

    const config = useRuntimeConfig();
    const card = buildAgentResultCard({
      repoFullName: ctx.repoFullName,
      ...agent,
      appUrl: config.public.appUrl,
    });

    const result = await sendFeishuBatchMessage(targets, card);
    console.log(`[notification] agent result: sent=${result.sent}, failed=${result.failed}`);
  } catch (err) {
    console.error("[notification] Failed to send agent notification:", err);
  }
}
