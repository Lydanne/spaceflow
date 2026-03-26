import { defineCardPage, navigate } from "~~/server/card-kit";

export default defineCardPage({
  name: "test-form",

  async render(_ctx) {
    return _ctx
      .card({ title: "🧪 表单组件测试", theme: "blue" })
      .text(
        "此卡片使用 **JSON 2.0** 结构，演示 `form` 表单容器中的输入组件。\n填写后点击「提交」查看回传数据。",
        true,
      )
      .divider()
      .form("test_form")
      .inputV2({
        name: "test_username",
        label: "用户名",
        placeholder: "请输入用户名",
        required: true,
        max_length: 30,
        label_position: "left",
      })
      .inputV2({
        name: "test_password",
        label: "密码",
        placeholder: "请输入密码",
        input_type: "password",
        show_icon: true,
      })
      .inputV2({
        name: "test_address",
        label: "收货地址",
        placeholder: "请输入详细地址...",
        input_type: "multiline_text",
        rows: 3,
        auto_resize: true,
        max_rows: 8,
      })
      .select({
        name: "test_priority",
        label: "优先级",
        placeholder: "请选择优先级",
        required: true,
        options: [
          { label: "🟢 低", value: "low" },
          { label: "🟡 中", value: "medium" },
          { label: "🔴 高", value: "high" },
          { label: "🔥 紧急", value: "urgent" },
        ],
      })
      .formButtons({
        submit: { text: "提交", type: "primary" },
        reset: { text: "取消", type: "default" },
      })
      .endForm()
      .systemButtons()
      .build();
  },

  async onAction(ctx) {
    // form_submit 回调
    if (ctx.type === "form_submit" && ctx.formValue) {
      const formValue = ctx.formValue;
      const priorityMap: Record<string, string> = {
        low: "🟢 低",
        medium: "🟡 中",
        high: "🔴 高",
        urgent: "🔥 紧急",
      };

      const username = formValue.test_username || "(未填写)";
      const password = formValue.test_password ? "••••••" : "(未填写)";
      const address = formValue.test_address || "(未填写)";
      const priorityKey = formValue.test_priority as string | undefined;
      const priority = priorityKey
        ? priorityMap[priorityKey] || priorityKey
        : "(未选择)";

      return navigate("test-result", {
        username,
        password,
        address,
        priority,
        raw: JSON.stringify(formValue, null, 2),
      }, { mode: "push" });
    }
  },
});
