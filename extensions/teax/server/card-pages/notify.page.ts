import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";
import { getActiveAccount } from "~~/server/services/account.service";

export default defineCardPage({
  name: "notify",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const activeUser = await getActiveAccount(ctx.openId);

    if (!activeUser) {
      return ctx
        .card({ title: "❌ 未绑定", theme: "red" })
        .text("请先在 Teax 中绑定飞书账号", true)
        .build();
    }

    const [binding] = await db
      .select({
        notify_publish: schema.userFeishu.notify_publish,
        notify_approval: schema.userFeishu.notify_approval,
        notify_agent: schema.userFeishu.notify_agent,
        notify_system: schema.userFeishu.notify_system,
      })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.user_id, activeUser.id))
      .limit(1);

    if (!binding) {
      return ctx
        .card({ title: "❌ 未找到设置", theme: "red" })
        .text("未找到通知设置", true)
        .build();
    }

    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    const settings = [
      `${binding.notify_publish ? "✅" : "❌"} 发布通知`,
      `${binding.notify_approval ? "✅" : "❌"} 审批通知`,
      `${binding.notify_agent ? "✅" : "❌"} Agent 通知`,
      `${binding.notify_system ? "✅" : "❌"} 系统通知`,
    ];

    return ctx
      .card({ title: "🔔 通知设置", theme: "blue" })
      .text("**当前通知偏好**\n\n" + settings.join("\n"), true)
      .divider()
      .systemButtons([
        { text: "前往设置页面", url: `${baseUrl}/user/settings` },
      ])
      .build();
  },
});
