import { defineCardCommand } from "~~/server/card-kit";

export default defineCardCommand({
  name: "preset-group-link",
  description: "通过预设组链接打开预设列表",
  linkPattern: /\/workflow-groups\/([a-zA-Z0-9_-]+)/,
  page: "preset-list",
  paramsFromMatch: (match) => ({ groupToken: match[1] }),
});
