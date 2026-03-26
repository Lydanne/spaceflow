import { registerCardCommand } from "~~/server/card-kit";

registerCardCommand({
  name: "preset-link",
  description: "通过预设链接打开预设控制台",
  linkPattern: /\/workflows\/([a-zA-Z0-9_-]+)/,
  page: "preset-console",
  paramsFromMatch: (match) => ({ shareToken: match[1] }),
});
