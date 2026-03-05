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
    .from(schema.projects)
    .where(eq(schema.projects.giteaRepoId, repoId))
    .limit(1);

  // 验证签名：无论项目是否存在都返回统一的 401，避免泄漏项目存在性
  if (!project?.webhookSecret || !verifyWebhookSignature(body, project.webhookSecret, signature)) {
    throw createError({ statusCode: 401, message: "Invalid webhook signature" });
  }

  // 处理 push 事件
  if (giteaEvent === "push") {
    const branch = payload.ref.replace("refs/heads/", "");
    const commitSha = payload.after;
    const commitMessage = payload.commits?.[0]?.message || "";

    // 查找 pusher 对应的用户
    const [pusherUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.giteaId, payload.pusher.id))
      .limit(1);

    // 检查项目设置是否允许自动部署
    const settings = (project.settings || {}) as {
      autoDeploy?: boolean;
      deployBranches?: string[];
    };

    if (settings.autoDeploy) {
      const deployBranches = settings.deployBranches || [project.defaultBranch || "main"];
      if (deployBranches.includes(branch)) {
        // 创建发布任务
        const [task] = await db
          .insert(schema.publishTasks)
          .values({
            projectId: project.id,
            branch,
            commitSha,
            commitMessage,
            triggeredBy: pusherUser?.id ?? null,
            triggerType: "webhook",
            status: "pending",
          })
          .returning();

        return { received: true, action: "publish_created", taskId: task?.id };
      }
    }

    return {
      received: true,
      action: "ignored",
      reason: "auto_deploy_disabled_or_branch_not_matched",
    };
  }

  return { received: true, action: "ignored", reason: `unhandled_event_${giteaEvent}` };
});
