import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp-feature",

  async render(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const feature = ctx.params.feature as string;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    const url = `${baseUrl}/${owner}/${repo}/${feature}`;
    const label = feature.charAt(0).toUpperCase() + feature.slice(1);

    return ctx
      .card({ title: `📦 ${owner}/${repo}`, theme: "blue" })
      .text(`**${label}**\n\n[在浏览器中打开](${url})`, true)
      .systemButtons()
      .build();
  },
});
