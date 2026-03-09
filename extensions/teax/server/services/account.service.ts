/**
 * 用户账户管理服务
 * 处理账户信息查看和飞书绑定
 */

import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { FeishuInteractiveCard } from "~~/server/utils/feishu-sdk";

/**
 * 生成账户信息卡片
 */
export async function generateAccountCard(openId: string): Promise<FeishuInteractiveCard> {
  const db = useDB();

  // 查询飞书绑定信息
  const [binding] = await db
    .select({
      user_id: schema.userFeishu.user_id,
      feishu_name: schema.userFeishu.feishu_name,
      created_at: schema.userFeishu.created_at,
    })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId))
    .limit(1);

  if (!binding) {
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

  // 查询用户详细信息
  const [user] = await db
    .select({
      id: schema.users.id,
      gitea_username: schema.users.gitea_username,
      email: schema.users.email,
      is_admin: schema.users.is_admin,
      created_at: schema.users.created_at,
    })
    .from(schema.users)
    .where(eq(schema.users.id, binding.user_id!))
    .limit(1);

  if (!user) {
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

  // 查询用户所属组织数量
  const orgCount = await db
    .selectDistinct({ org_id: schema.organizations.id })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .innerJoin(schema.organizations, eq(schema.teams.organization_id, schema.organizations.id))
    .where(eq(schema.teamMembers.user_id, user.id));

  // 构建账户信息
  const accountInfo = [
    `**用户名**: ${user.gitea_username}`,
    `**邮箱**: ${user.email}`,
    `**角色**: ${user.is_admin ? "管理员" : "普通用户"}`,
    `**所属组织**: ${orgCount.length} 个`,
    `**注册时间**: ${user.created_at ? new Date(user.created_at).toLocaleDateString("zh-CN") : "未知"}`,
  ].join("\n");

  const feishuInfo = [
    `**飞书名称**: ${binding.feishu_name}`,
    `**绑定时间**: ${binding.created_at ? new Date(binding.created_at).toLocaleDateString("zh-CN") : "未知"}`,
  ].join("\n");

  return {
    header: {
      title: { tag: "plain_text", content: "👤 账户信息" },
      template: "blue",
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: "**Teax 账户**\n\n" + accountInfo,
        },
      },
      {
        tag: "hr",
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: "**飞书绑定**\n\n" + feishuInfo,
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
            text: { tag: "plain_text", content: "🔓 解除绑定" },
            type: "danger",
            value: JSON.stringify({
              action: "unbind_feishu",
            }),
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: "🔄 刷新" },
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

/**
 * 处理账户相关的卡片交互
 */
export async function handleAccountAction(
  openId: string,
  action: Record<string, unknown>,
): Promise<FeishuInteractiveCard | null> {
  const actionType = action.action as string;

  switch (actionType) {
    case "refresh_account": {
      return await generateAccountCard(openId);
    }

    case "unbind_feishu": {
      const db = useDB();

      // 删除绑定
      await db
        .delete(schema.userFeishu)
        .where(eq(schema.userFeishu.feishu_open_id, openId));

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
              content: "已成功解除飞书账号绑定\n\n您可以重新绑定其他账号",
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
      const baseUrl = config.public.siteUrl || "https://teax.example.com";

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
