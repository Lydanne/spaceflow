import { eq } from "drizzle-orm";
import { useDB, schema } from "../../db";
import { verifyWebhookSignature } from "../../utils/webhook-verify";

interface GiteaPushPayload {
  ref: string;
  before: string;
  after: string;
  compare_url: string;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
  }>;
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  pusher: {
    id: number;
    login: string;
    email: string;
  };
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

  // 解析 payload 获取 repo id，查找对应项目
  let payload: GiteaPushPayload;
  try {
    payload = JSON.parse(body) as GiteaPushPayload;
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

  // 处理 push 事件 — CI/CD 由 Gitea Actions 原生处理，这里只做通知
  if (giteaEvent === "push") {
    const branch = payload.ref.replace("refs/heads/", "");
    const _settings = (project.settings || {}) as {
      notifyOnSuccess?: boolean;
      notifyOnFailure?: boolean;
    };

    // TODO: 飞书通知 — push 事件时可发送飞书消息通知团队
    // if (settings.notifyOnSuccess || settings.notifyOnFailure) {
    //   await sendFeishuNotification(project, branch, payload);
    // }

    return {
      received: true,
      action: "notified",
      branch,
      project: project.full_name,
    };
  }

  return { received: true, action: "ignored", reason: `unhandled_event_${giteaEvent}` };
});
