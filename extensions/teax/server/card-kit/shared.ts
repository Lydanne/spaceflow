/**
 * card-kit 工具方法
 *
 * navigate / back / toast / asyncTask / guards / requireBinding / requireRepoPermission / renderCardPage
 */

import { encodeStackEntry } from "./stack";
import { EnhancedCardBuilder } from "./builder";
import type {
  AsyncTaskResult,
  BackResult,
  CardInteractionContext,
  CardJSON,
  NavigateOpts,
  NavigateResult,
  NavigationGuardContext,
  ToastResult,
  GuardResult,
} from "./types";

// ─── renderCardPage（外部服务调用入口） ──────────────────────────

/**
 * 渲染指定卡片页面，自动处理 ensurePages + dispatch。
 * 适用于机器人指令、链接处理等需要从外部获取卡片 JSON 的场景。
 */
export async function renderCardPage(
  ctx: { openId: string },
  page: string,
  params?: Record<string, unknown>,
): Promise<CardJSON | undefined> {
  const { getRouter } = await import("./register");
  const cardRouter = await getRouter();
  return cardRouter.dispatch({
    openId: ctx.openId,
    actionValue: JSON.stringify({
      __stack: [encodeStackEntry(page, params ?? {})],
    }),
    token: "",
    updateCard: async () => {},
  });
}

// ─── navigate ──────────────────────────

export function navigate(
  page: string,
  params: Record<string, unknown> = {},
  opts?: NavigateOpts,
): NavigateResult {
  return {
    __type: "navigate",
    page,
    params,
    data: opts?.data,
    newMessage: opts?.newMessage,
    mode: opts?.mode,
  };
}

// ─── back ──────────────────────────

export function back(): BackResult {
  return { __type: "back" };
}

// ─── toast ──────────────────────────

export function toast(
  type: "success" | "info" | "warning" | "error",
  content: string,
): ToastResult {
  return {
    __type: "toast",
    type,
    content,
  };
}

// ─── asyncTask ──────────────────────────

/**
 * 创建异步任务结果：立即返回 loading 卡片，后台执行 task。
 * task 内通过闭包访问 ctx.update 更新最终结果。
 * @param loading - loading 提示文本（自动构建蓝色卡片）或完整的 CardJSON
 * @param task - 后台异步任务
 */
export function asyncTask(
  loading: string | CardJSON,
  task: () => Promise<void>,
): AsyncTaskResult {
  const loadingCard = typeof loading === "string"
    ? new EnhancedCardBuilder({ title: "⏳ 请稍候", theme: "blue" }, "")
        .text(loading, true)
        .build()
    : loading;
  return {
    __type: "async_task",
    loadingCard,
    task,
  };
}

export type BeforeEnterGuard = (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;

export function navigateTo(
  page: string,
  params: Record<string, unknown> = {},
  opts?: { mode?: "push" | "replace" },
): NavigateResult {
  return {
    __type: "navigate",
    page,
    params,
    mode: opts?.mode,
  };
}

/**
 * 组合多个 beforeEnter 守卫（类似 vue-router 数组守卫）。
 * 按顺序执行，任一守卫拦截则停止。
 */
export function guards(...fns: BeforeEnterGuard[]): BeforeEnterGuard {
  return async (ctx) => {
    for (const fn of fns) {
      const result = await fn(ctx);
      if (result !== undefined && result !== true) return result;
    }
  };
}

// ─── 卡片交互处理 ──────────────────────────

export async function handleCardInteraction(
  ctx: CardInteractionContext,
): Promise<Record<string, unknown> | undefined> {
  const { getRouter } = await import("./register");
  const cardRouter = await getRouter();
  const formVal = (ctx.action.form_value ?? ctx.action.form_values) as
    | Record<string, string>
    | undefined;
  const noop = async () => {};
  const cardResult = await cardRouter.dispatch({
    openId: ctx.openId,
    actionValue: ctx.action.value,
    formValue: formVal,
    token: ctx.token,
    updateCard: ctx.updateCard || noop,
    sendCard: ctx.sendCard,
  });
  if (cardResult) {
    if (ctx.updateCard) {
      await ctx.updateCard(cardResult);
    }
  }
  return undefined;
}
