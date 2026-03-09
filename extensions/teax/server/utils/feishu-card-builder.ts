interface CardConfig {
  title: string;
  theme?: "blue" | "green" | "red" | "orange" | "grey";
  icon?: string;
}

interface CardElement {
  tag: string;
  [key: string]: unknown;
}

interface ActionElement extends CardElement {
  tag: "action";
  actions: Array<{
    tag: string;
    text: { tag: string; content: string };
    type?: string;
    value?: string;
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

export class FeishuCardBuilder {
  private config: CardConfig;
  private header: CardHeader;
  private elements: CardElement[] = [];

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

  addText(content: string, isMarkdown = false): this {
    this.elements.push({
      tag: isMarkdown ? "markdown" : "div",
      text: {
        tag: isMarkdown ? "lark_md" : "plain_text",
        content,
      },
    });
    return this;
  }

  addDivider(): this {
    this.elements.push({ tag: "hr" });
    return this;
  }

  addFields(fields: Array<{ label: string; value: string }>): this {
    this.elements.push({
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

  addButtons(
    buttons: Array<{
      text: string;
      value: string;
      type?: "default" | "primary" | "danger";
      url?: string;
    }>,
  ): this {
    this.elements.push({
      tag: "action",
      actions: buttons.map((btn) => ({
        tag: "button",
        text: {
          tag: "plain_text",
          content: btn.text,
        },
        type: btn.type || "default",
        value: JSON.stringify({ action: btn.value }),
        ...(btn.url && { url: btn.url }),
      })),
    });
    return this;
  }

  addInput(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    multiline?: boolean;
  }): this {
    this.elements.push({
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
      ...(config.multiline && { multiline: true }),
    });
    return this;
  }

  addSelect(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    options: Array<{ label: string; value: string }>;
  }): this {
    this.elements.push({
      tag: "select_static",
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: "plain_text",
        content: config.placeholder || "请选择",
      },
      label: {
        tag: "plain_text",
        content: config.label,
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
    this.elements.push({
      tag: "date_picker",
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: "plain_text",
        content: config.placeholder || "选择日期",
      },
      label: {
        tag: "plain_text",
        content: config.label,
      },
    });
    return this;
  }

  addConfirm(config: { title: string; text: string }): this {
    const lastElement = this.elements[this.elements.length - 1];
    if (lastElement?.tag === "action") {
      const actionElement = lastElement as ActionElement;
      actionElement.actions.forEach((action) => {
        action.confirm = {
          title: {
            tag: "plain_text",
            content: config.title,
          },
          text: {
            tag: "plain_text",
            content: config.text,
          },
        };
      });
    }
    return this;
  }

  build(): {
    msg_type: string;
    card: {
      config: { wide_screen_mode: boolean };
      header: CardHeader;
      elements: CardElement[];
    };
  } {
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
