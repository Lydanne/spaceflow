import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "account:guide",

  async render(ctx) {
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    return ctx
      .card({ title: "📖 绑定教程", theme: "blue" })
      .text(
        "**绑定步骤**\n\n1. 访问 Teax 网站\n2. 使用 Gitea 账号登录\n3. 进入 **个人设置**\n4. 点击 **绑定飞书账号**\n5. 授权后即可完成绑定",
        true,
      )
      .divider()
      .text(`[立即前往绑定](${baseUrl}/user/settings)`, true)
      .divider()
      .button("⬅️ 返回", { navigate: ["account:home"] })
      .build();
  },
});
