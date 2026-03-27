/**
 * card-kit 注册中心
 *
 * 职责：路由器单例、类型定义、define 函数、注册表、
 *       ensure 加载入口、消息分发。
 */

import { CardRouter } from "./router";
import type { CardPageDef, CardJSON } from "./types";
import { encodeStackEntry } from "./stack";

// ━━━ 全局单例 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const cardRouter = new CardRouter();

// ━━━ 类型定义 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BotMessageContext {
  messageId: string;
  chatId: string;
  chatType: string;
  senderOpenId: string;
  text: string;
}

export interface CardCommandDef {
  name: string;
  description: string;
  usage?: string;
  /** 文本指令别名（如 ["/help", "帮助"]） */
  aliases?: string[];
  /** 链接匹配正则 */
  linkPattern?: RegExp;
  /** 目标卡片页面 */
  page: string;
  /** 从指令参数提取 params */
  paramsFromArgs?: (args: string[]) => Record<string, unknown> | undefined;
  /** 从链接正则匹配提取 params */
  paramsFromMatch?: (match: RegExpMatchArray) => Record<string, unknown> | undefined;
}

// ━━━ define 函数（纯声明，不注册） ━━━━━━━━━━━━━━━━━━━

export function defineCardPage<
  D extends Record<string, unknown> = Record<string, unknown>,
>(def: CardPageDef<D>): CardPageDef<D> {
  return def;
}

export function defineCardCommand(def: CardCommandDef): CardCommandDef {
  return def;
}

// ━━━ 命令注册表 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const commands: CardCommandDef[] = [];

export function registerCommand(def: CardCommandDef): void {
  commands.push(def);
}

export function getCommands(): readonly CardCommandDef[] {
  return commands;
}

export function hasLinkMatch(text: string): boolean {
  return commands.some((c) => c.linkPattern && c.linkPattern.test(text));
}

// ━━━ ensure 加载入口 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Nitro dev HMR 会重新执行模块导致 cardRouter 为空实例。
// ensure* 显式 import 各模块并注册到 *当前* 实例。

export async function ensurePages(): Promise<void> {
  if (cardRouter.pageCount > 0) return;
  const pages = await Promise.all([
    import("~~/server/card-pages/cp-home.page"),
    import("~~/server/card-pages/cp-repos.page"),
    import("~~/server/card-pages/cp-repo-menu.page"),
    import("~~/server/card-pages/cp-actions.page"),
    import("~~/server/card-pages/cp-trigger-wf.page"),
    import("~~/server/card-pages/cp-feature.page"),
    import("~~/server/card-pages/account-home.page"),
    import("~~/server/card-pages/account-guide.page"),
    import("~~/server/card-pages/account-unbound.page"),
    import("~~/server/card-pages/binding-required.page"),
    import("~~/server/card-pages/test-form.page"),
    import("~~/server/card-pages/test-result.page"),
    import("~~/server/card-pages/preset-console.page"),
    import("~~/server/card-pages/preset-list.page"),
    import("~~/server/card-pages/preset-group.page"),
    import("~~/server/card-pages/wf-select.page"),
    import("~~/server/card-pages/wf-params.page"),
    import("~~/server/card-pages/approval-pending.page"),
    import("~~/server/card-pages/help.page"),
    import("~~/server/card-pages/status.page"),
    import("~~/server/card-pages/repos.page"),
    import("~~/server/card-pages/orgs.page"),
    import("~~/server/card-pages/notify.page"),
    import("~~/server/card-pages/approvals.page"),
  ]);
  for (const mod of pages) {
    const def = mod.default;
    if (def?.name) {
      cardRouter.register(def as CardPageDef);
    }
  }
}

let commandsLoaded = false;

export async function ensureCommands(): Promise<void> {
  if (commandsLoaded) return;
  commandsLoaded = true;
  const mods = await Promise.all([
    import("~~/server/card-commands/help.cmd"),
    import("~~/server/card-commands/account.cmd"),
    import("~~/server/card-commands/status.cmd"),
    import("~~/server/card-commands/actions.cmd"),
    import("~~/server/card-commands/repos.cmd"),
    import("~~/server/card-commands/orgs.cmd"),
    import("~~/server/card-commands/notify.cmd"),
    import("~~/server/card-commands/approvals.cmd"),
    import("~~/server/card-commands/presets.cmd"),
    import("~~/server/card-commands/run.cmd"),
    import("~~/server/card-commands/test-form.cmd"),
    import("~~/server/card-commands/preset-link.cmd"),
    import("~~/server/card-commands/preset-group-link.cmd"),
  ]);
  for (const mod of mods) {
    const def = mod.default;
    if (def?.name) {
      registerCommand(def);
    }
  }
}

export async function getRouter() {
  await ensurePages();
  return cardRouter;
}

// ━━━ 消息分发 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function render(
  openId: string,
  page: string,
  params?: Record<string, unknown>,
): Promise<CardJSON | undefined> {
  const router = await getRouter();
  return router.dispatch({
    openId,
    actionValue: JSON.stringify({
      __stack: [encodeStackEntry(page, params ?? {})],
    }),
    token: "",
    updateCard: async () => {},
  });
}

/**
 * 统一处理机器人消息：先匹配链接，再匹配文本指令。
 */
export async function handleBotMessage(ctx: BotMessageContext): Promise<void> {
  const { replyFeishuCardMessage, replyFeishuMessage } = await import("~~/server/services/messaging");

  // 1. 链接匹配（优先级最高）
  for (const cmd of commands) {
    if (!cmd.linkPattern) continue;
    const match = ctx.text.match(cmd.linkPattern);
    if (!match) continue;
    try {
      const params = cmd.paramsFromMatch?.(match);
      const card = await render(ctx.senderOpenId, cmd.page, params);
      if (card) {
        await replyFeishuCardMessage(ctx.messageId, card);
      }
      return;
    } catch (err) {
      console.error(`[card-command] ${cmd.name} link error:`, err);
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) {
        await replyFeishuMessage(ctx.messageId, "❌ 资源不存在或已被删除");
      } else {
        const msg = (err as { message?: string }).message || "处理失败";
        await replyFeishuMessage(ctx.messageId, `❌ ${msg}`);
      }
      return;
    }
  }

  // 2. 文本指令匹配
  const text = ctx.text.trim();

  if (!text) {
    const card = await render(ctx.senderOpenId, "cp-home");
    if (card) await replyFeishuCardMessage(ctx.messageId, card);
    return;
  }

  const parts = text.split(/\s+/);
  const cmdText = parts[0]?.toLowerCase() || "";
  const args = parts.slice(1);

  const matched = commands.find((c) =>
    c.aliases?.some((a) => a.toLowerCase() === cmdText),
  );

  if (matched) {
    try {
      const params = matched.paramsFromArgs?.(args);
      const card = await render(ctx.senderOpenId, matched.page, params);
      if (card) {
        await replyFeishuCardMessage(ctx.messageId, card);
      }
    } catch (err) {
      console.error(`[card-command] ${matched.name} error:`, err);
      await replyFeishuMessage(ctx.messageId, "❌ 指令执行失败，请稍后重试");
    }
  } else {
    const helpCmd = commands.find((c) => c.name === "help");
    if (helpCmd) {
      const card = await render(ctx.senderOpenId, helpCmd.page);
      if (card) await replyFeishuCardMessage(ctx.messageId, card);
    } else {
      await replyFeishuMessage(ctx.messageId, "❌ 未知指令，请使用 /help 查看可用指令");
    }
  }
}
