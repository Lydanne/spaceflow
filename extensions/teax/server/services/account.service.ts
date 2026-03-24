/**
 * 用户账户管理服务
 * 处理账户信息查看和飞书绑定
 */

import { eq, inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { FeishuInteractiveCard } from "~~/server/utils/feishu-sdk";
import { getActiveAccountId, setActiveAccountId } from "~~/server/utils/feishu-active-account";
import type { UpdateCardFn } from "~~/server/utils/feishu-card-updater";

/**
 * 获取飞书用户当前活跃的 Teax 账户
 * 如果没有设置或已失效，返回第一个绑定的账户
 */
export async function getActiveAccount(openId: string) {
  const db = useDB();

  // 查询所有绑定
  const bindings = await db
    .select({ user_id: schema.userFeishu.user_id })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId));

  if (bindings.length === 0) {
    return null;
  }

  const userIds = bindings.map((b) => b.user_id!);

  // 获取当前活跃账户
  const activeId = await getActiveAccountId(openId);

  // 验证活跃账户是否仍在绑定列表中
  const validActiveId = activeId && userIds.includes(activeId) ? activeId : userIds[0];

  // 如果活跃账户失效，更新为第一个
  if (activeId && !userIds.includes(activeId)) {
    await setActiveAccountId(openId, userIds[0]!);
  }

  // 查询用户信息
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, validActiveId!))
    .limit(1);

  return user || null;
}

/**
 * 生成账户信息卡片（支持多账户绑定）
 */
