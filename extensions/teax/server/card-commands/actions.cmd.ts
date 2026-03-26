import { defineCardCommand } from "~~/server/card-kit";

export default defineCardCommand({
  name: "actions",
  aliases: ["/actions", "工作流"],
  description: "触发仓库工作流(交互式)",
  usage: "/actions <owner/repo>",
  page: "wf-select",
  paramsFromArgs: (args) => {
    const repoFullName = args[0];
    if (!repoFullName?.includes("/")) return undefined;
    return { repoFullName };
  },
});
