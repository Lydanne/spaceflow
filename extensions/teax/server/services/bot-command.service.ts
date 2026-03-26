import { bindRoute } from "~~/server/card-kit";

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
  handler: bindRoute("help"),
});

// ─── /account ─────────────────────────────────────────────

registerCommand({
  name: "account",
  aliases: ["/account", "账户", "我的账户"],
  description: "查看账户信息和飞书绑定状态",
  usage: "/account",
  handler: bindRoute("account-home"),
});

// ─── /status <owner/repo> ────────────────────────────────

registerCommand({
  name: "status",
  aliases: ["/status", "状态"],
  description: "查询仓库最近构建状态",
  usage: "/status <owner/repo>",
  handler: bindRoute("status", (args) => {
    const repoFullName = args[0];
    if (!repoFullName?.includes("/")) return undefined;
    return { repoFullName };
  }),
});

// ─── /actions <owner/repo> ──────────────────────────────

registerCommand({
  name: "actions",
  aliases: ["/actions", "工作流"],
  description: "触发仓库工作流(交互式)",
  usage: "/actions <owner/repo>",
  handler: bindRoute("wf-select", (args) => {
    const repoFullName = args[0];
    if (!repoFullName?.includes("/")) return undefined;
    return { repoFullName };
  }),
});

// ─── /repos [orgName] ────────────────────────────────────

registerCommand({
  name: "repos",
  aliases: ["/repos", "/list", "仓库", "列表"],
  description: "列出已注册的仓库",
  usage: "/repos [orgName]",
  handler: bindRoute("repos", (args) => ({ orgName: args[0] })),
});

// ─── /orgs ───────────────────────────────────────────────

registerCommand({
  name: "orgs",
  aliases: ["/orgs", "组织", "我的组织"],
  description: "查看我所属的组织",
  usage: "/orgs",
  handler: bindRoute("orgs"),
});

// ─── /notify ─────────────────────────────────────────────

registerCommand({
  name: "notify",
  aliases: ["/notify", "通知", "通知设置"],
  description: "查看通知偏好设置",
  usage: "/notify",
  handler: bindRoute("notify"),
});

// ─── /approvals ──────────────────────────────────────────

registerCommand({
  name: "approvals",
  aliases: ["/approvals", "审批", "待审批"],
  description: "查看待处理的审批",
  usage: "/approvals",
  handler: bindRoute("approvals"),
});

// ─── /presets ────────────────────────────────────────────

registerCommand({
  name: "presets",
  aliases: ["/presets", "预设", "工作流预设"],
  description: "查看我的工作流预设",
  usage: "/presets",
  handler: bindRoute("preset-list"),
});

// ─── /run <token> ──────────────────────────────────────────

registerCommand({
  name: "run",
  aliases: ["/run", "运行"],
  description: "通过预设 Token 触发工作流",
  usage: "/run <preset_token>",
  handler: bindRoute("preset-console", (args) => {
    const token = args[0];
    if (!token) return undefined;
    return { shareToken: token };
  }),
});

// ─── /test-form ──────────────────────────────────────────

registerCommand({
  name: "test-form",
  aliases: ["/test-form", "测试表单"],
  description: "测试飞书卡片 JSON 2.0 表单组件",
  usage: "/test-form",
  handler: bindRoute("test-form"),
});

// ─── 卡片交互处理 ─────────────────────────────────────────

export interface CardActionContext {
  action: Record<string, unknown>;
  openId: string;
  token: string;
  /** 可选的卡片更新回调，用于在处理过程中实时更新卡片 */
  updateCard?: (card: Record<string, unknown>) => Promise<void>;
  /** 发送新卡片消息回调（newMessage 模式使用） */
  sendCard?: (card: Record<string, unknown>) => Promise<void>;
}

export async function handleCardAction(
  ctx: CardActionContext,
): Promise<Record<string, unknown> | undefined> {
  const { updateCard } = ctx;

  // ─── 所有交互统一由 CardKit 路由分发 ──────────────────────────────────
  const { cardRouter, ensurePages } = await import("~~/server/card-kit");
  await ensurePages();
  const formVal = (ctx.action.form_value ?? ctx.action.form_values) as
    | Record<string, string>
    | undefined;
  const noop = async () => {};
  const cardResult = await cardRouter.dispatch({
    openId: ctx.openId,
    actionValue: ctx.action.value,
    formValue: formVal,
    token: ctx.token,
    updateCard: updateCard || noop,
    sendCard: ctx.sendCard,
  });
  if (cardResult) {
    if (updateCard) {
      await updateCard(cardResult);
    }
  }

  return undefined;
}

// ─── 指令分发 ─────────────────────────────────────────────

export async function handleBotCommand(ctx: BotCommandContext): Promise<void> {
  const text = ctx.text.trim();

  // 如果只是 @ 机器人,没有输入任何内容,显示控制面板
  if (!text || text === "") {
    const { renderCardPage } = await import("~~/server/card-kit");
    const card = await renderCardPage({ openId: ctx.senderOpenId }, "cp-home");
    if (card) {
      await replyFeishuCardMessage(ctx.messageId, card);
    }
    return;
  }

  const parts = text.split(/\s+/);
  const cmdText = parts[0]?.toLowerCase() || "";
  const args = parts.slice(1);

  // 匹配指令
  const matched = commands.find((c) =>
    c.aliases.some((a) => a.toLowerCase() === cmdText),
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
      await replyFeishuMessage(
        ctx.messageId,
        "❌ 未知指令,请使用 /help 查看可用指令",
      );
    }
  }
}
