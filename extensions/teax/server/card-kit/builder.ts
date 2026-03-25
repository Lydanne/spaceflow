import { FeishuCardBuilder } from "~~/server/utils/feishu-card-builder";
import type {
  ButtonOpts,
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
} from "./types";

// ─── EnhancedCardBuilder ──────────────────────────

export class EnhancedCardBuilder implements EnhancedCardBuilderInterface {
  private inner: FeishuCardBuilder;
  private pageName: string;
  /** 当前页面状态（编码到每个 action 按钮的 value.__data 中） */
  private currentData: Record<string, unknown>;
  /** 当前 form 名称（form() 时设置，endForm() 时清除） */
  private currentFormName: string | null = null;

  constructor(
    config: CardConfig,
    pageName: string,
    data: Record<string, unknown> = {},
  ) {
    this.inner = new FeishuCardBuilder({ ...config, schema: "2.0" });
    this.pageName = pageName;
    this.currentData = data;
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
      options: config.options,
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
      const colBuilder = new ColumnBuilder(this.pageName, this.currentData);
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
    const csBuilder = new ColumnSetBuilder(this.pageName, this.currentData);
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
    const submitValue: Record<string, unknown> = {
      __page: this.pageName,
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

  // ─── 普通按钮（三种模式）───

  button(text: string, opts?: ButtonOpts): this {
    if (opts?.navigate) {
      this.inner.addButtons([
        {
          text,
          type: opts.type,
          value: {
            __page: opts.navigate[0],
            __params: opts.navigate[1] || {},
          },
          rawValue: true,
        },
      ]);
    } else if (opts?.url) {
      this.inner.addButtons([
        { text, type: opts.type, value: "", url: opts.url },
      ]);
    } else if (opts?.action) {
      const value: Record<string, unknown> = {
        __page: this.pageName,
        __action: opts.action,
        __params: opts.params || {},
      };
      if (Object.keys(this.currentData).length > 0) {
        value.__data = this.currentData;
      }
      this.inner.addButtons([
        {
          text,
          type: opts.type,
          value,
          rawValue: true,
        },
      ]);
    }
    return this;
  }

  buttons(items: EnhancedButtonConfig[]): this {
    items.forEach((btn) => this.button(btn.text, btn));
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
  private elements: CardElement[] = [];

  constructor(pageName: string, data: Record<string, unknown> = {}) {
    this.pageName = pageName;
    this.currentData = data;
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

  button(text: string, opts?: ButtonOpts): this {
    if (opts?.navigate) {
      this.elements.push({
        tag: "button",
        text: { tag: "plain_text", content: text },
        type: opts.type || "default",
        value: {
          __page: opts.navigate[0],
          __params: opts.navigate[1] || {},
        },
      });
    } else if (opts?.action) {
      const value: Record<string, unknown> = {
        __page: this.pageName,
        __action: opts.action,
        __params: opts.params || {},
      };
      if (Object.keys(this.currentData).length > 0) {
        value.__data = this.currentData;
      }
      this.elements.push({
        tag: "button",
        text: { tag: "plain_text", content: text },
        type: opts.type || "default",
        value,
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
      const colBuilder = new ColumnBuilder(this.pageName, this.currentData);
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
  private cols: CardElement[] = [];

  constructor(pageName: string, data: Record<string, unknown> = {}) {
    this.pageName = pageName;
    this.currentData = data;
  }

  column(
    opts: {
      width?: "weighted" | "auto";
      weight?: number;
      verticalAlign?: string;
    },
    cb: (col: ColumnBuilderInterface) => void,
  ): this {
    const colBuilder = new ColumnBuilder(this.pageName, this.currentData);
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
