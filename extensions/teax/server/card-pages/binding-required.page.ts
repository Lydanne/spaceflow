import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "binding-required",

  async render(ctx) {
    const from = ctx.params.from as string | undefined;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    return ctx
      .card({ title: "🔗 未绑定账号", theme: "orange" })
      .text(
        `请先在 Teax 中绑定飞书账号${from ? `，再继续访问「${from}」` : ""}`,
        true,
      )
      .systemButtons([
        { text: "前往绑定", url: `${baseUrl}/user/settings`, type: "primary" },
      ])
      .build();
  },
});
