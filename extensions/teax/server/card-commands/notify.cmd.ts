import { registerCardCommand } from "~~/server/card-kit/commands";

registerCardCommand({
  name: "notify",
  aliases: ["/notify", "通知", "通知设置"],
  description: "查看通知偏好设置",
  usage: "/notify",
  page: "notify",
});
