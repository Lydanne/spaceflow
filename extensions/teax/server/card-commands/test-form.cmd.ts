import { defineCardCommand } from "~~/server/card-kit";

export default defineCardCommand({
  name: "test-form",
  aliases: ["/test-form", "测试表单"],
  description: "测试飞书卡片 JSON 2.0 表单组件",
  usage: "/test-form",
  page: "test-form",
});
