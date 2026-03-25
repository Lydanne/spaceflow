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