export async function generateAccountCard(openId: string): Promise<FeishuInteractiveCard> {
  const db = useDB();

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
    // 未绑定账号
    return {
      header: {
        title: { tag: "plain_text", content: "👤 账户信息" },
        template: "orange",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "**您还未绑定 Teax 账号**\n\n绑定后可以使用完整功能",
          },
        },
        {
          tag: "hr",
        },
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "**如何绑定?**\n\n1. 访问 Teax 网站\n2. 使用 Gitea 账号登录\n3. 在个人设置中绑定飞书账号",
          },
        },
        {
          tag: "hr",
        },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "📖 查看绑定教程" },
              type: "primary",
              value: JSON.stringify({
                action: "view_binding_guide",
              }),
            },
          ],
        },
      ],
    };
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
    return {
      header: {
        title: { tag: "plain_text", content: "❌ 错误" },
        template: "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "账户信息异常,请联系管理员",
          },
        },
      ],
    };
  }

  // 构建用户信息映射
  const userMap = new Map(users.map((u) => [u.id, u]));
  const feishuName = bindings[0]?.feishu_name || "未知";

  // 获取当前活跃账户
  const activeId = await getActiveAccountId(openId);
  const currentActiveId = activeId && userIds.includes(activeId) ? activeId : userIds[0];

  // 构建卡片元素
  const elements: FeishuInteractiveCard["elements"] = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**飞书账号**: ${feishuName}\n**绑定账户数**: ${bindings.length} 个`,
      },
    },
    {
      tag: "hr",
    },
  ];

  // 为每个绑定的账户生成信息块
  for (const binding of bindings) {
    const user = userMap.get(binding.user_id!);
    if (!user) continue;

    const isActive = user.id === currentActiveId;
    const activeLabel = isActive ? " ✅ 当前" : "";

    const accountInfo = [
      `**用户名**: ${user.gitea_username}${activeLabel}`,
      `**邮箱**: ${user.email}`,
      `**角色**: ${user.is_admin ? "管理员" : "普通用户"}`,
      `**绑定时间**: ${binding.created_at ? new Date(binding.created_at).toLocaleDateString("zh-CN") : "未知"}`,
    ].join("\n");

    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: accountInfo,
      },
    });

    // 操作按钮
    const buttonActions = [];

    // 如果不是当前账户，显示"设为当前"按钮
    if (!isActive && bindings.length > 1) {
      buttonActions.push({
        tag: "button",
        text: { tag: "plain_text", content: `⭐ 设为当前` },
        type: "primary",
        value: JSON.stringify({
          action: "switch_account",
          user_id: user.id,
          username: user.gitea_username,
        }),
      });
    }

    // 解绑按钮
    buttonActions.push({
      tag: "button",
      text: { tag: "plain_text", content: `🔓 解绑` },
      type: "danger",
      value: JSON.stringify({
        action: "unbind_feishu",
        binding_id: binding.id,
        username: user.gitea_username,
      }),
    });

    elements.push({
      tag: "action",
      actions: buttonActions,
    });

    elements.push({ tag: "hr" });
  }

  // 刷新按钮
  elements.push({
    tag: "action",
    actions: [
      {
        tag: "button",
        text: { tag: "plain_text", content: "🔄 刷新" },
        type: "default",
        value: JSON.stringify({
          action: "refresh_account",
        }),
      },
      {
        tag: "button",
        text: { tag: "plain_text", content: "➕ 绑定更多账户" },
        type: "primary",
        value: JSON.stringify({
          action: "view_binding_guide",
        }),
      },
    ],
  });

  return {
    header: {
      title: { tag: "plain_text", content: "👤 账户信息" },
      template: "blue",
    },
    elements,
  };
}

/**
 * 处理账户相关的卡片交互
 */
export async function handleAccountAction(
  openId: string,
  action: Record<string, unknown>,
  _updateCard?: UpdateCardFn,
): Promise<FeishuInteractiveCard | null> {
  const actionType = action.action as string;

  switch (actionType) {
    case "refresh_account": {
      return await generateAccountCard(openId);
    }

    case "switch_account": {
      const userId = action.user_id as string;
      const username = action.username as string;

      if (!userId) {
        return null;
      }

      // 设置新的活跃账户
      await setActiveAccountId(openId, userId);

      // 返回更新后的卡片，显示切换成功提示
      const card = await generateAccountCard(openId);

      // 在卡片顶部添加成功提示
      if (card.elements) {
        card.elements.unshift({
          tag: "div",
          text: {
            tag: "lark_md",
            content: `✅ 已切换到账户 **${username}**`,
          },
        });
        card.elements.splice(1, 0, { tag: "hr" });
      }

      return card;
    }

    case "unbind_feishu": {
      const db = useDB();
      const bindingId = action.binding_id as string | undefined;
      const username = action.username as string | undefined;

      if (bindingId) {
        // 按 binding_id 解绑单个账户
        await db
          .delete(schema.userFeishu)
          .where(eq(schema.userFeishu.id, bindingId));
      } else {
        // 兼容旧逻辑：解绑所有
        await db
          .delete(schema.userFeishu)
          .where(eq(schema.userFeishu.feishu_open_id, openId));
      }

      // 检查是否还有其他绑定
      const remaining = await db
        .select({ id: schema.userFeishu.id })
        .from(schema.userFeishu)
        .where(eq(schema.userFeishu.feishu_open_id, openId))
        .limit(1);

      if (remaining.length > 0) {
        // 还有其他绑定，返回更新后的账户卡片
        return await generateAccountCard(openId);
      }

      // 所有绑定都已解除
      return {
        header: {
          title: { tag: "plain_text", content: "✅ 解除绑定成功" },
          template: "green",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: username
                ? `已成功解除与 **${username}** 的绑定`
                : "已成功解除飞书账号绑定\n\n您可以重新绑定其他账号",
            },
          },
          {
            tag: "hr",
          },
          {
            tag: "action",
            actions: [
              {
                tag: "button",
                text: { tag: "plain_text", content: "📖 查看绑定教程" },
                type: "primary",
                value: JSON.stringify({
                  action: "view_binding_guide",
                }),
              },
            ],
          },
        ],
      };
    }

    case "view_binding_guide": {
      const config = useRuntimeConfig();
      const baseUrl = config.public.appUrl;

      return {
        header: {
          title: { tag: "plain_text", content: "📖 绑定教程" },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: "**绑定步骤**\n\n1. 访问 Teax 网站\n2. 使用 Gitea 账号登录\n3. 进入 **个人设置**\n4. 点击 **绑定飞书账号**\n5. 授权后即可完成绑定",
            },
          },
          {
            tag: "hr",
          },
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `[立即前往绑定](${baseUrl}/user/settings)`,
            },
          },
          {
            tag: "hr",
          },
          {
            tag: "action",
            actions: [
              {
                tag: "button",
                text: { tag: "plain_text", content: "⬅️ 返回" },
                type: "default",
                value: JSON.stringify({
                  action: "refresh_account",
                }),
              },
            ],
          },
        ],
      };
    }

    default:
      return null;
  }
}
