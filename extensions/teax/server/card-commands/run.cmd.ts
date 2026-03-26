import { defineCardCommand } from "~~/server/card-kit";

export default defineCardCommand({
  name: "run",
  aliases: ["/run", "运行"],
  description: "通过预设 Token 触发工作流",
  usage: "/run <preset_token>",
  page: "preset-console",
  paramsFromArgs: (args) => {
    const token = args[0];
    if (!token) return undefined;
    return { shareToken: token };
  },
});
