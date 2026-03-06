import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  replyFeishuMessage,
  replyFeishuCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/utils/feishu";
import { createServiceGiteaClient } from "~~/server/utils/gitea";

// ─── 指令上下文 ─────────────────────────────────────────

export interface BotCommandContext {
  messageId: string;
  chatId: string;
  chatType: string;
  senderOpenId: string;
  text: string;
}

// ─── 指令定义 ─────────────────────────────────────────────

interface CommandDef {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (ctx: BotCommandContext, args: string[]) => Promise<void>;
}

const commands: CommandDef[] = [];

function registerCommand(cmd: CommandDef) {
  commands.push(cmd);
}

// ─── /help ────────────────────────────────────────────────

registerCommand({
  name: "help",
  aliases: ["/help", "帮助"],
  description: "查看所有可用指令",
  usage: "/help",
  handler: async (ctx) => {
    const lines = commands.map(
      (c) => `**${c.usage}** — ${c.description}`,
    );
    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: "🤖 Teax Bot 帮助" },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: lines.join("\n"),
          },
        },
      ],
    };
    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── /status <owner/repo> ────────────────────────────────

registerCommand({
  name: "status",
  aliases: ["/status", "状态"],
  description: "查询仓库最近构建状态",
  usage: "/status <owner/repo>",
  handler: async (ctx, args) => {
    const repoFullName = args[0];
    if (!repoFullName || !repoFullName.includes("/")) {
      await replyFeishuMessage(ctx.messageId, "用法: /status <owner/repo>\n例如: /status myorg/myrepo");
      return;
    }

    const parts = repoFullName.split("/");
    const owner = parts[0] || "";
    const repo = parts[1] || "";

    // 验证用户权限：检查发送者是否绑定了 Teax 账号
    const db = useDB();
    const [binding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.senderOpenId))
      .limit(1);

    if (!binding?.user_id) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 验证仓库是否在 Teax 中注册
    const [repoRecord] = await db
      .select({ id: schema.repositories.id, full_name: schema.repositories.full_name })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, repoFullName))
      .limit(1);

    if (!repoRecord) {
      await replyFeishuMessage(ctx.messageId, `❌ 仓库 ${repoFullName} 未在 Teax 中注册`);
      return;
    }

    try {
      const gitea = await createServiceGiteaClient();
      const result = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
      const runs = result.workflow_runs || [];

      if (runs.length === 0) {
        await replyFeishuMessage(ctx.messageId, `📋 ${repoFullName} 暂无构建记录`);
        return;
      }

      const conclusionEmoji: Record<string, string> = {
        success: "✅",
        failure: "❌",
        cancelled: "⚫",
        skipped: "⏭",
      };

      const statusEmoji: Record<string, string> = {
        running: "🔄",
        queued: "⏳",
        waiting: "⏳",
      };

      const lines = runs.map((r) => {
        const emoji = r.conclusion
          ? (conclusionEmoji[r.conclusion] || "❓")
          : (statusEmoji[r.status] || "❓");
        const branch = r.head_branch || "?";
        return `${emoji} #${r.run_number} **${r.display_title}** (${branch})`;
      });

      const card: FeishuInteractiveCard = {
        header: {
          title: { tag: "plain_text", content: `📋 ${repoFullName} 构建状态` },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: lines.join("\n"),
            },
          },
        ],
      };

      await replyFeishuCardMessage(ctx.messageId, card);
    } catch (err) {
      console.error("[bot-command] status error:", err);
      await replyFeishuMessage(ctx.messageId, "❌ 查询构建状态失败，请稍后重试");
    }
  },
});

// ─── /deploy <owner/repo> [branch] [workflow] ────────────

registerCommand({
  name: "deploy",
  aliases: ["/deploy", "部署"],
  description: "触发仓库部署（workflow dispatch）",
  usage: "/deploy <owner/repo> [branch] [workflow]",
  handler: async (ctx, args) => {
    const repoFullName = args[0];
    if (!repoFullName || !repoFullName.includes("/")) {
      await replyFeishuMessage(ctx.messageId, "用法: /deploy <owner/repo> [branch] [workflow]\n例如: /deploy myorg/myrepo main deploy.yml");
      return;
    }

    const deployParts = repoFullName.split("/");
    const owner = deployParts[0] || "";
    const repo = deployParts[1] || "";

    // 验证用户绑定
    const db = useDB();
    const [binding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.senderOpenId))
      .limit(1);

    if (!binding?.user_id) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 验证仓库
    const [repoRecord] = await db
      .select({
        id: schema.repositories.id,
        full_name: schema.repositories.full_name,
        default_branch: schema.repositories.default_branch,
        settings: schema.repositories.settings,
      })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, repoFullName))
      .limit(1);

    if (!repoRecord) {
      await replyFeishuMessage(ctx.messageId, `❌ 仓库 ${repoFullName} 未在 Teax 中注册`);
      return;
    }

    const branch = args[1] || repoRecord.default_branch || "main";
    const workflowFile = args[2] || "deploy.yml";

    // 审批前置检查
    const repoSettings = (repoRecord.settings || {}) as Record<string, unknown>;
    if (repoSettings.approvalRequired) {
      const card: FeishuInteractiveCard = {
        header: {
          title: { tag: "plain_text", content: "⚠️ 需要审批" },
          template: "orange",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `**仓库**: ${repoFullName}\n**分支**: ${branch}\n**Workflow**: ${workflowFile}\n\n该仓库已开启部署审批，请在 Teax 中发起审批后再部署。`,
            },
          },
        ],
      };
      await replyFeishuCardMessage(ctx.messageId, card);
      return;
    }

    try {
      const gitea = await createServiceGiteaClient();
      await gitea.dispatchWorkflow(owner, repo, workflowFile, branch);

      const card: FeishuInteractiveCard = {
        header: {
          title: { tag: "plain_text", content: `🚀 部署已触发` },
          template: "green",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `**仓库**: ${repoFullName}\n**分支**: ${branch}\n**Workflow**: ${workflowFile}`,
            },
          },
        ],
      };

      await replyFeishuCardMessage(ctx.messageId, card);
    } catch (err) {
      console.error("[bot-command] deploy error:", err);
      const msg = (err as { data?: { message?: string } })?.data?.message || "触发部署失败";
      await replyFeishuMessage(ctx.messageId, `❌ ${msg}\n请检查 workflow 文件是否存在且分支名是否正确`);
    }
  },
});

