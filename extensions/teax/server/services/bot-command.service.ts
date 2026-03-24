import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  replyFeishuMessage,
  replyFeishuCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/services/messaging";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { startWorkflowAction } from "~~/server/services/workflow-action-machine";
import { getActiveAccount } from "~~/server/services/account.service";

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
            content: [
              "**📋 仓库与构建**",
              "`/repos [org]` — 列出已注册的仓库",
              "`/orgs` — 查看我所属的组织",
              "`/status <owner/repo>` — 查询构建状态",
              "`/actions <owner/repo>` — 触发工作流",
              "",
              "**🚀 工作流预设**",
              "`/run <token>` — 通过预设 Token 触发工作流",
              "`/presets` — 查看工作流预设",
              "",
              "**👤 账户与设置**",
              "`/account` — 查看账户信息（多账户可切换）",
              "`/notify` — 查看通知设置",
              "",
              "**📝 审批**",
              "`/approvals` — 查看待处理审批",
              "",
              "**💡 提示**",
              "直接 @ 机器人或发送预设链接可触发工作流",
            ].join("\n"),
          },
        },
      ],
    };
    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── /account ─────────────────────────────────────────────

registerCommand({
  name: "account",
  aliases: ["/account", "账户", "我的账户"],
  description: "查看账户信息和飞书绑定状态",
  usage: "/account",
  handler: async (ctx) => {
    const { generateAccountCard } = await import("~~/server/services/account.service");
    const card = await generateAccountCard(ctx.senderOpenId);
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

    // 验证用户权限：使用当前活跃账户
    const activeUser = await getActiveAccount(ctx.senderOpenId);
    if (!activeUser) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 验证仓库是否在 Teax 中注册
    const db = useDB();
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
      const gitea = await useGiteaSdk().role("admin");
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

// ─── /repos [orgName] ────────────────────────────────────

registerCommand({
  name: "repos",
  aliases: ["/repos", "/list", "仓库", "列表"],
  description: "列出已注册的仓库",
  usage: "/repos [orgName]",
  handler: async (ctx, args) => {
    const orgName = args[0];

    // 验证用户绑定：使用当前活跃账户
    const activeUser = await getActiveAccount(ctx.senderOpenId);
    if (!activeUser) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    const db = useDB();
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

// ─── /orgs ───────────────────────────────────────────────

registerCommand({
  name: "orgs",
  aliases: ["/orgs", "组织", "我的组织"],
  description: "查看我所属的组织",
  usage: "/orgs",
  handler: async (ctx) => {
    // 验证用户绑定：使用当前活跃账户
    const activeUser = await getActiveAccount(ctx.senderOpenId);
    if (!activeUser) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 查询用户所属的组织
    const db = useDB();
    const orgs = await db
      .selectDistinct({
        id: schema.organizations.id,
        name: schema.organizations.name,
        full_name: schema.organizations.full_name,
      })
      .from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
      .innerJoin(schema.organizations, eq(schema.teams.organization_id, schema.organizations.id))
      .where(eq(schema.teamMembers.user_id, activeUser.id));

    if (orgs.length === 0) {
      await replyFeishuMessage(ctx.messageId, "📋 您暂未加入任何组织");
      return;
    }

    const lines = orgs.map((o) => `• **${o.full_name || o.name}** (${o.name})`);
    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: "🏢 我的组织" },
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
        {
          tag: "hr",
        },
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "💡 使用 `/repos <组织名>` 查看组织下的仓库",
          },
        },
      ],
    };

    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── /notify ─────────────────────────────────────────────

registerCommand({
  name: "notify",
  aliases: ["/notify", "通知", "通知设置"],
  description: "查看通知偏好设置",
  usage: "/notify",
  handler: async (ctx) => {
    // 验证用户绑定：使用当前活跃账户
    const activeUser = await getActiveAccount(ctx.senderOpenId);
    if (!activeUser) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 查询当前活跃账户的通知设置
    const db = useDB();
    const [binding] = await db
      .select({
        notify_publish: schema.userFeishu.notify_publish,
        notify_approval: schema.userFeishu.notify_approval,
        notify_agent: schema.userFeishu.notify_agent,
        notify_system: schema.userFeishu.notify_system,
      })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.user_id, activeUser.id))
      .limit(1);

    if (!binding) {
      await replyFeishuMessage(ctx.messageId, "❌ 未找到通知设置");
      return;
    }

    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    const settings = [
      `${binding.notify_publish ? "✅" : "❌"} 发布通知`,
      `${binding.notify_approval ? "✅" : "❌"} 审批通知`,
      `${binding.notify_agent ? "✅" : "❌"} Agent 通知`,
      `${binding.notify_system ? "✅" : "❌"} 系统通知`,
    ];

    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: "🔔 通知设置" },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "**当前通知偏好**\n\n" + settings.join("\n"),
          },
        },
        {
          tag: "hr",
        },
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `[前往设置页面修改](${baseUrl}/user/settings)`,
          },
        },
      ],
    };

    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── /approvals ──────────────────────────────────────────

