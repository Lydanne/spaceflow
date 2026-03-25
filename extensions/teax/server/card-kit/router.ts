import { EnhancedCardBuilder } from "./builder";
import type {
  CardActionContext,
  CardActionResult,
  CardConfig,
  CardJSON,
  CardPageDef,
  CardRenderContext,
  EncodedValue,
  NavigateResult,
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

  get pageCount(): number {
    return this.pages.size;
  }

  register(page: CardPageDef): void {
    if (this.pages.has(page.name)) {
      console.warn(`[CardRouter] page "${page.name}" already registered, overwriting`);
    }
    this.pages.set(page.name, page);
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
      updateCard: opts.updateCard,
    };
  }

  private async handleActionResult(
    page: CardPageDef,
    ctx: CardActionContext,
    result: CardActionResult,
  ): Promise<CardJSON | undefined> {
    if (!result) return undefined;

    // NavigateResult → 调用目标页面的 render
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
      const targetData = navResult.data ?? targetPage.data?.() ?? {};
      const renderCtx = this.buildRenderContext(targetPage, {
        openId: ctx.openId,
        params: navResult.params,
        data: targetData,
      });
      return targetPage.render(renderCtx);
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
