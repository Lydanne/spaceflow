import { EnhancedCardBuilder } from "./builder";
import type {
  AsyncTaskResult,
  CardActionContext,
  CardActionResult,
  CardConfig,
  CardJSON,
  CardPageDef,
  CardRenderContext,
  EncodedValue,
  GuardResult,
  NavigateResult,
  NavigationGuardContext,
} from "./types";

interface DispatchInput {
  /** 用户 open_id */
  openId: string;
  /** action.value（JSON 字符串或对象） */
  actionValue: unknown;
  /** action.form_value（表单提交时有值） */
  formValue?: Record<string, string>;
  /** 飞书回调 token */
  token: string;
  /** 更新卡片回调 */
  updateCard: (card: CardJSON) => Promise<void>;
}

export class CardRouter {
  private pages = new Map<string, CardPageDef>();
  private globalBeforeEach: Array<(ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>> = [];

  get pageCount(): number {
    return this.pages.size;
  }

  register(page: CardPageDef): void {
    if (this.pages.has(page.name)) {
      console.warn(`[CardRouter] page "${page.name}" already registered, overwriting`);
    }
    this.pages.set(page.name, page);
  }

  /** 注册全局前置守卫（类似 vue-router router.beforeEach） */
  beforeEach(guard: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>): void {
    this.globalBeforeEach.push(guard);
  }

  /**
   * 渲染指定页面，返回 CardJSON。
   * 用于 asyncTask task 内的异步跳转（ctx.navigate 底层调用此方法）。
   */
  async renderPage(
    pageName: string,
    opts: { openId: string; params?: Record<string, unknown> },
  ): Promise<CardJSON | undefined> {
    const page = this.pages.get(pageName);
    if (!page) {
      console.warn(`[CardRouter] renderPage: page "${pageName}" not found`);
      return undefined;
    }
    const params = opts.params ?? {};
    const data = page.data?.() ?? {};
    const renderCtx = this.buildRenderContext(page, {
      openId: opts.openId,
      params,
      data,
    });
    return page.render(renderCtx);
  }

  /**
   * 分发卡片交互事件。
   * 返回卡片 JSON 或 undefined（表示不由 CardKit 处理）。
   */
  async dispatch(input: DispatchInput): Promise<CardJSON | undefined> {
    const encoded = this.parseValue(input.actionValue);
    if (!encoded || !encoded.__page) {
      return undefined;
    }

    const page = this.pages.get(encoded.__page);
    if (!page) {
      console.warn(`[CardRouter] page "${encoded.__page}" not found`);
      return undefined;
    }

    try {
      const params = encoded.__params || {};
      const data = this.resolveData(page, encoded);

      // ─── beforeEnter 守卫 ───
      const guardCtx: NavigationGuardContext = {
        openId: input.openId,
        to: { page: page.name, params },
        from: null,
      };
      const blocked = await this.runBeforeEnter(page, guardCtx, input);
      if (blocked !== undefined) return blocked;

      if (input.formValue) {
        // ─── 表单提交 ───
        const ctx = this.buildActionContext(page, {
          ...input,
          params,
          data,
          type: "form_submit",
          action: "form_submit",
          formValue: input.formValue,
          formName: (encoded.__formName as string) || null,
        });
        return this.handleActionResult(page, ctx, await page.onAction?.(ctx));
      }

      if (encoded.__action) {
        // ─── action 按钮 ───
        const ctx = this.buildActionContext(page, {
          ...input,
          params,
          data,
          type: "button",
          action: encoded.__action,
          formValue: null,
          formName: null,
        });
        return this.handleActionResult(page, ctx, await page.onAction?.(ctx));
      }

      // ─── 纯 navigate ───
      const renderCtx = this.buildRenderContext(page, {
        openId: input.openId,
        params,
        data,
      });
      return page.render(renderCtx);
    } catch (err) {
      console.error(`[CardRouter] error in page "${encoded.__page}":`, err);
      return this.buildErrorCard(err);
    }
  }

  // ─── 内部方法 ──────────────────────────

  private parseValue(value: unknown): EncodedValue | null {
    if (!value) return null;

    // 飞书回调可能对 value 做多层 JSON 编码，循环解析直到得到对象
    let current = value;
    for (let i = 0; i < 5 && typeof current === "string"; i++) {
      try {
        current = JSON.parse(current);
      } catch {
        return null;
      }
    }

    if (typeof current === "object" && current !== null && "__page" in current) {
      return current as EncodedValue;
    }

    return null;
  }

  private resolveData(
    page: CardPageDef,
    encoded: EncodedValue,
  ): Record<string, unknown> {
    if (encoded.__data && typeof encoded.__data === "object") {
      return encoded.__data;
    }
    return page.data?.() ?? {};
  }

  private buildRenderContext(
    page: CardPageDef,
    opts: {
      openId: string;
      params: Record<string, unknown>;
      data: Record<string, unknown>;
    },
  ): CardRenderContext {
    return {
      openId: opts.openId,
      params: opts.params,
      data: opts.data,
      card: (config: CardConfig) =>
        new EnhancedCardBuilder(config, page.name, opts.data, opts.params),
    };
  }

  private buildActionContext(
    page: CardPageDef,
    opts: {
      openId: string;
      params: Record<string, unknown>;
      data: Record<string, unknown>;
      type: "button" | "form_submit";
      action: string;
      formValue: Record<string, string> | null;
      formName: string | null;
      token: string;
      updateCard: (card: CardJSON) => Promise<void>;
    },
  ): CardActionContext {
    const pageName = page.name;
    return {
      openId: opts.openId,
      params: opts.params,
      data: opts.data,
      card: (config: CardConfig) =>
        new EnhancedCardBuilder(config, pageName, opts.data),
      type: opts.type,
      action: opts.action,
      setData: (partial) => ({
        __type: "navigate" as const,
        page: pageName,
        params: opts.params,
        data: { ...opts.data, ...partial },
      }),
      formValue: opts.formValue,
      formName: opts.formName,
      token: opts.token,
      update: opts.updateCard,
      navigate: async (targetPage: string, targetParams?: Record<string, unknown>) => {
        const card = await this.renderPage(targetPage, {
          openId: opts.openId,
          params: targetParams,
        });
        if (card) {
          await opts.updateCard(card);
        }
      },
    };
  }

  private async handleActionResult(
    page: CardPageDef,
    ctx: CardActionContext,
    result: CardActionResult,
  ): Promise<CardJSON | undefined> {
    if (!result) return undefined;

    // NavigateResult → beforeLeave + beforeEnter + 调用目标页面的 render
    if (
      typeof result === "object"
      && "__type" in result
      && result.__type === "navigate"
    ) {
      const navResult = result as NavigateResult;
      const targetPage = this.pages.get(navResult.page);
      if (!targetPage) {
        console.warn(`[CardRouter] navigate target "${navResult.page}" not found`);
        return undefined;
      }

      const guardCtx: NavigationGuardContext = {
        openId: ctx.openId,
        to: { page: navResult.page, params: navResult.params },
        from: { page: page.name, params: ctx.params },
      };

      // beforeLeave 守卫（当前页面）
      if (page.beforeLeave) {
        const leaveResolved = await this.resolveGuard(await page.beforeLeave(guardCtx), guardCtx);
        if (leaveResolved.blocked) return leaveResolved.card;
      }

      // beforeEnter 守卫（目标页面，含全局守卫）
      const enterBlocked = await this.runBeforeEnter(targetPage, guardCtx);
      if (enterBlocked !== undefined) return enterBlocked;

      const targetData = navResult.data ?? targetPage.data?.() ?? {};
      const renderCtx = this.buildRenderContext(targetPage, {
        openId: ctx.openId,
        params: navResult.params,
        data: targetData,
      });
      return targetPage.render(renderCtx);
    }

    // AsyncTaskResult → 立即返回 loadingCard，后台执行 task
    if (
      typeof result === "object"
      && "__type" in result
      && result.__type === "async_task"
    ) {
      const asyncResult = result as AsyncTaskResult;
      asyncResult.task().catch((err) => {
        console.error(`[CardRouter] async task error:`, err);
      });
      return asyncResult.loadingCard;
    }

    // ToastResult → 返回飞书 toast 格式
    if (
      typeof result === "object"
      && "__type" in result
      && result.__type === "toast"
    ) {
      return {
        toast: {
          type: result.type,
          content: result.content,
        },
      };
    }

    // CardJSON → 直接返回
    return result as CardJSON;
  }

  /**
   * 执行全局 beforeEach + 页面 beforeEnter 守卫。
   * 返回 undefined 表示放行，返回 CardJSON 表示拦截（含 false 阻止时返回 null → 外层转 undefined）。
   */
  private async runBeforeEnter(
    targetPage: CardPageDef,
    guardCtx: NavigationGuardContext,
    input?: DispatchInput,
  ): Promise<CardJSON | undefined> {
    // 全局 beforeEach
    for (const guard of this.globalBeforeEach) {
      const resolved = await this.resolveGuard(await guard(guardCtx), guardCtx, input);
      if (resolved.blocked) return resolved.card;
    }
    // 页面 beforeEnter
    if (targetPage.beforeEnter) {
      const resolved = await this.resolveGuard(await targetPage.beforeEnter(guardCtx), guardCtx, input);
      if (resolved.blocked) return resolved.card;
    }
    return undefined;
  }

  /**
   * 解析守卫返回值（参考 vue-router）：
   * - true / undefined → 放行
   * - false → 阻止（保持当前卡片）
   * - CardJSON → 渲染替代卡片
   * - NavigateResult → 重定向到另一个页面
   */
  private async resolveGuard(
    guardResult: GuardResult,
    guardCtx: NavigationGuardContext,
    input?: DispatchInput,
  ): Promise<{ blocked: false } | { blocked: true; card: CardJSON | undefined }> {
    // 放行
    if (guardResult === undefined || guardResult === true) {
      return { blocked: false };
    }
    // 阻止（保持当前卡片，不导航）
    if (guardResult === false) {
      return { blocked: true, card: undefined };
    }
    // NavigateResult → 重定向
    if (
      typeof guardResult === "object"
      && "__type" in guardResult
      && guardResult.__type === "navigate"
    ) {
      const navResult = guardResult as NavigateResult;
      const redirectPage = this.pages.get(navResult.page);
      if (!redirectPage) {
        console.warn(`[CardRouter] guard redirect target "${navResult.page}" not found`);
        return { blocked: true, card: undefined };
      }
      const redirectData = navResult.data ?? redirectPage.data?.() ?? {};
      const openId = input?.openId || guardCtx.openId;
      const renderCtx = this.buildRenderContext(redirectPage, {
        openId,
        params: navResult.params,
        data: redirectData,
      });
      return { blocked: true, card: await redirectPage.render(renderCtx) };
    }
    // CardJSON → 替代卡片
    return { blocked: true, card: guardResult as CardJSON };
  }

  private buildErrorCard(err: unknown): CardJSON {
    const message = err instanceof Error ? err.message : String(err);
    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: "❌ 操作失败" },
        template: "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "plain_text",
            content: `发生了一个错误: ${message}`,
          },
        },
      ],
    };
  }
}
