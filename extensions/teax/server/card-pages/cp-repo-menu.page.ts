import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp:repo-menu",

  async render(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    return ctx
      .card({ title: `📦 ${owner}/${repo}`, theme: "blue" })
      .text("**请选择功能**", true)
      .divider()
      .button("🚀 Actions", {
        type: "primary",
        navigate: ["cp:actions", { owner, repo }],
      })
      .button("🤖 Agents", {
        navigate: ["cp:feature", { owner, repo, feature: "agents" }],
      })
      .button("📄 Pages", {
        navigate: ["cp:feature", { owner, repo, feature: "pages" }],
      })
      .button("⚙️ 设置", {
        navigate: ["cp:feature", { owner, repo, feature: "settings" }],
      })
      .divider()
      .text(`**快捷链接**\n[在网页中打开](${baseUrl}/${owner}/${repo})`, true)
      .divider()
      .buttons([
        {
          text: "⬅️ 返回仓库列表",
          navigate: ["cp:repos", { orgName: owner }],
        },
        {
          text: "🏠 返回首页",
          navigate: ["cp:home"],
        },
      ])
      .build();
  },
});
