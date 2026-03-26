import { CardRouter } from "./router";
import type {
  AsyncTaskResult,
  CardActionResult,
  CardJSON,
  CardPageDef,
  GuardResult,
  NavigateResult,
  NavigationGuardContext,
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

// ─── 导航守卫工厂 ──────────────────────────

type BeforeEnterGuard = (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;

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

/**
 * 守卫：要求用户已绑定飞书账号。
 * 未绑定时渲染"未绑定账号"提示卡片。
 */
export function requireBinding(): BeforeEnterGuard {
  return async ({ openId }) => {
    const { getActiveAccount } = await import("~~/server/services/account.service");
    const user = await getActiveAccount(openId);
    if (!user) {
      const config = useRuntimeConfig();
      const baseUrl = config.public.appUrl as string;
      return new EnhancedCardBuilder({ title: "🔗 未绑定账号", theme: "orange" }, "")
        .text(`请先在 Teax 中绑定飞书账号\n\n[前往绑定](${baseUrl}/user/settings)`, true)
        .build();
    }
  };
}

/**
 * 守卫：要求用户对仓库拥有指定权限。
 * 从 params 中读取 owner/repo（或 repoFullName）定位仓库。
 * @param permission - 权限标识，如 "actions:trigger"
 */
export function requireRepoPermission(permission: string): BeforeEnterGuard {
  return async ({ openId, to }) => {
    const { getActiveAccount } = await import("~~/server/services/account.service");
    const { queryUserPermissionGroups, rowGrantsPermission } = await import("~~/server/utils/permission");
    const { useDB, schema } = await import("~~/server/db");
    const { eq } = await import("drizzle-orm");

    const user = await getActiveAccount(openId);
    if (!user) return; // requireBinding 应先执行

    // 支持 params.owner + params.repo 或 params.repoFullName
    let fullName: string;
    if (to.params.owner && to.params.repo) {
      fullName = `${to.params.owner}/${to.params.repo}`;
    } else if (to.params.repoFullName) {
      fullName = to.params.repoFullName as string;
    } else {
      return; // 无仓库信息，跳过
    }

    const db = useDB();
    const [repoRecord] = await db
      .select({ id: schema.repositories.id, organization_id: schema.repositories.organization_id })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, fullName))
      .limit(1);

    if (!repoRecord) {
      return new EnhancedCardBuilder({ title: "❌ 仓库不存在", theme: "red" }, "")
        .text("该仓库未在系统中注册", true)
        .build();
    }

    const groups = await queryUserPermissionGroups(user.id, repoRecord.organization_id);
    const hasPermission = groups.some((g) => rowGrantsPermission(g, permission, repoRecord.id));
    if (!hasPermission) {
      return new EnhancedCardBuilder({ title: "❌ 无权限", theme: "red" }, "")
        .text(`您没有执行此操作的权限 (${permission})`, true)
        .build();
    }
  };
}

// ─── 类型导出 ──────────────────────────

export type {
  AsyncTaskResult,
  CardActionResult,
  CardJSON,
  CardPageDef,
  GuardResult,
  NavigateResult,
  NavigationGuardContext,
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
