interface CardConfig {
  title: string;
  theme?: "blue" | "green" | "red" | "orange" | "grey";
  icon?: string;
  /** 卡片 JSON 结构版本，默认 "1.0"。设为 "2.0" 可使用 form 容器等特性。 */
  schema?: "1.0" | "2.0";
}

interface CardElement {
  tag: string;
  [key: string]: unknown;
}

interface FormElement extends CardElement {
  tag: "form";
  name: string;
  elements: CardElement[];
}

interface ActionElement extends CardElement {
  tag: "action";
  actions: Array<{
    tag: string;
    text: { tag: string; content: string };
    type?: string;
    value?: string | Record<string, unknown>;
    url?: string;
    confirm?: {
      title: { tag: string; content: string };
      text: { tag: string; content: string };
    };
  }>;
}

interface CardHeader {
  title: {
    tag: string;
    content: string;
  };
  template: string;
}

/** JSON 2.0 输入框的输入类型 */
type InputType = "text" | "multiline_text" | "password";

/** JSON 2.0 文本标签位置 */
type LabelPosition = "top" | "left";

/** JSON 2.0 增强输入框配置 */
interface InputConfigV2 {
  /** JSON 2.0 组件唯一标识，同一卡片内全局唯一。仅允许字母、数字和下划线，必须以字母开头，不超过 20 字符。 */
  element_id?: string;
  /** 输入框的唯一标识。在表单容器中必填且全局唯一，用于识别用户提交的文本。 */
  name: string;
  /** 文本标签内容。 */
  label: string;
  /** 文本标签位置，默认 "top"。 */
  label_position?: LabelPosition;
  /** 占位文本。 */
  placeholder?: string;
  /** 预填写内容。 */
  default_value?: string;
  /** 是否必填。仅在表单容器中生效。 */
  required?: boolean;
  /** 是否禁用。 */
  disabled?: boolean;
  /** 禁用提示文案。 */
  disabled_tips?: string;
  /** 输入框宽度：default / fill / 如 "200px"。 */
  width?: string;
  /** 最大文本长度，1~1000，默认 1000。 */
  max_length?: number;
  /** 输入类型，默认 "text"。 */
  input_type?: InputType;
  /** 多行文本默认展示行数，仅 input_type 为 multiline_text 时有效，默认 5。 */
  rows?: number;
  /** 多行文本高度是否自适应，仅 PC 端生效，仅 input_type 为 multiline_text 时有效。 */
  auto_resize?: boolean;
  /** 最大展示行数，仅 auto_resize 为 true 时有效。 */
  max_rows?: number;
  /** 密码类型时是否展示前缀图标，仅 input_type 为 password 时有效。 */
  show_icon?: boolean;
  /** 组件外边距，如 "8px 0" 或 "0px 0px 8px 0"。 */
  margin?: string;
}

/** JSON 1.0 兼容输入框配置 */
interface InputConfigV1 {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** @deprecated 使用 addInputV2 的 input_type: "multiline_text" 代替 */
  multiline?: boolean;
}

export class FeishuCardBuilder {
  private config: CardConfig;
  private header: CardHeader;
  private elements: CardElement[] = [];
  /** 当前正在构建的表单容器（JSON 2.0） */
  private currentForm: FormElement | null = null;

  constructor(config: CardConfig) {
    this.config = config;
    this.header = {
      title: {
        tag: "plain_text",
        content: config.title,
      },
      template: config.theme || "blue",
    };
  }

  // ─── 基础元素（JSON 1.0 / 2.0 通用） ─────────────

  addText(content: string, isMarkdown = false): this {
    // JSON 2.0: markdown 组件使用 content 字符串直接作为内容，不再嵌套 text 对象
    if (this.config.schema === "2.0" && isMarkdown) {
      this.pushElement({
        tag: "markdown",
        content,
      });
    } else {
      this.pushElement({
        tag: isMarkdown ? "markdown" : "div",
        text: {
          tag: isMarkdown ? "lark_md" : "plain_text",
          content,
        },
      });
    }
    return this;
  }

  addDivider(): this {
    this.pushElement({ tag: "hr" });
    return this;
  }

  addFields(fields: Array<{ label: string; value: string }>): this {
    this.pushElement({
      tag: "div",
      fields: fields.map((f) => ({
        is_short: true,
        text: {
          tag: "lark_md",
          content: `**${f.label}**\n${f.value}`,
        },
      })),
    });
    return this;
  }

  // ─── 按钮 ─────────────────────────────────

