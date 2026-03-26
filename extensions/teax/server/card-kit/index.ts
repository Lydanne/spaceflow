import { CardRouter } from "./router";
import type {
  AsyncTaskResult,
  CardActionResult,
  CardJSON,
  CardPageDef,
  NavigateResult,
  ToastResult,
} from "./types";
import { EnhancedCardBuilder } from "./builder";

// ─── 全局单例路由器 ──────────────────────────

export const cardRouter = new CardRouter();

// ─── defineCardPage ──────────────────────────

export function defineCardPage<
  D extends Record<string, unknown> = Record<string, unknown>,
>(def: CardPageDef<D>): CardPageDef<D> {
  cardRouter.register(def as CardPageDef);
  return def;
}

// ─── 确保 card-pages 注册 ──────────────────────────
// Nitro dev HMR 会重新执行模块导致 cardRouter 为空实例。
// 此函数显式 import 各 page 的 default export 并注册到 *当前* cardRouter，
// 避免 side-effect import 可能引用到不同模块实例的 cardRouter。

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
    import("~~/server/card-pages/test-form.page"),
    import("~~/server/card-pages/test-result.page"),
    import("~~/server/card-pages/preset-console.page"),
    import("~~/server/card-pages/wf-select.page"),
    import("~~/server/card-pages/wf-params.page"),
    import("~~/server/card-pages/approval-pending.page"),
  ]);
  for (const mod of pages) {
    const def = mod.default;
    if (def?.name) {
      cardRouter.register(def as CardPageDef);
    }
  }
}

// ─── navigate ──────────────────────────

export function navigate(
  page: string,
  params: Record<string, unknown> = {},
  opts?: { data?: Record<string, unknown> },
): NavigateResult {
  return {
    __type: "navigate",
    page,
    params,
    data: opts?.data,
  };
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
 * task 内通过闭包访问 ctx.updateCard 更新最终结果。
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

// ─── 类型导出 ──────────────────────────

export type {
  AsyncTaskResult,
  CardActionResult,
  CardJSON,
  CardPageDef,
  NavigateResult,
  ToastResult,
};

export type {
  ButtonOpts,
  CardActionContext,
  CardConfig,
  CardElement,
  CardRenderContext,
  ColumnDef,
  ColumnSetOpts,
  EnhancedButtonConfig,
  EnhancedCardBuilderInterface,
  InputConfig,
  InputV2Config,
  SelectConfig,
} from "./types";

export { EnhancedCardBuilder, ColumnBuilder, ColumnSetBuilder } from "./builder";
export { CardRouter } from "./router";
