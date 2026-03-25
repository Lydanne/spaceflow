import { CardRouter } from "./router";
import type {
  CardActionResult,
  CardJSON,
  CardPageDef,
  NavigateResult,
  ToastResult,
} from "./types";

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
    import("~~/server/card-pages/cp-feature.page"),
    import("~~/server/card-pages/account-home.page"),
    import("~~/server/card-pages/account-guide.page"),
    import("~~/server/card-pages/account-unbound.page"),
    import("~~/server/card-pages/test-form.page"),
    import("~~/server/card-pages/test-result.page"),
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

// ─── 类型导出 ──────────────────────────

export type {
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