registerCommand({
  name: "approvals",
  aliases: ["/approvals", "审批", "待审批"],
  description: "查看待处理的审批",
  usage: "/approvals",
  handler: async (ctx) => {
    // 验证用户绑定：使用当前活跃账户
    const activeUser = await getActiveAccount(ctx.senderOpenId);
    if (!activeUser) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    // 查询待处理的审批流程
    const db = useDB();
    const pendingApprovals = await db
      .select({
        id: schema.approvalFlows.id,
        title: schema.approvalFlows.title,
        flow_type: schema.approvalFlows.flow_type,
        created_at: schema.approvalFlows.created_at,
      })
      .from(schema.approvalFlows)
      .where(eq(schema.approvalFlows.status, "pending"))
      .orderBy(schema.approvalFlows.created_at)
      .limit(10);

    if (pendingApprovals.length === 0) {
      const card: FeishuInteractiveCard = {
        header: {
          title: { tag: "plain_text", content: "✅ 审批列表" },
          template: "green",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: "暂无待处理的审批",
            },
          },
        ],
      };
      await replyFeishuCardMessage(ctx.messageId, card);
      return;
    }

    const lines = pendingApprovals.map((a) => {
      const date = a.created_at ? new Date(a.created_at).toLocaleDateString("zh-CN") : "";
      return `• **${a.title}**\n  ${a.flow_type} · ${date}`;
    });

    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: `📋 待处理审批 (${pendingApprovals.length})` },
        template: "orange",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: lines.join("\n\n"),
          },
        },
      ],
    };

    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── /presets ────────────────────────────────────────────

registerCommand({
  name: "presets",
  aliases: ["/presets", "预设", "工作流预设"],
  description: "查看我的工作流预设",
  usage: "/presets",
  handler: async (ctx) => {
    const activeUser = await getActiveAccount(ctx.senderOpenId);
    if (!activeUser) {
      await replyFeishuMessage(ctx.messageId, "❌ 请先在 Teax 中绑定飞书账号");
      return;
    }

    const db = useDB();
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    const groups = await db
      .select({
        id: schema.workflowPresetGroups.id,
        name: schema.workflowPresetGroups.name,
        description: schema.workflowPresetGroups.description,
        share_token: schema.workflowPresetGroups.share_token,
      })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.created_by, activeUser.id))
      .limit(10);

    const groupIds = groups.map((g) => g.id);
    let groupPresets: Array<{
      id: string;
      name: string;
      branch: string;
      group_id: string | null;
    }> = [];
    if (groupIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      groupPresets = await db
        .select({
          id: schema.workflowPresets.id,
          name: schema.workflowPresets.name,
          branch: schema.workflowPresets.branch,
          group_id: schema.workflowPresets.group_id,
        })
        .from(schema.workflowPresets)
        .where(inArray(schema.workflowPresets.group_id, groupIds))
        .limit(50);
    }

    const presetsByGroup = new Map<string, typeof groupPresets>();
    for (const p of groupPresets) {
      if (!p.group_id) continue;
      const list = presetsByGroup.get(p.group_id) ?? [];
      list.push(p);
      presetsByGroup.set(p.group_id, list);
    }

    const standalonePresets = await db
      .select({
        id: schema.workflowPresets.id,
        name: schema.workflowPresets.name,
        branch: schema.workflowPresets.branch,
        share_token: schema.workflowPresets.share_token,
        repository: {
          full_name: schema.repositories.full_name,
        },
      })
      .from(schema.workflowPresets)
      .innerJoin(
        schema.repositories,
        eq(schema.workflowPresets.repository_id, schema.repositories.id),
      )
      .where(eq(schema.workflowPresets.created_by, activeUser.id))
      .limit(10);

    if (groups.length === 0 && standalonePresets.length === 0) {
      const card: FeishuInteractiveCard = {
        header: {
          title: { tag: "plain_text", content: "📦 工作流预设" },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: "您还没有创建工作流预设\n\n工作流预设可以保存常用的工作流配置，方便快速触发",
            },
          },
          {
            tag: "hr",
          },
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: "💡 在仓库的 **Workflows** 页面可以创建预设组",
            },
          },
        ],
      };
      await replyFeishuCardMessage(ctx.messageId, card);
      return;
    }

    const contentParts: string[] = [];

    if (groups.length > 0) {
      contentParts.push("**📁 预设组**\n");
      for (const g of groups) {
        const shareUrl = g.share_token ? `${baseUrl}/workflow-groups/${g.share_token}` : "";
        const header = shareUrl
          ? `• **${g.name}** — [分享链接](${shareUrl})`
          : `• **${g.name}**`;
        contentParts.push(header);

        const presets = presetsByGroup.get(g.id) ?? [];
        for (const p of presets) {
          contentParts.push(`  └ ${p.name} (${p.branch})`);
        }
        if (presets.length === 0) {
          contentParts.push("  └ (暂无预设)");
        }
      }
    }

    if (standalonePresets.length > 0) {
      if (groups.length > 0) {
        contentParts.push("\n");
      }
      contentParts.push("**📋 独立预设**\n");
      for (const p of standalonePresets) {
        const repo = p.repository?.full_name ?? "";
        const repoName = repo ? ` (${repo})` : "";
        contentParts.push(`• **${p.name}**${repoName}`);
      }
    }

    const totalCount = groups.length + standalonePresets.length;
    const card: FeishuInteractiveCard = {
      header: {
        title: { tag: "plain_text", content: `📦 工作流预设 (${totalCount})` },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: contentParts.join("\n"),
          },
        },
      ],
    };

    await replyFeishuCardMessage(ctx.messageId, card);
  },
});

