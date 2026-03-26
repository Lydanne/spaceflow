import { registerCardCommand } from "~~/server/card-kit";

registerCardCommand({
  name: "account",
  aliases: ["/account", "账户", "我的账户"],
  description: "查看账户信息和飞书绑定状态",
  usage: "/account",
  page: "account-home",
});
