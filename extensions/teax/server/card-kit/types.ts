// ─── 卡片 JSON ──────────────────────────

/** 卡片 JSON（1.0 或 2.0 均可） */
export type CardJSON = Record<string, unknown>;

/** 卡片配置 */
export interface CardConfig {
  title: string;
  theme?: "blue" | "green" | "red" | "orange" | "grey";
  icon?: string;
  schema?: "1.0" | "2.0";
}

/** 卡片元素 */
export interface CardElement {
  tag: string;
  [key: string]: unknown;
}

// ─── 页面定义 ──────────────────────────

/** 卡片页面定义 */
export interface CardPageDef<
  D extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 页面唯一标识，作为路由地址。建议格式: "module:page"，如 "cp:home" */
  name: string;

  /**
   * 可选，声明页面初始状态。
   * 状态编码在每个 action 按钮的 value.__data 中，
   * 点击时飞书原样返回，实现零存储状态管理。
   */
  data?: () => D;

  /** 渲染卡片。ctx.data 包含当前状态，ctx.params 来自 navigate() 参数。 */
  render: (ctx: CardRenderContext<D>) => Promise<CardJSON>;

  /**
   * 处理所有交互（按钮点击 + 表单提交）。
   * - ctx.type 区分交互类型："button" | "form_submit"
   * - ctx.action 标识按钮行为（表单提交时为 "form_submit"）
   * - ctx.data 当前状态，ctx.setData() 更新状态并重渲染
   * - ctx.formValue 取表单数据（仅 form_submit 时有值）
   */
  onAction?: (ctx: CardActionContext<D>) => Promise<CardActionResult>;
}

// ─── 上下文 ──────────────────────────

/** 渲染上下文 */
export interface CardRenderContext<
  D extends Record<string, unknown> = Record<string, unknown>,
> {
  openId: string;
  params: Record<string, unknown>;
  /** 当前页面状态（首次渲染用 data() 初始值，后续从 value.__data 解码） */
  data: D;
  /** 创建 EnhancedCardBuilder，自动绑定 pageName + data */
  card: (config: CardConfig) => EnhancedCardBuilderInterface;
}

/** 交互上下文（按钮点击 + 表单提交统一） */
export interface CardActionContext<
  D extends Record<string, unknown> = Record<string, unknown>,
> extends CardRenderContext<D> {
  /** 交互类型 */
  type: "button" | "form_submit";
  /** 按钮的 action 标识（来自 button({ action: "approve" })），表单提交时为 "form_submit" */
  action: string;
  /**
   * 更新页面状态并重渲染当前页面。
   * 底层等价于 navigate(当前页面, 当前params, { data: merge(ctx.data, partial) })
   */
  setData: (partial: Partial<D>) => NavigateResult;
  /** 表单字段值（仅 type === "form_submit" 时有值） */
  formValue: Record<string, string> | null;
  /** 表单名称（仅 type === "form_submit" 时有值，来自 formButtons 编码的 __formName） */
  formName: string | null;
  /** 飞书回调 token */
  token: string;
  /** 更新当前卡片 */
  updateCard: (card: CardJSON) => Promise<void>;
}

// ─── 返回值 ──────────────────────────

/** navigate() 返回值，用于页面跳转 */
export interface NavigateResult {
  __type: "navigate";
  page: string;
  params: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/** toast() 返回值 */
export interface ToastResult {
  __type: "toast";
  type: "success" | "info" | "warning" | "error";
  content: string;
}

/** onAction 的返回值 */
export type CardActionResult
  = | NavigateResult
    | ToastResult
    | CardJSON
    | undefined;

// ─── Builder 配置 ──────────────────────────

/** 按钮配置 */
export interface ButtonOpts {
  type?: "default" | "primary" | "danger";
  /** 跳转到指定页面 [pageName, params] */
  navigate?: [string, Record<string, unknown>?];
  /** 按钮行为标识，回调到当前页面 onAction */
  action?: string;
  /** 额外参数（与 action 配合使用） */
  params?: Record<string, unknown>;
  /** 打开外部链接，不触发回调 */
  url?: string;
}

/** 批量按钮配置 */
export interface EnhancedButtonConfig extends ButtonOpts {
  text: string;
}

/** 输入框配置 */
export interface InputConfig {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

/** JSON 2.0 输入框配置 */
export interface InputV2Config {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  default_value?: string;
  input_type?: "text" | "multiline_text" | "password";
  label_position?: "top" | "left";
  width?: string;
  max_length?: number;
  rows?: number;
  auto_resize?: boolean;
  max_rows?: number;
  show_icon?: boolean;
  disabled?: boolean;
  disabled_tips?: string;
  margin?: string;
}

/** 下拉选择配置 */
export interface SelectConfig {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options: Array<{ label: string; value: string }>;
}

// ─── 布局配置 ──────────────────────────

/** columns() 快捷多列的列定义 */
export interface ColumnDef {
  width?: "weighted" | "auto";
  weight?: number;
  verticalAlign?: "top" | "center" | "bottom";
  /** 回调声明列内元素 */
  elements: (col: ColumnBuilderInterface) => void;
}

/** columnSet() 完整布局选项 */
export interface ColumnSetOpts {
  flexMode?: "none" | "stretch" | "flow" | "bisect" | "trisect";
  horizontalSpacing?: "default" | "small";
  backgroundStyle?: "default" | "grey";
}

// ─── Builder 接口（避免循环依赖） ──────────────────────────

export interface EnhancedCardBuilderInterface {
  text(content: string, isMarkdown?: boolean): this;
  divider(): this;
  fields(items: Array<{ label: string; value: string }>): this;
  input(config: InputConfig): this;
  inputV2(config: InputV2Config): this;
  select(config: SelectConfig): this;
  form(name: string): this;
  endForm(): this;
  columns(cols: ColumnDef[]): this;
  columnSet(
    opts: ColumnSetOpts,
    cb: (cs: ColumnSetBuilderInterface) => void,
  ): this;
  formButtons(config: {
    submit?: { text: string; type?: string };
    reset?: { text: string; type?: string };
  }): this;
  button(text: string, opts?: ButtonOpts): this;
  buttons(items: EnhancedButtonConfig[]): this;
  build(): CardJSON;
}

export interface ColumnBuilderInterface {
  text(content: string, isMarkdown?: boolean): this;
  divider(): this;
  fields(items: Array<{ label: string; value: string }>): this;
  button(text: string, opts?: ButtonOpts): this;
  buttons(items: EnhancedButtonConfig[]): this;
  columns(cols: ColumnDef[]): this;
}

export interface ColumnSetBuilderInterface {
  column(
    opts: {
      width?: "weighted" | "auto";
      weight?: number;
      verticalAlign?: string;
    },
    cb: (col: ColumnBuilderInterface) => void,
  ): this;
}

// ─── value 编码保留字段 ──────────────────────────

export interface EncodedValue {
  __page: string;
  __params?: Record<string, unknown>;
  __action?: string;
  __data?: Record<string, unknown>;
  __formName?: string;
}
