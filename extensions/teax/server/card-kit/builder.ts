import { FeishuCardBuilder } from "~~/server/utils/feishu-card-builder";
import type {
  ButtonOpts,
  ButtonType,
  CardConfig,
  CardElement,
  CardJSON,
  ColumnDef,
  ColumnSetOpts,
  EnhancedButtonConfig,
  EnhancedCardBuilderInterface,
  ColumnBuilderInterface,
  ColumnSetBuilderInterface,
  InputConfig,
  InputV2Config,
  SelectConfig,
  StackEntry,
} from "./types";
import { encodeStackEntry } from "./stack";

// ─── 常量 + 工具函数 ──────────────────────────

/** 栈最大深度，超出时丢弃栈底 */
export const MAX_STACK_DEPTH = 9;

interface ValueBuildCtx {
  pageName: string;
  params: Record<string, unknown>;
  data: Record<string, unknown>;
  stack: StackEntry[];
}

/** 构建 navigate 类型按钮的 value 对象 */
function buildNavValue(
  ctx: ValueBuildCtx,
  nav: NonNullable<ButtonOpts["navigate"]>,
): Record<string, unknown> {
  const target = encodeStackEntry(nav[0], nav[1]);
  let stack: StackEntry[];
  if (nav[2]?.mode === "push") {
    // push: 保留历史栈 + 当前页面 + 目标页面
    stack = [...ctx.stack, encodeStackEntry(ctx.pageName, ctx.params), target];
    stack = stack.slice(-MAX_STACK_DEPTH);
  } else {
    // replace: 保留历史栈 + 目标页面（不压入当前页面）
    stack = [...ctx.stack, target];
  }
  const value: Record<string, unknown> = { __stack: stack };
  if (nav[2]?.newMessage) {
    value.__newMessage = true;
  }
  return value;
}

/** 构建 back 类型按钮的 value 对象，历史栈为空时返回 null */
function buildBackValue(stack: StackEntry[]): Record<string, unknown> | null {
  // stack 是历史栈（不含当前页面），栈顶即返回目标
  if (stack.length === 0) return null;
  return { __stack: stack };
}

/** 构建 action 类型按钮的 value 对象 */
function buildActionValue(
  ctx: ValueBuildCtx,
  action: string,
  extraParams?: Record<string, unknown>,
): Record<string, unknown> {
  // 栈顶 = 当前页面（带 action 的额外 params）
  const current = encodeStackEntry(ctx.pageName, extraParams);
  const value: Record<string, unknown> = {
    __stack: [...ctx.stack, current],
    __action: action,
  };
  if (Object.keys(ctx.data).length > 0) {
    value.__data = ctx.data;
  }
  return value;
}

// ─── EnhancedCardBuilder ──────────────────────────

export class EnhancedCardBuilder implements EnhancedCardBuilderInterface {
  private inner: FeishuCardBuilder;
  private pageName: string;
  /** 当前页面状态（编码到每个 action 按钮的 value.__data 中） */
  private currentData: Record<string, unknown>;
  /** 当前页面参数（编码到 __stack 栈顶的 params 中） */
  private currentParams: Record<string, unknown>;
  /** 当前 form 名称（form() 时设置，endForm() 时清除） */
  private currentFormName: string | null = null;
  /** 当前页面栈（从 dispatch 透传，用于 push/back 编码） */
  private currentStack: StackEntry[];

  constructor(
    config: CardConfig,
    pageName: string,
    data: Record<string, unknown> = {},
    params: Record<string, unknown> = {},
    stack: StackEntry[] = [],
  ) {
    this.inner = new FeishuCardBuilder(config);
    this.pageName = pageName;
    this.currentData = data;
    this.currentParams = params;
    this.currentStack = stack;
  }

  // ─── 基础元素（委托给 inner）───

  text(content: string, isMarkdown?: boolean): this {
    this.inner.addText(content, isMarkdown);
    return this;
  }

  divider(): this {
    this.inner.addDivider();
    return this;
  }

  fields(items: Array<{ label: string; value: string }>): this {
    this.inner.addFields(items);
    return this;
  }

  input(config: InputConfig): this {
    this.inner.addInput(config);
    return this;
  }

  inputV2(config: InputV2Config): this {
    this.inner.addInputV2(config);
    return this;
  }

