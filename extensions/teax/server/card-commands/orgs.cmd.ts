import { registerCardCommand } from "~~/server/card-kit";

registerCardCommand({
  name: "orgs",
  aliases: ["/orgs", "组织", "我的组织"],
  description: "查看我所属的组织",
  usage: "/orgs",
  page: "orgs",
});
