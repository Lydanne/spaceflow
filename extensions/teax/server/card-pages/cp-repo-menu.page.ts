import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp-repo-menu",

  async render(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    return ctx
      .card({ title: `📦 ${owner}/${repo}`, theme: "blue" })
      .text("**请选择功能**", true)
      .divider()
      .button("🎯 Presets", {
        type: "primary",
        navigate: ["preset-list", { owner, repo }, { mode: "push" }],
      })
      .button("🚀 Actions", {
        type: "primary",
        navigate: ["cp-actions", { owner, repo }, { mode: "push" }],
      })
      .button("🤖 Agents", {
        navigate: ["cp-feature", { owner, repo, feature: "agents" }, { mode: "push" }],
      })
      .button("📄 Pages", {
        navigate: ["cp-feature", { owner, repo, feature: "pages" }, { mode: "push" }],
      })
      .button("⚙️ 设置", {
        navigate: ["cp-feature", { owner, repo, feature: "settings" }, { mode: "push" }],
      })
      .divider()
      .text(`**快捷链接**\n[在网页中打开](${baseUrl}/${owner}/${repo})`, true)
      .divider()
      .backButton("⬅️ 返回")
      .build();
  },
});