// ─── /run <token> ──────────────────────────────────────────

registerCommand({
  name: "run",
  aliases: ["/run", "运行"],
  description: "通过预设 Token 触发工作流",
  usage: "/run <preset_token>",
  handler: async (ctx, args) => {
    const token = args[0];
    if (!token) {
      await replyFeishuMessage(ctx.messageId, "用法: /run <preset_token>\n\n示例:\n/run abc123\n或发送预设链接: http://your-host/workflows/abc123");
      return;
    }

    try {
      const { generatePresetConsoleCard } = await import("~~/server/services/preset-console.service");
      const card = await generatePresetConsoleCard({ openId: ctx.senderOpenId, shareToken: token });
      await replyFeishuCardMessage(ctx.messageId, card);
    } catch (err) {
      console.error("[bot-command] run error:", err);
      const msg = (err as { statusCode?: number; message?: string }).message || "获取预设信息失败";
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) {
        await replyFeishuMessage(ctx.messageId, `❌ 预设不存在或已被删除`);
      } else {
        await replyFeishuMessage(ctx.messageId, `❌ ${msg}`);
      }
    }
  },
});

// ─── 卡片交互处理 ─────────────────────────────────────────

export interface CardActionContext {
  action: Record<string, unknown>;
  openId: string;
  token: string;
  /** 可选的卡片更新回调，用于在处理过程中实时更新卡片 */
  updateCard?: (card: Record<string, unknown>) => Promise<void>;
}

export async function handleCardAction(ctx: CardActionContext): Promise<Record<string, unknown> | undefined> {
  const { updateCard } = ctx;
  const actionValue = ctx.action.value as Record<string, unknown> | string | undefined;

  // value 可能是双重 JSON 编码的字符串，需要解析
  let parsedValue: Record<string, unknown> | undefined;
  if (typeof actionValue === "string") {
    try {
      // 第一次解析
      let parsed = JSON.parse(actionValue);
      // 如果解析结果还是字符串，再解析一次（双重编码）
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      parsedValue = parsed as Record<string, unknown>;
    } catch {
      // 如果不是 JSON，可能是简单的 action 字符串如 "approval_flow:approve:xxx"
      if (actionValue.startsWith("approval_flow:")) {
        const { handleApprovalFlowCardAction } = await import("~~/server/services/approval-flow/card-handler");
        return await handleApprovalFlowCardAction(ctx.openId, ctx.token, actionValue, updateCard);
      }
      parsedValue = undefined;
    }
  } else {
    parsedValue = actionValue;
  }

  const actionType = parsedValue?.action as string | undefined;

  // 检查是否是审批流程的交互 (格式: approval_flow:approve:flowId)
  if (actionType?.startsWith("approval_flow:")) {
    const { handleApprovalFlowCardAction } = await import("~~/server/services/approval-flow/card-handler");
    return await handleApprovalFlowCardAction(ctx.openId, ctx.token, actionType, updateCard);
  }

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

  if (actionType && parsedValue && controlPanelActions.includes(actionType)) {
    const { handleControlPanelAction } = await import("~~/server/services/control-panel.service");
    const newCard = await handleControlPanelAction(ctx.openId, parsedValue, updateCard);
    // 通过 updateCard 回调更新卡片
    if (newCard && updateCard) {
      await updateCard(newCard);
    }
    return undefined;
  }

  // 检查是否是账户相关的交互
  const accountActions = [
    "refresh_account",
    "unbind_feishu",
    "view_binding_guide",
    "switch_account",
  ];

  if (actionType && parsedValue && accountActions.includes(actionType)) {
    const { handleAccountAction } = await import("~~/server/services/account.service");
    const newCard = await handleAccountAction(ctx.openId, parsedValue, updateCard);
    // 通过 updateCard 回调更新卡片
    if (newCard && updateCard) {
      await updateCard(newCard);
    }
    return undefined;
  }

  // 检查是否是预设控制台的触发交互
  if (actionType === "preset_console_trigger" && parsedValue?.token) {
    const { handlePresetConsoleTrigger } = await import("~~/server/services/preset-console.service");
    await handlePresetConsoleTrigger({
      openId: ctx.openId,
      parsedValue,
      formValue: ((ctx.action.form_value ?? ctx.action.form_values ?? {}) as Record<string, string>),
      updateCard,
    });
    return undefined;
  }

  // 否则调用状态机处理其他卡片交互
  const { routeCardAction } = await import("~~/server/utils/card-state-machine");
  await routeCardAction({
    action: ctx.action,
    openId: ctx.openId,
    updateCard,
  });

  return undefined;
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
