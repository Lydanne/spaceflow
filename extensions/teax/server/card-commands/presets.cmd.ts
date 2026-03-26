import { registerCardCommand } from "~~/server/card-kit/commands";

registerCardCommand({
  name: "presets",
  aliases: ["/presets", "预设", "工作流预设"],
  description: "查看我的工作流预设",
  usage: "/presets",
  page: "preset-list",
});