  addButtons(
    buttons: Array<{
      text: string;
      value: string | Record<string, unknown>;
      type?: "default" | "primary" | "danger";
      url?: string;
      /** 如果为 true，value 直接存储（对象或已解析的值），不再包 { action: value } */
      rawValue?: boolean;
    }>,
  ): this {
    if (this.config.schema === "2.0") {
      // JSON 2.0: 单按钮独立；多按钮用 column_set 并排
      const btnElements = buttons.map((btn) => {
        const element: CardElement = {
          tag: "button",
          text: { tag: "plain_text", content: btn.text },
          type: btn.type || "default",
          value: btn.rawValue ? btn.value : { action: btn.value },
        };
        if (btn.url) {
          element.behaviors = [{ type: "open_url", default_url: btn.url }];
        }
        return element;
      });

      if (btnElements.length <= 1) {
        btnElements.forEach((el) => this.pushElement(el));
      } else {
        this.pushElement({
          tag: "column_set",
          flex_mode: "none",
          background_style: "default",
          horizontal_spacing: "default",
          columns: btnElements.map((el) => ({
            tag: "column",
            width: "auto",
            vertical_align: "top",
            elements: [el],
          })),
        });
      }
    } else {
      // JSON 1.0: action 容器包裹
      this.pushElement({
        tag: "action",
        actions: buttons.map((btn) => ({
          tag: "button",
          text: { tag: "plain_text", content: btn.text },
          type: btn.type || "default",
          value: btn.rawValue ? btn.value : JSON.stringify({ action: btn.value }),
          ...(btn.url && { url: btn.url }),
        })),
      });
    }
    return this;
  }

  addConfirm(config: { title: string; text: string }): this {
    const elements = this.currentForm
      ? this.currentForm.elements
      : this.elements;
    const target = elements[elements.length - 1];

    const confirmObj = {
      title: { tag: "plain_text", content: config.title },
      text: { tag: "plain_text", content: config.text },
    };

    if (target?.tag === "button") {
      // JSON 2.0: 直接在 button element 上设置 confirm
      target.confirm = confirmObj;
    } else if (target?.tag === "action") {
      // JSON 1.0: action 容器内所有按钮
      const actionElement = target as ActionElement;
      actionElement.actions.forEach((action) => {
        action.confirm = confirmObj;
      });
    }
    return this;
  }

  // ─── JSON 1.0 输入组件（兼容旧接口） ──────────────

  addInput(config: InputConfigV1): this {
    const element: CardElement = {
      tag: "input",
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: "plain_text",
        content: config.placeholder || "",
      },
      label: {
        tag: "plain_text",
        content: config.label,
      },
    };

    // 兼容旧 multiline 属性：转换为 JSON 2.0 的 input_type
    if (config.multiline) {
      element.input_type = "multiline_text";
    }

