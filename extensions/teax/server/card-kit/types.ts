// ─── 卡片 JSON ──────────────────────────

/** 卡片 JSON（1.0 或 2.0 均可） */
export type CardJSON = Record<string, unknown>;

/** 卡片配置 */
export interface CardConfig {
  title: string;
  theme?: "blue" | "green" | "red" | "orange" | "grey";
  icon?: string;
}

/** 卡片元素 */
export interface CardElement {
  tag: string;
  [key: string]: unknown;
}

// ─── 页面栈 ──────────────────────────

/** 页面栈条目："pageName?key=val&nested[k]=v" */
export type StackEntry = string;

/** back() 返回值，从栈中弹出上一页并渲染 */
export interface BackResult {
  __type: "back";
}

// ─── 导航守卫 ──────────────────────────

/** 导航守卫上下文（类似 vue-router 的 to/from） */
export interface NavigationGuardContext {
  /** 当前用户 openId */
  openId: string;
  /** 目标页面名称 */
  to: { page: string; params: Record<string, unknown> };
  /** 来源页面名称（首次进入时为 null） */
  from: { page: string; params: Record<string, unknown> } | null;
}

/**
 * 导航守卫返回值（参考 vue-router）：
 * - `undefined | true` → 放行
 * - `false` → 阻止导航（保持当前卡片，返回 undefined）
 * - `CardJSON` → 阻止并渲染替代卡片
 * - `NavigateResult` → 重定向到另一个页面
 */
export type GuardResult = boolean | CardJSON | NavigateResult | undefined;

// ─── 页面定义 ──────────────────────────

/** 卡片页面定义 */
export interface CardPageDef<
  D extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 页面唯一标识，作为路由地址。建议格式: "module-page"，如 "cp-home" */
  name: string;

  /**
   * 可选，声明页面初始状态。
   * 状态编码在每个 action 按钮的 value.__data 中，
   * 点击时飞书原样返回，实现零存储状态管理。
   */
  data?: () => D;

  /**
   * 进入页面前的导航守卫（类似 vue-router beforeEnter）。
   * 在 render 和 onAction 之前执行。
   * - 返回 undefined / true → 放行
   * - 返回 false → 阻止
   * - 返回 CardJSON → 渲染替代卡片
   * - 返回 NavigateResult → 重定向
   */
  beforeEnter?: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;

  /**
   * 离开页面时的导航守卫（类似 vue-router beforeRouteLeave）。
   * 仅在 onAction 返回 NavigateResult 时触发。
   * - 返回 undefined / true → 放行
   * - 返回 false → 阻止导航
   * - 返回 CardJSON → 渲染替代卡片
   */
  beforeLeave?: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;

  /** 渲染卡片。ctx.data 包含当前状态，ctx.params 来自 navigate() 参数。 */
  render: (ctx: CardRenderContext<D>) => Promise<CardJSON>;

  /**
   * 处理所有交互（按钮点击 + 表单提交）。
   * - ctx.type 区分交互类型："button" | "form_submit"
   * - ctx.action 标识按钮行为（表单提交时为 "form_submit"）
   * - ctx.data 当前状态，ctx.setData() 更新状态并重渲染
   * - ctx.formValue 取表单数据（仅 form_submit 时有值）
   */
  onAction?: (ctx: CardActionContext<D>) => CardActionResult | Promise<CardActionResult>;
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
  /** 当前页面栈（只读） */
  stack: readonly StackEntry[];
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
  update: (card: CardJSON) => Promise<void>;
  /**
   * 异步跳转：渲染目标页面并 update（或 sendCard）。
   * 适用于 asyncTask task 内需要"跳转"到另一个页面的场景。
   * opts.newMessage 为 true 时发送新卡片消息而非更新当前卡片。
   */
  navigate: (page: string, params?: Record<string, unknown>, opts?: { newMessage?: boolean }) => Promise<void>;
  /** 返回上一页（pop 栈顶，渲染并 update） */
  back: () => Promise<void>;
}

