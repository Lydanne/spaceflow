/**
 * 卡片命令系统 — 工具类
 *
 * 类型定义、注册表、消息分发。
 * 各 .cmd.ts 直接从 ~~/server/card-kit 导入 registerCardCommand。
 */

import type { CardJSON } from "./types";
import { encodeStackEntry } from "./stack";

// 延迟获取 cardRouter 和 ensurePages，避免与 index.ts 循环依赖
async function getRouter() {
  const { cardRouter, ensurePages } = await import("./index");
  await ensurePages();
  return cardRouter;
}

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

// ─── 类型定义 ──────────────────────────

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

// ─── 注册表 ──────────────────────────

const commands: CardCommandDef[] = [];

export function registerCardCommand(def: CardCommandDef): void {
  commands.push(def);
}

export function getCommands(): readonly CardCommandDef[] {
  return commands;
}

// ─── 链接匹配检查（快速判断，不执行处理） ──────────────────────────

export function hasLinkMatch(text: string): boolean {
  return commands.some((c) => c.linkPattern && c.linkPattern.test(text));
}

// ─── 消息分发 ──────────────────────────

/**
 * 统一处理机器人消息：先匹配链接，再匹配文本指令。
 */
export async function handleBotMessage(ctx: BotMessageContext): Promise<void> {
  const { replyFeishuCardMessage, replyFeishuMessage } = await import("~~/server/services/messaging");

  // 1. 链接匹配（优先级最高，支持 text/post 消息中的 URL）
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

  // 空文本 → 显示控制面板
  if (!text) {
    const card = await render(ctx.senderOpenId, "cp-home");
    if (card) {
      await replyFeishuCardMessage(ctx.messageId, card);
    }
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
    // 未知指令 → 显示帮助
    const helpCmd = commands.find((c) => c.name === "help");
    if (helpCmd) {
      const card = await render(ctx.senderOpenId, helpCmd.page);
      if (card) {
        await replyFeishuCardMessage(ctx.messageId, card);
      }
    } else {
      await replyFeishuMessage(ctx.messageId, "❌ 未知指令，请使用 /help 查看可用指令");
    }
  }
}
