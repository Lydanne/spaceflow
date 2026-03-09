/**
 * 飞书机器人控制面板服务
 * 提供交互式的组织/仓库/功能选择界面
 */

import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { FeishuInteractiveCard } from "~~/server/utils/feishu-sdk";

/**
 * 生成控制面板首页 - 显示用户的组织列表
 */
export async function generateControlPanelHome(openId: string): Promise<FeishuInteractiveCard> {
  const db = useDB();

  // 获取用户绑定
  const [binding] = await db
    .select({ user_id: schema.userFeishu.user_id })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId))
    .limit(1);

  if (!binding?.user_id) {
    return {
      header: {
        title: { tag: "plain_text", content: "🔒 未绑定账号" },
        template: "orange",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "请先绑定 Gitea 账号才能使用控制面板\n\n访问 Teax 网站进行绑定",
          },
        },
      ],
    };
  }

  // 获取用户的组织列表
  const userOrgs = await db
    .selectDistinct({
      org_id: schema.organizations.id,
      org_name: schema.organizations.name,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .innerJoin(schema.organizations, eq(schema.teams.organization_id, schema.organizations.id))
    .where(eq(schema.teamMembers.user_id, binding.user_id))
    .limit(20);

  if (userOrgs.length === 0) {
    return {
      header: {
        title: { tag: "plain_text", content: "📋 控制面板" },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "您还没有加入任何组织\n\n请联系管理员将您添加到组织中",
          },
        },
      ],
    };
  }

  // 构建组织选择卡片
  const elements: Array<{ tag: string; [key: string]: unknown }> = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: "**请选择组织**",
      },
    },
    {
      tag: "hr",
    },
  ];

  // 添加组织按钮
  for (const org of userOrgs) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: `📁 ${org.org_name}` },
          type: "default",
          value: JSON.stringify({
            action: "select_org",
            org_name: org.org_name,
          }),
        },
      ],
    });
  }

  return {
    header: {
      title: { tag: "plain_text", content: "🎛️ 控制面板" },
      template: "blue",
    },
    elements,
  };
}

/**
 * 生成组织的仓库列表
 */
export async function generateOrgRepoList(orgName: string): Promise<FeishuInteractiveCard> {
  const db = useDB();

  // 获取组织信息
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.name, orgName))
    .limit(1);

  if (!org) {
    return {
      header: {
        title: { tag: "plain_text", content: "❌ 组织不存在" },
        template: "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `组织 **${orgName}** 不存在`,
          },
        },
      ],
    };
  }

  // 获取组织的仓库列表
  const repos = await db
    .select({
      id: schema.repositories.id,
      name: schema.repositories.name,
      full_name: schema.repositories.full_name,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.organization_id, org.id))
    .limit(20);

  if (repos.length === 0) {
    return {
      header: {
        title: { tag: "plain_text", content: `📁 ${orgName}` },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "该组织还没有仓库",
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
                action: "back_to_home",
              }),
            },
          ],
        },
      ],
    };
  }

  // 构建仓库选择卡片
  const elements: Array<{ tag: string; [key: string]: unknown }> = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**${orgName}** 的仓库列表`,
      },
    },
    {
      tag: "hr",
    },
  ];

  // 添加仓库按钮
  for (const repo of repos) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: `📦 ${repo.name}` },
          type: "default",
          value: JSON.stringify({
            action: "select_repo",
            owner: orgName,
            repo: repo.name,
          }),
        },
      ],
    });
  }

  // 添加返回按钮
  elements.push(
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
            action: "back_to_home",
          }),
        },
      ],
    },
  );

  return {
    header: {
      title: { tag: "plain_text", content: `📁 ${orgName}` },
      template: "blue",
    },
    elements,
  };
}

/**
 * 生成仓库的功能菜单
 */
export async function generateRepoFunctionMenu(
  owner: string,
  repo: string,
): Promise<FeishuInteractiveCard> {
  const config = useRuntimeConfig();
  const baseUrl = config.public.siteUrl || "https://teax.example.com";

  return {
    header: {
      title: { tag: "plain_text", content: `📦 ${owner}/${repo}` },
      template: "blue",
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: "**请选择功能**",
        },
      },
      {
        tag: "hr",
      },
      // Actions 功能
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "🚀 Actions" },
            type: "primary",
            value: JSON.stringify({
              action: "open_actions",
              owner,
              repo,
            }),
          },
        ],
      },
      // Agents 功能
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "🤖 Agents" },
            type: "default",
            value: JSON.stringify({
              action: "open_agents",
              owner,
              repo,
            }),
          },
        ],
      },
      // Pages 功能
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "📄 Pages" },
            type: "default",
            value: JSON.stringify({
              action: "open_pages",
              owner,
              repo,
            }),
          },
        ],
      },
      // 设置
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "⚙️ 设置" },
            type: "default",
            value: JSON.stringify({
              action: "open_settings",
              owner,
              repo,
            }),
          },
        ],
      },
      {
        tag: "hr",
      },
      // 快捷链接
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**快捷链接**\n[在网页中打开](${baseUrl}/${owner}/${repo})`,
        },
      },
      {
        tag: "hr",
      },
      // 返回按钮
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "⬅️ 返回仓库列表" },
            type: "default",
            value: JSON.stringify({
              action: "back_to_org",
              org_name: owner,
            }),
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: "🏠 返回首页" },
            type: "default",
            value: JSON.stringify({
              action: "back_to_home",
            }),
          },
        ],
      },
    ],
  };
}

/**
 * 处理控制面板的卡片交互
 */
export async function handleControlPanelAction(
  openId: string,
  action: Record<string, unknown>,
): Promise<FeishuInteractiveCard | null> {
  const actionType = action.action as string;

  switch (actionType) {
    case "select_org": {
      const orgName = action.org_name as string;
      return await generateOrgRepoList(orgName);
    }

    case "select_repo": {
      const owner = action.owner as string;
      const repo = action.repo as string;
      return await generateRepoFunctionMenu(owner, repo);
    }

    case "back_to_home": {
      return await generateControlPanelHome(openId);
    }

    case "back_to_org": {
      const orgName = action.org_name as string;
      return await generateOrgRepoList(orgName);
    }

    case "open_actions":
    case "open_agents":
    case "open_pages":
    case "open_settings": {
      const owner = action.owner as string;
      const repo = action.repo as string;
      const config = useRuntimeConfig();
      const baseUrl = config.public.siteUrl || "https://teax.example.com";

      const pathMap: Record<string, string> = {
        open_actions: "actions",
        open_agents: "agents",
        open_pages: "pages",
        open_settings: "settings",
      };

      const path = pathMap[actionType];
      if (!path) {
        return null;
      }
      const url = `${baseUrl}/${owner}/${repo}/${path}`;

      return {
        header: {
          title: { tag: "plain_text", content: `📦 ${owner}/${repo}` },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `**${path.charAt(0).toUpperCase() + path.slice(1)}**\n\n[在浏览器中打开](${url})`,
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
                  action: "select_repo",
                  owner,
                  repo,
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
