import { EnhancedCardBuilder, MAX_STACK_DEPTH } from "./builder";
import { decodeStackEntry, encodeStackEntry } from "./stack";
import type {
  CardActionNavigateOpts,
  CardActionType,
  CardFormValue,
  CardParams,
  AsyncTaskResult,
  BackResult,
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
  StackEntry,
  ToastResult,
  DispatchInput,
} from "./types";

/** 类型辨别：判断 CardActionResult 的 __type */
function isResultType<T extends { __type: string }>(
  result: CardActionResult,
  type: T["__type"],
): result is T {
  return (
    typeof result === "object"
    && result !== null
    && "__type" in result
    && (result as T).__type === type
  );
}

export class CardRouter {
  private pages = new Map<string, CardPageDef>();
  private globalBeforeEach: Array<
    (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>
  > = [];

  /** 开启后在卡片底部渲染内部调试数据（stack、params、data 等） */
  debug = true;

  get pageCount(): number {
    return this.pages.size;
  }

  register(page: CardPageDef): void {
    if (this.pages.has(page.name)) {
      console.warn(
        `[CardRouter] page "${page.name}" already registered, overwriting`,
      );
    }
    this.pages.set(page.name, page);
  }

  /** 注册全局前置守卫（类似 vue-router router.beforeEach） */
  beforeEach(
    guard: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>,
  ): void {
    this.globalBeforeEach.push(guard);
  }

  private createDiBindings(initial?: Map<unknown, unknown>): {
    store: Map<unknown, unknown>;
    provide: (key: unknown, value: unknown) => void;
    inject: <T = unknown>(key: unknown, fallback?: T) => T | undefined;
  } {
    const store = initial ?? new Map<unknown, unknown>();
    const provide = (key: unknown, value: unknown): void => {
      store.set(key, value);
    };
    const inject = <T = unknown>(key: unknown, fallback?: T): T | undefined => {
      if (store.has(key)) {
        return store.get(key) as T;
      }
      return fallback;
    };
    return { store, provide, inject };
  }

  /**
   * 渲染指定页面，返回 CardJSON。
   * 用于 asyncTask task 内的异步跳转（ctx.navigate 底层调用此方法）。
   */
  async renderPage(
    pageName: string,
    opts: { openId: string; params?: CardParams },
  ): Promise<CardJSON | undefined> {
    const page = this.pages.get(pageName);
    if (!page) {
      console.warn(`[CardRouter] renderPage: page "${pageName}" not found`);
      return undefined;
    }
    const params = opts.params ?? {};
    const data = page.data?.() ?? {};
    const di = this.createDiBindings();
    const guardCtx: NavigationGuardContext = {
      openId: opts.openId,
      to: { page: page.name, params },
      from: null,
      provide: di.provide,
      inject: di.inject,
    };
    const blocked = await this.runBeforeEnter(page, guardCtx);
    if (blocked !== undefined) return blocked;
    const renderCtx = this.buildRenderContext(page, {
      openId: opts.openId,
      params,
      data,
      provide: di.provide,
      inject: di.inject,
    });
    return page.render(renderCtx);
  }

  /**
   * 分发卡片交互事件。
   * 返回卡片 JSON 或 undefined（表示不由 CardKit 处理）。
   */
  async dispatch(input: DispatchInput): Promise<CardJSON | undefined> {
    const encoded = this.parseValue(input.actionValue);
    if (!encoded || !encoded.__stack || encoded.__stack.length === 0) {
      return undefined;
    }

    // 栈顶 = 当前/目标页面
    const current = decodeStackEntry(
      encoded.__stack[encoded.__stack.length - 1]!,
    );
    // 历史栈 = 栈顶之下的所有项
    const stack = encoded.__stack.slice(0, -1);

    const page = this.pages.get(current.page);
    if (!page) {
      console.warn(`[CardRouter] page "${current.page}" not found`);
      return undefined;
    }

    try {
      const params = current.params || {};
      const data = this.resolveData(page, encoded);
      const di = this.createDiBindings();

      // ─── beforeEnter 守卫 ───
      const guardCtx: NavigationGuardContext = {
        openId: input.openId,
        to: { page: page.name, params },
        from: null,
        provide: di.provide,
        inject: di.inject,
      };
      const blocked = await this.runBeforeEnter(page, guardCtx, input);
      if (blocked !== undefined) return blocked;

      if (input.formValue) {
        // ─── 表单提交 ───
        const ctx = this.buildActionContext(page, {
          ...input,
          params,
          data,
          stack,
          type: "form_submit",
          action: "form_submit",
          formValue: input.formValue,
          formName: (encoded.__formName as string) || null,
          provide: di.provide,
          inject: di.inject,
        });
        const card = await this.handleActionResult(
          page,
          ctx,
          await page.onAction?.(ctx),
          input,
        );
        return this.injectDebug(card, {
          stack: encoded.__stack,
          action: "form_submit",
          data: encoded.__data,
        });
      }

      if (encoded.__action) {
        // ─── action 按钮 ───
        const ctx = this.buildActionContext(page, {
          ...input,
          params,
          data,
          stack,
          type: "button",
          action: encoded.__action,
          formValue: null,
          formName: null,
          provide: di.provide,
          inject: di.inject,
        });
        const card = await this.handleActionResult(
          page,
          ctx,
          await page.onAction?.(ctx),
          input,
        );
        return this.injectDebug(card, {
          stack: encoded.__stack,
          action: encoded.__action,
          data: encoded.__data,
        });
      }

      // ─── 纯 navigate ───
      const renderCtx = this.buildRenderContext(page, {
        openId: input.openId,
        params,
        data,
        stack,
        provide: di.provide,
        inject: di.inject,
      });
      const card = await page.render(renderCtx);

      // newMessage 模式：发送新卡片消息而非更新当前卡片
      if (encoded.__newMessage && card && input.sendCard) {
        await input.sendCard(card);
        return undefined;
      }
      return this.injectDebug(card, {
        stack: encoded.__stack,
        action: encoded.__action,
        data: encoded.__data,
      });
    } catch (err) {
      console.error(`[CardRouter] error in page "${current.page}":`, err);
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

    if (
      typeof current === "object"
      && current !== null
      && "__stack" in current
    ) {
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
      params: CardParams;
      data: CardParams;
      stack?: StackEntry[];
      provide: (key: unknown, value: unknown) => void;
      inject: <T = unknown>(key: unknown, fallback?: T) => T | undefined;
    },
  ): CardRenderContext {
    const stack = opts.stack ?? [];
    return {
      openId: opts.openId,
      params: opts.params,
      data: opts.data,
      stack,
      provide: opts.provide,
      inject: opts.inject,
      card: (config: CardConfig) =>
        new EnhancedCardBuilder(
          config,
          page.name,
          opts.data,
          opts.params,
          stack,
        ),
    };
  }

  private buildActionContext(
    page: CardPageDef,
    opts: {
      openId: string;
      params: CardParams;
      data: CardParams;
      stack?: StackEntry[];
      type: CardActionType;
      action: string;
      formValue: CardFormValue | null;
      formName: string | null;
      token: string;
      updateCard: (card: CardJSON) => Promise<void>;
      sendCard?: (card: CardJSON) => Promise<void>;
      provide: (key: unknown, value: unknown) => void;
      inject: <T = unknown>(key: unknown, fallback?: T) => T | undefined;
    },
  ): CardActionContext {
    const pageName = page.name;
    const stack = opts.stack ?? [];
    return {
      openId: opts.openId,
      params: opts.params,
      data: opts.data,
      stack,
      provide: opts.provide,
      inject: opts.inject,
      card: (config: CardConfig) =>
        new EnhancedCardBuilder(
          config,
          pageName,
          opts.data,
          opts.params,
          stack,
        ),
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
      navigate: async (
        targetPage: string,
        targetParams?: CardParams,
        navOpts?: CardActionNavigateOpts,
      ) => {
        const card = await this.renderPage(targetPage, {
          openId: opts.openId,
          params: targetParams,
        });
        if (card) {
          if (navOpts?.newMessage && opts.sendCard) {
            await opts.sendCard(card);
          } else {
            await opts.updateCard(card);
          }
        }
      },
      back: async () => {
        if (stack.length === 0) return;
        const target = decodeStackEntry(stack[stack.length - 1]!);
        const card = await this.renderPage(target.page, {
          openId: opts.openId,
          params: target.params,
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
    input?: DispatchInput,
  ): Promise<CardJSON | undefined> {
    if (!result) return undefined;

    // BackResult → pop 栈顶并渲染
    if (isResultType<BackResult>(result, "back")) {
      const stack = ctx.stack as StackEntry[];
      if (stack.length === 0) return undefined;
      const target = decodeStackEntry(stack[stack.length - 1]!);
      const backStack = stack.slice(0, -1);
      const targetPage = this.pages.get(target.page);
      if (!targetPage) return undefined;
      const targetData = targetPage.data?.() ?? {};
      const renderCtx = this.buildRenderContext(targetPage, {
        openId: ctx.openId,
        params: target.params || {},
        data: targetData,
        stack: backStack,
        provide: ctx.provide,
        inject: ctx.inject,
      });
      return targetPage.render(renderCtx);
    }

    // NavigateResult → beforeLeave + beforeEnter + 调用目标页面的 render
    if (isResultType<NavigateResult>(result, "navigate")) {
      const navResult = result;
      const targetPage = this.pages.get(navResult.page);
      if (!targetPage) {
        console.warn(
          `[CardRouter] navigate target "${navResult.page}" not found`,
        );
        return undefined;
      }

      const guardCtx: NavigationGuardContext = {
        openId: ctx.openId,
        to: { page: navResult.page, params: navResult.params },
        from: { page: page.name, params: ctx.params },
        provide: ctx.provide,
        inject: ctx.inject,
      };

      // beforeLeave 守卫（当前页面）
      if (page.beforeLeave) {
        const leaveResolved = await this.resolveGuard(
          await page.beforeLeave(guardCtx),
          guardCtx,
        );
        if (leaveResolved.blocked) return leaveResolved.card;
      }

      // beforeEnter 守卫（目标页面，含全局守卫）
      const enterBlocked = await this.runBeforeEnter(targetPage, guardCtx);
      if (enterBlocked !== undefined) return enterBlocked;

      // 构建目标页面的栈
      let targetStack = ctx.stack as StackEntry[];
      if (navResult.mode !== "replace") {
        targetStack = [...targetStack, encodeStackEntry(page.name, ctx.params)];
        if (targetStack.length > MAX_STACK_DEPTH)
          targetStack = targetStack.slice(-MAX_STACK_DEPTH);
      }

      const targetData = navResult.data ?? targetPage.data?.() ?? {};
      const renderCtx = this.buildRenderContext(targetPage, {
        openId: ctx.openId,
        params: navResult.params,
        data: targetData,
        stack: targetStack,
        provide: ctx.provide,
        inject: ctx.inject,
      });
      const card = await targetPage.render(renderCtx);

      // newMessage 模式：发送新卡片消息而非更新当前卡片
      if (navResult.newMessage && card && input?.sendCard) {
        await input.sendCard(card);
        return undefined;
      }
      return card;
    }

    // AsyncTaskResult → 立即返回 loadingCard，后台执行 task
    if (isResultType<AsyncTaskResult>(result, "async_task")) {
      const asyncResult = result;
      asyncResult.task().catch((err) => {
        console.error(`[CardRouter] async task error:`, err);
      });
      return asyncResult.loadingCard;
    }

    // ToastResult → 返回飞书 toast 格式
    if (isResultType<ToastResult>(result, "toast")) {
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
      const resolved = await this.resolveGuard(
        await guard(guardCtx),
        guardCtx,
        input,
      );
      if (resolved.blocked) return resolved.card;
    }
    // 页面 beforeEnter
    if (targetPage.beforeEnter) {
      const resolved = await this.resolveGuard(
        await targetPage.beforeEnter(guardCtx),
        guardCtx,
        input,
      );
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
  ): Promise<
    { blocked: false } | { blocked: true; card: CardJSON | undefined }
  > {
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
      && guardResult !== null
      && "__type" in guardResult
      && (guardResult as NavigateResult).__type === "navigate"
    ) {
      const navResult = guardResult as NavigateResult;
      const redirectPage = this.pages.get(navResult.page);
      if (!redirectPage) {
        console.warn(
          `[CardRouter] guard redirect target "${navResult.page}" not found`,
        );
        return { blocked: true, card: undefined };
      }
      const redirectData = navResult.data ?? redirectPage.data?.() ?? {};
      const openId = input?.openId || guardCtx.openId;
      const renderCtx = this.buildRenderContext(redirectPage, {
        openId,
        params: navResult.params,
        data: redirectData,
        provide: guardCtx.provide,
        inject: guardCtx.inject,
      });
      return { blocked: true, card: await redirectPage.render(renderCtx) };
    }
    // CardJSON → 替代卡片
    return { blocked: true, card: guardResult as CardJSON };
  }

  /** debug 模式：在卡片底部追加内部数据 */
  private injectDebug(
    card: CardJSON | undefined,
    info: {
      stack?: StackEntry[];
      action?: string;
      data?: Record<string, unknown>;
    },
  ): CardJSON | undefined {
    if (!this.debug || !card) return card;

    const debugObj: Record<string, unknown> = { stack: info.stack };
    if (info.action) debugObj.action = info.action;
    if (info.data && Object.keys(info.data).length > 0)
      debugObj.data = info.data;

    const debugElements = [
      { tag: "hr" },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `🐛 **Debug**\n\`\`\`json\n${JSON.stringify(debugObj, null, 2)}\n\`\`\``,
        },
      },
    ];

    // JSON 2.0: body.elements / JSON 1.0: elements
    const body = card.body as Record<string, unknown> | undefined;
    if (body && Array.isArray(body.elements)) {
      body.elements.push(...debugElements);
    } else if (Array.isArray(card.elements)) {
      (card.elements as unknown[]).push(...debugElements);
    }
    return card;
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
