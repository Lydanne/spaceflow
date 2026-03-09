import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  replyFeishuMessage,
  replyFeishuCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/services/messaging";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { startWorkflowAction } from "~~/server/services/workflow-action-machine";

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

// ─── /actions <owner/repo> ──────────────────────────────

registerCommand({
  name: "actions",
  aliases: ["/actions", "工作流"],
  description: "触发仓库工作流(交互式)",
  usage: "/actions <owner/repo>",
  handler: async (ctx, args) => {
    const repoFullName = args[0];
    if (!repoFullName || !repoFullName.includes("/")) {
      await replyFeishuMessage(ctx.messageId, "用法: /actions <owner/repo>\n例如: /actions myorg/myrepo");
      return;
    }

    try {
      const card = await startWorkflowAction({
        messageId: ctx.messageId,
        openId: ctx.senderOpenId,
        repoFullName,
      });

      await replyFeishuCardMessage(ctx.messageId, card);
    } catch (err) {
      console.error("[bot-command] actions error:", err);
      const msg = (err as Error).message || "获取工作流列表失败,请稍后重试";
      await replyFeishuMessage(ctx.messageId, `❌ ${msg}`);
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

// ─── 卡片交互处理 ─────────────────────────────────────────

export interface CardActionContext {
  action: Record<string, unknown>;
  openId: string;
  token: string;
}

export async function handleCardAction(ctx: CardActionContext): Promise<void> {
  const actionValue = ctx.action.value as Record<string, unknown> | undefined;
  const actionType = actionValue?.action as string | undefined;

  // 检查是否是控制面板的交互
  const controlPanelActions = [
    "select_org",
    "select_repo",
    "back_to_home",
    "back_to_org",
    "open_actions",
    "open_agents",
    "open_pages",
    "open_settings",
  ];

  if (actionType && actionValue && controlPanelActions.includes(actionType)) {
    const { handleControlPanelAction } = await import("~~/server/services/control-panel.service");
    const { updateCardMessage } = await import("~~/server/utils/feishu-sdk");

    const newCard = await handleControlPanelAction(ctx.openId, actionValue as Record<string, unknown>);
    if (newCard) {
      await updateCardMessage(ctx.token, newCard);
    }
    return;
  }

  // 否则调用状态机处理其他卡片交互
  const { routeCardAction } = await import("~~/server/utils/card-state-machine");
  await routeCardAction({
    action: ctx.action,
    openId: ctx.openId,
  });
}

// ─── 指令分发 ─────────────────────────────────────────────

export async function handleBotCommand(ctx: BotCommandContext): Promise<void> {
  const text = ctx.text.trim();

  // 如果只是 @ 机器人,没有输入任何内容,显示控制面板
  if (!text || text === "") {
    const { generateControlPanelHome } = await import("~~/server/services/control-panel.service");
    const card = await generateControlPanelHome(ctx.senderOpenId);
    await replyFeishuCardMessage(ctx.messageId, card);
    return;
  }

  const parts = text.split(/\s+/);
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
      await replyFeishuMessage(ctx.messageId, "❌ 指令执行失败,请稍后重试");
    }
  } else {
    // 未知指令,显示帮助
    const helpCmd = commands.find((c) => c.name === "help");
    if (helpCmd) {
      await helpCmd.handler(ctx, []);
    } else {
      await replyFeishuMessage(ctx.messageId, "❌ 未知指令,请使用 /help 查看可用指令");
    }
  }
}
