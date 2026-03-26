import { CardRouter } from "./router";
import type { CardPageDef } from "./types";

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
    import("~~/server/card-pages/preset-list.page"),
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

// ─── 确保 card-commands 注册 ──────────────────────────

let commandsLoaded = false;

export async function ensureCommands(): Promise<void> {
  if (commandsLoaded) return;
  commandsLoaded = true;
  await Promise.all([
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
  ]);
}

// 延迟获取 cardRouter 和 ensurePages，避免与 index.ts 循环依赖
export async function getRouter() {
  await ensurePages();
  return cardRouter;
}
