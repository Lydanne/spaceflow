import { defineCardCommand } from "~~/server/card-kit";

const PRESET_GROUP_LINK_PATTERN = /\/workflow-groups\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/;

export default defineCardCommand({
  name: "preset-group-link",
  description: "通过预设组链接打开预设列表",
  linkPattern: PRESET_GROUP_LINK_PATTERN,
  page: "preset-group",
  paramsFromMatch: (match) => ({ groupToken: match[1] }),
});
