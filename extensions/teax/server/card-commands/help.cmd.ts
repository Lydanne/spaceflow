import { registerCardCommand } from "~~/server/card-kit";

registerCardCommand({
  name: "help",
  aliases: ["/help", "帮助"],
  description: "查看所有可用指令",
  usage: "/help",
  page: "help",
});