// ─── 返回值 ──────────────────────────

/** navigate() 返回值，用于页面跳转 */
export interface NavigateResult {
  __type: "navigate";
  page: string;
  params: Record<string, unknown>;
  data?: Record<string, unknown>;
  /** 为 true 时发送新卡片消息而非更新当前卡片 */
  newMessage?: boolean;
  /** push: 将当前页面压入栈（默认，可 back 返回）；replace: 不压栈 */
  mode?: "push" | "replace";
}

/** toast() 返回值 */
export interface ToastResult {
  __type: "toast";
  type: "success" | "info" | "warning" | "error";
  content: string;
}

/** 异步任务返回值：立即渲染 loadingCard，后台执行 task 通过 updateCard 更新结果 */
export interface AsyncTaskResult {
  __type: "async_task";
  /** 立即返回给飞书渲染的 loading 卡片 */
  loadingCard: CardJSON;
  /** 后台异步执行的任务，通过闭包访问 ctx.update 更新最终结果 */
  task: () => Promise<void>;
}

/** onAction 的返回值 */
export type CardActionResult
  = | NavigateResult
    | BackResult
    | ToastResult
    | AsyncTaskResult
    | CardJSON
    | undefined;

// ─── Builder 配置 ──────────────────────────

/** 按钮类型 */
export type ButtonType = "default" | "primary" | "danger";

/** navigate 按钮的选项（元组第三参数） */
export interface ButtonNavigateOpts {
  newMessage?: boolean;
  mode?: "push" | "replace";
}

/** 按钮配置 */
export interface ButtonOpts {
  type?: ButtonType;
  /** 跳转到指定页面 [pageName, params?, opts?] */
  navigate?: [string, Record<string, unknown>?, ButtonNavigateOpts?];
  /** 按钮行为标识，回调到当前页面 onAction */
  action?: string;
  /** 额外参数（与 action 配合使用） */
  params?: Record<string, unknown>;
  /** 打开外部链接，不触发回调 */
  url?: string;
  /** 返回上一页（从栈中 pop） */
  back?: boolean;
  /** 刷新当前页面（重新渲染，不压栈） */
  refresh?: boolean;
}

/** 批量按钮配置 */
export interface EnhancedButtonConfig extends ButtonOpts {
  text: string;
}

/** navigate() 辅助函数选项 */
export interface NavigateOpts {
  data?: Record<string, unknown>;
  newMessage?: boolean;
  /** push: 将当前页面压入栈（默认）；replace: 不压栈 */
  mode?: "push" | "replace";
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
  /** true 或 string（提示文案）时禁用 */
  disabled?: boolean | string;
  margin?: string;
}

/** 下拉选择配置 */
export interface SelectConfig {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  /** true 或 string（提示文案）时禁用，用只读 input 替代 */
  disabled?: boolean | string;
  options: Array<{ label: string; value: string }>;
  /** 默认选中项的 value */
  initial_option?: string;
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
  /** 返回上一页按钮（从栈中 pop，栈为空时不渲染） */
  backButton(text?: string, opts?: { type?: ButtonType }): this;
  /** 底部系统按钮：默认 [⬅️ 返回, 🔄 刷新]，可传入额外按钮追加在后面。自动加 divider */
  systemButtons(extra?: EnhancedButtonConfig[]): this;
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
  /** 页面栈，栈顶（最后一项）= 当前/目标页面 */
  __stack: StackEntry[];
  __action?: string;
  __data?: Record<string, unknown>;
  __formName?: string;
  __newMessage?: boolean;
}

export interface CardInteractionContext {
  action: Record<string, unknown>;
  openId: string;
  token: string;
  updateCard?: (card: Record<string, unknown>) => Promise<void>;
  sendCard?: (card: Record<string, unknown>) => Promise<void>;
}