  select(config: SelectConfig): this {
    this.inner.addSelect({
      name: config.name,
      label: config.label || config.name,
      placeholder: config.placeholder,
      required: config.required,
      disabled: config.disabled,
      options: config.options,
      initial_option: config.initial_option,
    });
    return this;
  }

  // ─── 表单容器 ───

  form(name: string): this {
    this.currentFormName = name;
    this.inner.addForm({ name });
    return this;
  }

  endForm(): this {
    this.currentFormName = null;
    this.inner.endForm();
    return this;
  }

  // ─── 布局组件 ───

  columns(cols: ColumnDef[]): this {
    const columns = cols.map((def) => {
      const colBuilder = new ColumnBuilder(this.pageName, this.currentData, this.currentStack);
      def.elements(colBuilder);
      return {
        tag: "column" as const,
        width: def.width || "weighted",
        weight: def.weight || 1,
        vertical_align: def.verticalAlign || "top",
        elements: colBuilder.getElements(),
      };
    });
    this.inner.pushElement({
      tag: "column_set",
      flex_mode: "none",
      horizontal_spacing: "default",
      columns,
    });
    return this;
  }

  columnSet(
    opts: ColumnSetOpts,
    cb: (cs: ColumnSetBuilderInterface) => void,
  ): this {
    const csBuilder = new ColumnSetBuilder(this.pageName, this.currentData, this.currentStack);
    cb(csBuilder);
    this.inner.pushElement({
      tag: "column_set",
      flex_mode: opts.flexMode || "none",
      horizontal_spacing: opts.horizontalSpacing || "default",
      background_style: opts.backgroundStyle || "default",
      columns: csBuilder.getColumns(),
    });
    return this;
  }

  // ─── 表单按钮 ───

  formButtons(config: {
    submit?: {
      text: string;
      type?: "default" | "primary" | "primary_filled" | "danger";
    };
    reset?: {
      text: string;
      type?: "default" | "primary" | "primary_filled" | "danger";
    };
  }): this {
    const current = encodeStackEntry(this.pageName, this.currentParams);
    const submitValue: Record<string, unknown> = {
      __stack: [...this.currentStack, current],
      __formName: this.currentFormName,
    };
    if (Object.keys(this.currentData).length > 0) {
      submitValue.__data = this.currentData;
    }
    this.inner.addFormButtons({
      submit: config.submit
        ? {
            ...config.submit,
            value: JSON.stringify(submitValue),
          }
        : undefined,
      reset: config.reset,
    });
    return this;
  }

  // ─── value 构建上下文 ───

  private get valueCtx(): ValueBuildCtx {
    return {
      pageName: this.pageName,
      params: this.currentParams,
      data: this.currentData,
      stack: this.currentStack,
    };
  }

  // ─── 普通按钮（多种模式）───

  button(text: string, opts?: ButtonOpts): this {
    if (opts?.back) {
      return this.backButton(text, { type: opts.type });
    }
    if (opts?.navigate) {
      this.inner.addButtons([
        { text, type: opts.type, value: buildNavValue(this.valueCtx, opts.navigate), rawValue: true },
      ]);
    } else if (opts?.url) {
      this.inner.addButtons([
        { text, type: opts.type, value: "", url: opts.url },
      ]);
    } else if (opts?.action) {
      this.inner.addButtons([
        { text, type: opts.type, value: buildActionValue(this.valueCtx, opts.action, opts.params), rawValue: true },
      ]);
    }
    return this;
  }

  buttons(items: EnhancedButtonConfig[]): this {
    const rawButtons: Array<{
      text: string;
      value: string | Record<string, unknown>;
      type?: ButtonType;
      url?: string;
      rawValue?: boolean;
    }> = [];

    for (const btn of items) {
      if (btn.back) {
        const bv = buildBackValue(this.currentStack);
        if (bv) rawButtons.push({ text: btn.text, type: btn.type, value: bv, rawValue: true });
        continue;
      }
      if (btn.navigate) {
        rawButtons.push({ text: btn.text, type: btn.type, value: buildNavValue(this.valueCtx, btn.navigate), rawValue: true });
      } else if (btn.url) {
        rawButtons.push({ text: btn.text, type: btn.type, value: "", url: btn.url });
      } else if (btn.action) {
        rawButtons.push({ text: btn.text, type: btn.type, value: buildActionValue(this.valueCtx, btn.action, btn.params), rawValue: true });
      }
    }

    if (rawButtons.length > 0) {
      this.inner.addButtons(rawButtons);
    }
    return this;
  }

