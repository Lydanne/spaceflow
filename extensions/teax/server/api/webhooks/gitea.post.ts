import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { verifyWebhookSignature } from "~~/server/utils/webhook-verify";
import {
  notifyIssueOpened,
  notifyPullRequestOpened,
  notifyPushEvent,
  notifyWorkflowRunComplete,
  type NotifyContext,
} from "~~/server/services/notification.service";
import { clearCurrentRunId } from "~~/server/services/preset-queue.service";
import type { RepoNotifySettings } from "~~/shared/notify-rules";

function normalizeWebhookSignature(input: string | undefined): string {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (lower.startsWith("sha256=")) return raw.slice(7).trim();

  return raw;
}

interface GiteaWebhookPayload {
  ref?: string;
  before?: string;
  after?: string;
  compare_url?: string;
  commits?: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
    timestamp: string;
  }>;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner?: { login: string };
  };
  sender?: { id: number; login: string; email?: string };
  pusher?: { id: number; login: string; email: string };
  pull_request?: {
    number: number;
    title: string;
    html_url: string;
    user?: { login: string };
    head?: { ref: string };
    base?: { ref: string };
  };
  issue?: {
    number: number;
    title: string;
    html_url: string;
    user?: { login: string };
  };
  workflow_run?: {
    id: number;
    run_number: number;
    display_title: string;
    status: string;
    conclusion: string;
    event: string;
    head_branch: string;
    head_sha: string;
    path: string;
    html_url: string;
    started_at: string;
    completed_at: string | null;
    actor: { id: number; login: string; avatar_url: string };
  };
  action?: string;
}

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event, "utf-8");
  if (!body) {
    throw createError({ statusCode: 400, message: "Empty request body" });
  }

  const signature = normalizeWebhookSignature(
    getRequestHeader(event, "x-gitea-signature")
    || getRequestHeader(event, "x-hub-signature-256")
    || "",
  );
  if (!signature) {
    throw createError({
      statusCode: 401,
      message: "Missing webhook signature (check webhook secret configuration)",
    });
  }

  const giteaEvent = getRequestHeader(event, "x-gitea-event");

  let payload: GiteaWebhookPayload;
  try {
    payload = JSON.parse(body) as GiteaWebhookPayload;
  } catch {
    throw createError({ statusCode: 400, message: "Invalid JSON payload" });
  }

  const db = useDB();
  const repoId = payload.repository?.id;

  if (!repoId) {
    throw createError({ statusCode: 400, message: "Missing repository id in payload" });
  }

  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.gitea_repo_id, repoId))
    .limit(1);

  const config = useRuntimeConfig();
  // const webhookSecret = project?.webhook_secret || config.giteaWebhookSecret;
  const webhookSecret = config.giteaWebhookSecret; // TIP: 暂时统一使用全局 webhook secret，避免项目泄漏风险

  // 验证签名：无论项目是否存在都返回统一的 401，避免泄漏项目存在性
  if (!webhookSecret || !verifyWebhookSignature(body, webhookSecret, signature)) {
    throw createError({
      statusCode: 401,
      message: "Invalid webhook signature (missing/mismatched webhook secret)",
    });
  }
  if (!project) {
    throw createError({ statusCode: 401, message: "Invalid webhook signature" });
  }

  const settings = (project.settings || {}) as RepoNotifySettings;

  const [owner, repoName] = project.full_name.split("/");
  const ctx: NotifyContext = {
    repositoryId: project.id,
    organizationId: project.organization_id,
    repoFullName: project.full_name,
    repoOwner: owner || "",
    repoName: repoName || "",
  };

  // ─── push 事件 ────────────────────────────────────────
  if (giteaEvent === "push" && payload.ref) {
    const branch = payload.ref.replace("refs/heads/", "");

    // 异步发送通知，不阻塞 webhook 响应
    notifyPushEvent(ctx, {
      branch,
      pusher: payload.pusher?.login || payload.sender?.login || "unknown",
      commits: (payload.commits || []).map((c) => ({ id: c.id, message: c.message })),
      compareUrl: payload.compare_url || "",
    }, settings).catch((err) => console.error("[webhook] push notify error:", err));

    return {
      received: true,
      action: "notified",
      branch,
      project: project.full_name,
    };
  }

  // ─── pull_request 事件（PR 创建通知）──────────────────
  if (giteaEvent === "pull_request" && payload.action === "opened" && payload.pull_request) {
    const pr = payload.pull_request;

    notifyPullRequestOpened(ctx, {
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || payload.sender?.login || "unknown",
      sourceBranch: pr.head?.ref || "unknown",
      targetBranch: pr.base?.ref || "unknown",
      htmlUrl: pr.html_url || "",
    }, settings).catch((err) => console.error("[webhook] pull request notify error:", err));

    return {
      received: true,
      action: "notified",
      prNumber: pr.number,
      project: project.full_name,
    };
  }

  // ─── issues 事件（Issue 创建通知）──────────────────────
  if (giteaEvent === "issues" && payload.action === "opened" && payload.issue) {
    const issue = payload.issue;

    notifyIssueOpened(ctx, {
      number: issue.number,
      title: issue.title,
      author: issue.user?.login || payload.sender?.login || "unknown",
      htmlUrl: issue.html_url || "",
    }, settings).catch((err) => console.error("[webhook] issue notify error:", err));

    return {
      received: true,
      action: "notified",
      issueNumber: issue.number,
      project: project.full_name,
    };
  }

  // ─── workflow_run 事件（构建完成通知） ──────────────────
  if (giteaEvent === "workflow_run" && payload.workflow_run) {
    const run = payload.workflow_run;
    const action = String(payload.action || "").toLowerCase();
    const status = String(run.status || "").toLowerCase();
    const conclusion = String(run.conclusion || "").toLowerCase();

    // 兼容不同 Gitea 版本：
    // - 有些版本使用 payload.action === "completed"
    // - 有些版本只在 workflow_run.status/conclusion 中体现完成态
    const isCompleted = action === "completed"
      || status === "completed"
      || [
        "success",
        "failure",
        "cancelled",
        "skipped",
        "neutral",
        "timed_out",
        "action_required",
      ].includes(conclusion);

    if (!isCompleted) {
      return { received: true, action: "ignored", reason: `workflow_run_not_completed_${action || status || "unknown"}` };
    }

    // 异步发送通知，不阻塞 webhook 响应
    // 从 path 提取 workflow 文件名（如 .gitea/workflows/deploy.yml → deploy.yml）
    const workflowName = run.path ? run.path.split("/").pop() : undefined;

    notifyWorkflowRunComplete(ctx, {
      run_number: run.run_number,
      display_title: run.display_title,
      conclusion,
      event: run.event,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      actor: run.actor?.login || "unknown",
      started_at: run.started_at,
      completed_at: run.completed_at,
      html_url: run.html_url,
      workflow_name: workflowName,
    }, settings).catch((err) => console.error("[webhook] workflow_run notify error:", err));

    // 清理 current_run_id，如果 queue_enabled 则同时 complete 对应的 queue item（内部自动 triggerNext）
    clearCurrentRunId(run.id).then((workflowKey) => {
      if (workflowKey) {
        console.log(`[webhook] Cleared current_run_id for run ${run.id}, workflow ${workflowKey.workflowPath}`);
      }
    }).catch((err) => console.error("[webhook] Failed to clear current_run_id:", err));

    return {
      received: true,
      action: "notified",
      conclusion: run.conclusion,
      runNumber: run.run_number,
      project: project.full_name,
    };
  }

  return { received: true, action: "ignored", reason: `unhandled_event_${giteaEvent}` };
});
