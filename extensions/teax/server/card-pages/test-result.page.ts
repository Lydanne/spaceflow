import { defineCardPage, navigate } from "~~/server/card-kit";

export default defineCardPage({
  name: "test:result",

  async render(ctx) {
    const username = ctx.params.username as string || "(未填写)";
    const password = ctx.params.password as string || "(未填写)";
    const address = ctx.params.address as string || "(未填写)";
    const priority = ctx.params.priority as string || "(未选择)";
    const raw = ctx.params.raw as string || "{}";

    return ctx
      .card({ title: "✅ 表单提交成功", theme: "green" })
      .text("**表单数据如下：**", true)
      .divider()
      .fields([
        { label: "用户名", value: username },
        { label: "密码", value: password },
        { label: "优先级", value: priority },
      ])
      .divider()
      .text(`**收货地址：**\n${address}`, true)
      .divider()
      .text(`*原始 form_value：*\n\`\`\`${raw}\`\`\``, true)
      .divider()
      .button("🔄 重新填写", { navigate: ["test:form"] })
      .build();
  },

  async onAction(ctx) {
    if (ctx.action === "back_to_form") {
      return navigate("test:form");
    }
  },
});
