import { registerCardCommand } from "~~/server/card-kit";

registerCardCommand({
  name: "approvals",
  aliases: ["/approvals", "审批", "待审批"],
  description: "查看待处理的审批",
  usage: "/approvals",
  page: "approvals",
});