// ─── /rollback <owner/repo> [branch] ─────────────────────

registerCommand({
  name: "rollback",
  aliases: ["/rollback", "回滚"],
  description: "触发回滚 workflow",
  usage: "/rollback <owner/repo> [branch]",
  handler: async (ctx, args) => {
    const repoFullName = args[0];
    if (!repoFullName || !repoFullName.includes("/")) {
      await replyFeishuMessage(ctx.messageId, "用法: /rollback <owner/repo> [branch]\n例如: /rollback myorg/myrepo main");
      return;
    }

    const rollbackParts = repoFullName.split("/");
    const owner = rollbackParts[0] || "";
    const repo = rollbackParts[1] || "";

    // 验证用户绑定
    const db = useDB();
    const [binding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.senderOpenId))
      .limit(1);

    if (!binding?.user_id) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 验证仓库
    const [repoRecord] = await db
      .select({
        id: schema.repositories.id,
        default_branch: schema.repositories.default_branch,
      })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, repoFullName))
      .limit(1);

    if (!repoRecord) {
      await replyFeishuMessage(ctx.messageId, `❌ 仓库 ${repoFullName} 未在 Teax 中注册`);
      return;
    }

    const branch = args[1] || repoRecord.default_branch || "main";

    try {
      const gitea = await createServiceGiteaClient();
      await gitea.dispatchWorkflow(owner, repo, "rollback.yml", branch);

      const card: FeishuInteractiveCard = {
        header: {
          title: { tag: "plain_text", content: `⏪ 回滚已触发` },
          template: "orange",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `**仓库**: ${repoFullName}\n**分支**: ${branch}\n**Workflow**: rollback.yml`,
            },
          },
        ],
      };

      await replyFeishuCardMessage(ctx.messageId, card);
    } catch (err) {
      console.error("[bot-command] rollback error:", err);
      const msg = (err as { data?: { message?: string } })?.data?.message || "触发回滚失败";
      await replyFeishuMessage(ctx.messageId, `❌ ${msg}\n请检查 rollback.yml 是否存在`);
    }
  },
});

// ─── /list [orgName] ─────────────────────────────────────

registerCommand({
  name: "list",
  aliases: ["/list", "列表"],
  description: "列出组织下已注册的仓库",
  usage: "/list [orgName]",
  handler: async (ctx, args) => {
    const orgName = args[0];

    const db = useDB();

    // 验证用户绑定
    const [binding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.senderOpenId))
      .limit(1);

    if (!binding?.user_id) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    let repos;
    if (orgName) {
      // 查找指定组织的仓库
      const [org] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.name, orgName))
        .limit(1);

      if (!org) {
        await replyFeishuMessage(ctx.messageId, `❌ 未找到组织 ${orgName}`);
        return;
      }

      repos = await db
        .select({ full_name: schema.repositories.full_name })
        .from(schema.repositories)
        .where(eq(schema.repositories.organization_id, org.id))
        .limit(20);
    } else {
      repos = await db
        .select({ full_name: schema.repositories.full_name })
        .from(schema.repositories)
        .limit(20);
    }

    if (repos.length === 0) {
      await replyFeishuMessage(ctx.messageId, orgName ? `📋 组织 ${orgName} 下暂无已注册仓库` : "📋 暂无已注册仓库");
      return;
    }

    const lines = repos.map((r) => `• ${r.full_name}`);
    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: orgName ? `📋 ${orgName} 仓库列表` : "📋 仓库列表" },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: lines.join("\n"),
          },
        },
      ],
    };

    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── 指令分发 ─────────────────────────────────────────────

export async function handleBotCommand(ctx: BotCommandContext): Promise<void> {
  const parts = ctx.text.trim().split(/\s+/);
  const cmdText = parts[0]?.toLowerCase() || "";
  const args = parts.slice(1);

  // 匹配指令
  const matched = commands.find(
    (c) => c.aliases.some((a) => a.toLowerCase() === cmdText),
  );

  if (matched) {
    try {
      await matched.handler(ctx, args);
    } catch (err) {
      console.error(`[bot-command] ${matched.name} error:`, err);
      await replyFeishuMessage(ctx.messageId, "❌ 指令执行出错，请稍后重试").catch(() => {});
    }
    return;
  }

  // 未匹配到指令时返回帮助提示
  await replyFeishuMessage(
    ctx.messageId,
    `🤖 不认识的指令: ${cmdText}\n发送 /help 查看可用指令`,
  );
}
