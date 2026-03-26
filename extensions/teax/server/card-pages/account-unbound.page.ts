import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "account-unbound",

  async render(ctx) {
    const username = ctx.params.username as string | undefined;

    return ctx
      .card({ title: "✅ 解除绑定成功", theme: "green" })
      .text(
        username
          ? `已成功解除与 **${username}** 的绑定`
          : "已成功解除飞书账号绑定\n\n您可以重新绑定其他账号",
        true,
      )
      .systemButtons([
        { text: "📖 查看绑定教程", type: "primary", navigate: ["account-guide"] },
      ])
      .build();
  },
});
