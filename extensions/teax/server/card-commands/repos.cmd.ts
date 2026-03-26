import { registerCardCommand } from "~~/server/card-kit/commands";

registerCardCommand({
  name: "repos",
  aliases: ["/repos", "/list", "仓库", "列表"],
  description: "列出已注册的仓库",
  usage: "/repos [orgName]",
  page: "repos",
  paramsFromArgs: (args) => ({ orgName: args[0] }),
});
