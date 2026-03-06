import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { verifyWebhookSignature } from "~~/server/utils/webhook-verify";
import {
  notifyPushEvent,
  notifyWorkflowRunComplete,
  type NotifyContext,
  type RepoNotifySettings,
} from "~~/server/services/notification.service";

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

  const signature = getRequestHeader(event, "x-gitea-signature");
  if (!signature) {
    throw createError({ statusCode: 401, message: "Missing webhook signature" });
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

  // 验证签名：无论项目是否存在都返回统一的 401，避免泄漏项目存在性
  if (!project?.webhook_secret || !verifyWebhookSignature(body, project.webhook_secret, signature)) {
    throw createError({ statusCode: 401, message: "Invalid webhook signature" });
  }

  const settings = (project.settings || {}) as RepoNotifySettings;

  const [owner, repoName] = project.full_name.split("/");
  const ctx: NotifyContext = {
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

  // ─── workflow_run 事件（构建完成通知） ──────────────────
  if (giteaEvent === "workflow_run" && payload.workflow_run && payload.action === "completed") {
    const run = payload.workflow_run;

    // 异步发送通知，不阻塞 webhook 响应
    // 从 path 提取 workflow 文件名（如 .gitea/workflows/deploy.yml → deploy.yml）
    const workflowName = run.path ? run.path.split("/").pop() : undefined;

    notifyWorkflowRunComplete(ctx, {
      run_number: run.run_number,
      display_title: run.display_title,
      conclusion: run.conclusion,
      event: run.event,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      actor: run.actor?.login || "unknown",
      started_at: run.started_at,
      completed_at: run.completed_at,
      html_url: run.html_url,
      workflow_name: workflowName,
    }, settings).catch((err) => console.error("[webhook] workflow_run notify error:", err));

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
