import { eq, inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, navigate } from "~~/server/card-kit";
import {
  getActiveAccountId,
  setActiveAccountId,
} from "~~/server/utils/feishu-active-account";

export default defineCardPage({
  name: "account-home",

  async render(ctx) {
    const db = useDB();
    const openId = ctx.openId;

    // 查询所有飞书绑定信息
    const bindings = await db
      .select({
        id: schema.userFeishu.id,
        user_id: schema.userFeishu.user_id,
        feishu_name: schema.userFeishu.feishu_name,
        created_at: schema.userFeishu.created_at,
      })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, openId));

    if (bindings.length === 0) {
      return ctx
        .card({ title: "👤 账户信息", theme: "orange" })
        .text(
          "**您还未绑定 Teax 账号**\n\n绑定后可以使用完整功能",
          true,
        )
        .divider()
        .text(
          "**如何绑定?**\n\n1. 访问 Teax 网站\n2. 使用 Gitea 账号登录\n3. 在个人设置中绑定飞书账号",
          true,
        )
        .divider()
        .button("📖 查看绑定教程", {
          type: "primary",
          navigate: ["account-guide"],
        })
        .build();
    }

    // 查询所有绑定用户的详细信息
    const userIds = bindings.map((b) => b.user_id!);
    const users = await db
      .select({
        id: schema.users.id,
        gitea_username: schema.users.gitea_username,
        email: schema.users.email,
        is_admin: schema.users.is_admin,
        created_at: schema.users.created_at,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));

    if (users.length === 0) {
      return ctx
        .card({ title: "❌ 错误", theme: "red" })
        .text("账户信息异常,请联系管理员", true)
        .build();
    }

    const userMap = new Map(users.map((u) => [u.id, u]));
    const feishuName = bindings[0]?.feishu_name || "未知";

    // 获取当前活跃账户
    const activeId = await getActiveAccountId(openId);
    const currentActiveId
      = activeId && userIds.includes(activeId) ? activeId : userIds[0];

    // 显示成功提示（来自 switch_account action）
    const switchedTo = ctx.params.switchedTo as string | undefined;

    const card = ctx.card({ title: "👤 账户信息", theme: "blue" });

    if (switchedTo) {
      card.text(`✅ 已切换到账户 **${switchedTo}**`, true);
      card.divider();
    }

    card.text(
      `**飞书账号**: ${feishuName}\n**绑定账户数**: ${bindings.length} 个`,
      true,
    );
    card.divider();

    // 为每个绑定的账户生成信息块
    for (const binding of bindings) {
      const user = userMap.get(binding.user_id!);
      if (!user) continue;

      const isActive = user.id === currentActiveId;
      const activeLabel = isActive ? " ✅ 当前" : "";

      card.text(
        [
          `**用户名**: ${user.gitea_username}${activeLabel}`,
          `**邮箱**: ${user.email}`,
          `**角色**: ${user.is_admin ? "管理员" : "普通用户"}`,
          `**绑定时间**: ${binding.created_at ? new Date(binding.created_at).toLocaleDateString("zh-CN") : "未知"}`,
        ].join("\n"),
        true,
      );

      // 操作按钮（横排）
      const accountBtns: Parameters<typeof card.buttons>[0] = [];
      if (!isActive && bindings.length > 1) {
        accountBtns.push({
          text: "⭐ 设为当前",
          type: "primary",
          action: "switch_account",
          params: { user_id: user.id, username: user.gitea_username },
        });
      }
      accountBtns.push({
        text: "🔓 解绑",
        type: "danger",
        action: "unbind_feishu",
        params: { binding_id: binding.id, username: user.gitea_username },
      });
      card.buttons(accountBtns);

      card.divider();
    }

    card.buttons([
      { text: "🔄 刷新", action: "refresh" },
      {
        text: "➕ 绑定更多账户",
        type: "primary",
        navigate: ["account-guide"],
      },
    ]);

    return card.build();
  },

  async onAction(ctx) {
    const db = useDB();

    switch (ctx.action) {
      case "refresh": {
        return navigate("account-home");
      }

      case "switch_account": {
        const userId = ctx.params.user_id as string;
        const username = ctx.params.username as string;
        if (userId) {
          await setActiveAccountId(ctx.openId, userId);
        }
        return navigate("account-home", { switchedTo: username });
      }

      case "unbind_feishu": {
        const bindingId = ctx.params.binding_id as string | undefined;

        if (bindingId) {
          await db
            .delete(schema.userFeishu)
            .where(eq(schema.userFeishu.id, bindingId));
        } else {
          await db
            .delete(schema.userFeishu)
            .where(eq(schema.userFeishu.feishu_open_id, ctx.openId));
        }

        // 检查是否还有其他绑定
        const remaining = await db
          .select({ id: schema.userFeishu.id })
          .from(schema.userFeishu)
          .where(eq(schema.userFeishu.feishu_open_id, ctx.openId))
          .limit(1);

        if (remaining.length > 0) {
          return navigate("account-home");
        }

        // 所有绑定都已解除 — 显示解绑成功页
        return navigate("account-unbound", {
          username: ctx.params.username,
        });
      }
    }
  },
});