    this.pushElement(element);
    return this;
  }

  addSelect(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    options: Array<{ label: string; value: string }>;
  }): this {
    this.pushElement({
      tag: "select_static",
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: "plain_text",
        content: config.placeholder || "请选择",
      },
      options: config.options.map((opt) => ({
        text: {
          tag: "plain_text",
          content: opt.label,
        },
        value: opt.value,
      })),
    });
    return this;
  }

  addDatePicker(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }): this {
    const element: CardElement = {
      tag: "date_picker",
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: "plain_text",
        content: config.placeholder || "选择日期",
      },
    };
    // JSON 2.0 的 date_picker 不支持 label 属性（尤其在 form 容器内）
    if (this.config.schema !== "2.0") {
      element.label = {
        tag: "plain_text",
        content: config.label,
      };
    }
    this.pushElement(element);
    return this;
  }

  // ─── JSON 2.0 表单容器 ────────────────────────────

  /**
   * 开始一个 JSON 2.0 表单容器。
   * 后续通过 addInputV2 / addSelect / addDatePicker / addFormButtons 添加的元素会自动归入此容器。
   * 必须搭配 endForm() 使用。
   */
  addForm(config: { name: string }): this {
    if (this.currentForm) {
      throw new Error(
        "Nested forms are not supported. Call endForm() before starting a new form.",
      );
    }
    const form: FormElement = {
      tag: "form",
      name: config.name,
      elements: [],
    };
    this.currentForm = form;
    this.elements.push(form);
    return this;
  }

  /**
   * 结束当前表单容器。
   * 如果当前不在表单中则静默忽略。
   */
  endForm(): this {
    this.currentForm = null;
    return this;
  }

  /**
   * JSON 2.0 增强输入框。
   * 支持 input_type（text / multiline_text / password）、element_id、auto_resize 等完整属性。
   * 在表单容器内使用时，name 会作为 form_value 回调中的键名。
   */
  addInputV2(config: InputConfigV2): this {
    const element: CardElement = {
      tag: "input",
      name: config.name,
      placeholder: {
        tag: "plain_text",
        content: config.placeholder || "请输入",
      },
      label: {
        tag: "plain_text",
        content: config.label,
      },
    };

    // JSON 2.0 属性
    if (config.element_id) {
      element.element_id = config.element_id;
    }
    if (config.label_position) {
      element.label_position = config.label_position;
    }
    if (config.default_value !== undefined) {
      element.default_value = config.default_value;
    }
    if (config.required) {
      element.required = true;
    }
    if (config.disabled) {
      element.disabled = true;
    }
    if (config.disabled_tips) {
      element.disabled_tips = {
        tag: "plain_text",
        content: config.disabled_tips,
      };
    }
    if (config.width) {
      element.width = config.width;
    }
    if (config.max_length !== undefined) {
      element.max_length = config.max_length;
    }
    if (config.input_type && config.input_type !== "text") {
      element.input_type = config.input_type;

      if (config.input_type === "multiline_text") {
        if (config.rows !== undefined) {
          element.rows = config.rows;
        }
        if (config.auto_resize !== undefined) {
          element.auto_resize = config.auto_resize;
        }
        if (config.max_rows !== undefined) {
          element.max_rows = config.max_rows;
        }
      }

      if (config.input_type === "password" && config.show_icon !== undefined) {
        element.show_icon = config.show_icon;
      }
    }
    if (config.margin) {
      element.margin = config.margin;
    }

    this.pushElement(element);
    return this;
  }

  /**
   * 在表单容器中添加提交 / 重置按钮。
   * 使用 column_set 布局，按钮带有 action_type: "form_submit" 或 "form_reset"（JSON 2.0 规范）。
   * 应在 addForm() / endForm() 之间调用。
   */
  addFormButtons(config: {
    submit?: {
      text: string;
      name?: string;
      type?: "default" | "primary" | "primary_filled" | "danger";
      /** 提交按钮的 value（JSON 字符串），用于 CardKit 编码路由信息 */
      value?: string;
    };
    reset?: {
      text: string;
      name?: string;
      type?: "default" | "primary" | "primary_filled" | "danger";
    };
  }): this {
    const columns: Array<{
      tag: "column";
      width: string;
      vertical_align: string;
      elements: CardElement[];
    }> = [];

    if (config.submit) {
      const submitBtn: CardElement = {
        tag: "button",
        text: { tag: "plain_text", content: config.submit.text },
        type: config.submit.type || "primary",
        action_type: "form_submit",
        name: config.submit.name || "form_submit_btn",
      };
      if (config.submit.value) {
        submitBtn.value = config.submit.value;
      }
      columns.push({
        tag: "column",
        width: "auto",
        vertical_align: "top",
        elements: [submitBtn],
      });
    }

    if (config.reset) {
      columns.push({
        tag: "column",
        width: "auto",
        vertical_align: "top",
        elements: [
          {
            tag: "button",
            text: { tag: "plain_text", content: config.reset.text },
            type: config.reset.type || "default",
            action_type: "form_reset",
            name: config.reset.name || "form_reset_btn",
          },
        ],
      });
    }

    if (columns.length === 0) {
      return this;
    }

    this.pushElement({
      tag: "column_set",
      flex_mode: "none",
      background_style: "default",
      horizontal_spacing: "default",
      columns,
      margin: "0px",
    });

    return this;
  }

  // ─── 内部方法 ──────────────────────────────────────

  /**
   * 将元素推入当前表单容器（如果在表单内）或顶层 elements。
   * public 以便 EnhancedCardBuilder 等上层包装直接插入元素。
   */
  pushElement(element: CardElement): void {
    if (this.currentForm) {
      this.currentForm.elements.push(element);
    } else {
      this.elements.push(element);
    }
  }

  // ─── 构建 ──────────────────────────────────────────

  build(): {
    msg_type: string;
    card: Record<string, unknown>;
  } {
    // 如果有未关闭的表单，自动关闭
    if (this.currentForm) {
      this.currentForm = null;
    }

    if (this.config.schema === "2.0") {
      return {
        msg_type: "interactive",
        card: {
          schema: "2.0",
          header: this.header,
          body: {
            elements: this.elements,
          },
        },
      };
    }

    // JSON 1.0（默认）
    return {
      msg_type: "interactive",
      card: {
        config: {
          wide_screen_mode: true,
        },
        header: this.header,
        elements: this.elements,
      },
    };
  }
}