  // ─── 返回按钮 ───

  backButton(text?: string, opts?: { type?: ButtonType }): this {
    const bv = buildBackValue(this.currentStack);
    if (!bv) return this;
    this.inner.addButtons([
      { text: text || "⬅️ 返回", type: opts?.type || "default", value: bv, rawValue: true },
    ]);
    return this;
  }

  // ─── 构建 ───

  build(): CardJSON {
    return this.inner.build().card;
  }
}

// ─── ColumnBuilder ──────────────────────────

export class ColumnBuilder implements ColumnBuilderInterface {
  private pageName: string;
  private currentData: Record<string, unknown>;
  private currentStack: StackEntry[];
  private elements: CardElement[] = [];

  constructor(pageName: string, data: Record<string, unknown> = {}, stack: StackEntry[] = []) {
    this.pageName = pageName;
    this.currentData = data;
    this.currentStack = stack;
  }

  text(content: string, isMarkdown?: boolean): this {
    if (isMarkdown) {
      this.elements.push({ tag: "markdown", content });
    } else {
      this.elements.push({
        tag: "div",
        text: { tag: "plain_text", content },
      });
    }
    return this;
  }

  divider(): this {
    this.elements.push({ tag: "hr" });
    return this;
  }

  fields(items: Array<{ label: string; value: string }>): this {
    this.elements.push({
      tag: "div",
      fields: items.map((f) => ({
        is_short: true,
        text: { tag: "lark_md", content: `**${f.label}**\n${f.value}` },
      })),
    });
    return this;
  }

  private get valueCtx(): ValueBuildCtx {
    return {
      pageName: this.pageName,
      params: {},
      data: this.currentData,
      stack: this.currentStack,
    };
  }

  button(text: string, opts?: ButtonOpts): this {
    if (opts?.back) {
      const bv = buildBackValue(this.currentStack);
      if (bv) {
        this.elements.push({
          tag: "button",
          text: { tag: "plain_text", content: text },
          type: opts.type || "default",
          value: bv,
        });
      }
    } else if (opts?.navigate) {
      this.elements.push({
        tag: "button",
        text: { tag: "plain_text", content: text },
        type: opts.type || "default",
        value: buildNavValue(this.valueCtx, opts.navigate),
      });
    } else if (opts?.action) {
      this.elements.push({
        tag: "button",
        text: { tag: "plain_text", content: text },
        type: opts.type || "default",
        value: buildActionValue(this.valueCtx, opts.action, opts.params),
      });
    }
    return this;
  }

  buttons(items: EnhancedButtonConfig[]): this {
    items.forEach((btn) => this.button(btn.text, btn));
    return this;
  }

  columns(cols: ColumnDef[]): this {
    const columns = cols.map((def) => {
      const colBuilder = new ColumnBuilder(this.pageName, this.currentData, this.currentStack);
      def.elements(colBuilder);
      return {
        tag: "column" as const,
        width: def.width || "weighted",
        weight: def.weight || 1,
        vertical_align: def.verticalAlign || "top",
        elements: colBuilder.getElements(),
      };
    });
    this.elements.push({
      tag: "column_set",
      flex_mode: "none",
      horizontal_spacing: "default",
      columns,
    });
    return this;
  }

  getElements(): CardElement[] {
    return this.elements;
  }
}

// ─── ColumnSetBuilder ──────────────────────────

export class ColumnSetBuilder implements ColumnSetBuilderInterface {
  private pageName: string;
  private currentData: Record<string, unknown>;
  private currentStack: StackEntry[];
  private cols: CardElement[] = [];

  constructor(pageName: string, data: Record<string, unknown> = {}, stack: StackEntry[] = []) {
    this.pageName = pageName;
    this.currentData = data;
    this.currentStack = stack;
  }

  column(
    opts: {
      width?: "weighted" | "auto";
      weight?: number;
      verticalAlign?: string;
    },
    cb: (col: ColumnBuilderInterface) => void,
  ): this {
    const colBuilder = new ColumnBuilder(this.pageName, this.currentData, this.currentStack);
    cb(colBuilder);
    this.cols.push({
      tag: "column",
      width: opts.width || "weighted",
      weight: opts.weight || 1,
      vertical_align: opts.verticalAlign || "top",
      elements: colBuilder.getElements(),
    });
    return this;
  }

  getColumns(): CardElement[] {
    return this.cols;
  }
}
