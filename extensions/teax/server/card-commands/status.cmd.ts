import { registerCardCommand } from "~~/server/card-kit";

registerCardCommand({
  name: "status",
  aliases: ["/status", "状态"],
  description: "查询仓库最近构建状态",
  usage: "/status <owner/repo>",
  page: "status",
  paramsFromArgs: (args) => {
    const repoFullName = args[0];
    if (!repoFullName?.includes("/")) return undefined;
    return { repoFullName };
  },
});
