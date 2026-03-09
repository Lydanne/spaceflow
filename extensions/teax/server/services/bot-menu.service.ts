/**
 * 飞书机器人自定义菜单服务
 * 为不同组织/仓库动态配置机器人菜单
 */

import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

interface MenuItem {
  /** 菜单名称 */
  name: string;
  /** 菜单 key,用于识别点击事件 */
  key: string;
  /** 菜单类型: link(链接) / command(指令) / event(事件) */
  type: "link" | "command" | "event";
  /** 链接地址(type=link时) */
  url?: string;
  /** 指令内容(type=command时) */
  command?: string;
  /** 子菜单 */
  children?: MenuItem[];
}

interface BotMenuConfig {
  /** 一级菜单列表(最多3个) */
  menus: MenuItem[];
}

// ─── 飞书 API 调用 ─────────────────────────────────────────

/**
 * 更新机器人菜单
 * API: https://open.feishu.cn/document/server-docs/im-v1/message-menu/patch
 */
async function updateBotMenu(appId: string, menuConfig: BotMenuConfig): Promise<void> {
  const config = useRuntimeConfig();
  const redis = useRedis();

  // 获取 tenant_access_token
  const cacheKey = `feishu:tenant_token:${appId}`;
  let token = await redis.get(cacheKey);

  if (!token) {
    const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: config.feishuAppId,
        app_secret: config.feishuAppSecret,
      }),
    });

    const data = await response.json() as { code: number; tenant_access_token?: string };
    if (data.code !== 0) {
      throw new Error("获取 tenant_access_token 失败");
    }

    token = data.tenant_access_token!;
    await redis.setex(cacheKey, 7000, token); // 缓存近2小时
  }

  // 更新菜单
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/app_menu", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      menu_tree: menuConfig.menus.map(convertMenuItem),
    }),
  });

  const result = await response.json() as { code: number; msg?: string };
  if (result.code !== 0) {
    throw new Error(`更新机器人菜单失败: ${result.msg}`);
  }
}

/**
 * 转换菜单项为飞书格式
 */
function convertMenuItem(item: MenuItem): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: item.name,
    key: item.key,
  };

  if (item.type === "link" && item.url) {
    base.type = "link";
    base.link = { url: item.url };
  } else if (item.type === "command" && item.command) {
    base.type = "command";
    base.command = { command: item.command };
  } else if (item.type === "event") {
    base.type = "event";
  }

  if (item.children && item.children.length > 0) {
    base.children = item.children.map(convertMenuItem);
  }

  return base;
}

// ─── 菜单生成器 ─────────────────────────────────────────────

/**
 * 为用户生成个性化菜单
 */
export async function generateUserMenu(openId: string): Promise<BotMenuConfig> {
  const db = useDB();

  // 查找用户绑定
  const [binding] = await db
    .select({
      user_id: schema.userFeishu.user_id,
    })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId))
    .limit(1);

  if (!binding?.user_id) {
    // 未绑定用户,返回基础菜单
    return getDefaultMenu();
  }

  // 获取用户的组织列表(通过团队成员关系)
  const userOrgs = await db
    .selectDistinct({
      org_id: schema.organizations.id,
      org_name: schema.organizations.name,
      org_display_name: schema.organizations.display_name,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .innerJoin(schema.organizations, eq(schema.teams.organization_id, schema.organizations.id))
    .where(eq(schema.teamMembers.user_id, binding.user_id))
    .limit(10); // 最多显示10个组织

  if (userOrgs.length === 0) {
    return getDefaultMenu();
  }

  const menus: MenuItem[] = [];

  // 菜单1: 我的组织
  const orgMenuItems: MenuItem[] = userOrgs.map((org) => ({
    name: org.org_display_name || org.org_name,
    key: `org_${org.org_name}`,
    type: "command",
    command: `/list ${org.org_name}`,
  }));

  menus.push({
    name: "📁 我的组织",
    key: "my_orgs",
    type: "event",
    children: orgMenuItems.slice(0, 5), // 子菜单最多5个
  });

  // 菜单2: 快捷操作
  menus.push({
    name: "⚡ 快捷操作",
    key: "quick_actions",
    type: "event",
    children: [
      {
        name: "📊 查看状态",
        key: "status",
        type: "command",
        command: "/status",
      },
      {
        name: "📋 帮助",
        key: "help",
        type: "command",
        command: "/help",
      },
    ],
  });

  // 菜单3: 控制面板(链接到 Teax Web)
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl || "http://localhost:3000";
  menus.push({
    name: "🎛️ 控制面板",
    key: "dashboard",
    type: "link",
    url: baseUrl,
  });

  return { menus };
}

/**
 * 为组织生成菜单
 */
export async function generateOrgMenu(orgName: string): Promise<BotMenuConfig> {
  const db = useDB();

  // 获取组织信息
  const [org] = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      display_name: schema.organizations.display_name,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.name, orgName))
    .limit(1);

  if (!org) {
    return getDefaultMenu();
  }

  // 获取组织下的仓库(最多10个)
  const repos = await db
    .select({
      id: schema.repositories.id,
      full_name: schema.repositories.full_name,
      name: schema.repositories.name,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.organization_id, org.id))
    .limit(10);

  const menus: MenuItem[] = [];

  // 菜单1: 仓库列表
  if (repos.length > 0) {
    const repoMenuItems: MenuItem[] = repos.map((repo) => ({
      name: repo.name,
      key: `repo_${repo.full_name}`,
      type: "command",
      command: `/actions ${repo.full_name}`,
    }));

    menus.push({
      name: `📦 ${org.display_name || org.name}`,
      key: "org_repos",
      type: "event",
      children: repoMenuItems.slice(0, 5),
    });
  }

  // 菜单2: 组织操作
  menus.push({
    name: "⚙️ 组织操作",
    key: "org_actions",
    type: "event",
    children: [
      {
        name: "📋 仓库列表",
        key: "list_repos",
        type: "command",
        command: `/list ${orgName}`,
      },
      {
        name: "📊 查看状态",
        key: "status",
        type: "command",
        command: "/status",
      },
    ],
  });

  // 菜单3: 控制面板
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl || "http://localhost:3000";
  menus.push({
    name: "🎛️ 控制面板",
    key: "dashboard",
    type: "link",
    url: `${baseUrl}/${orgName}`,
  });

  return { menus };
}

/**
 * 默认菜单(未绑定用户)
 */
function getDefaultMenu(): BotMenuConfig {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl || "http://localhost:3000";

  return {
    menus: [
      {
        name: "📋 帮助",
        key: "help",
        type: "command",
        command: "/help",
      },
      {
        name: "🔗 绑定账号",
        key: "bind",
        type: "link",
        url: `${baseUrl}/user/settings`,
      },
      {
        name: "🎛️ 控制面板",
        key: "dashboard",
        type: "link",
        url: baseUrl,
      },
    ],
  };
}

// ─── 菜单更新触发器 ─────────────────────────────────────────

/**
 * 当用户首次与机器人交互时,更新其个性化菜单
 */
export async function updateUserBotMenu(openId: string): Promise<void> {
  try {
    const config = useRuntimeConfig();
    const menuConfig = await generateUserMenu(openId);
    await updateBotMenu(config.feishuAppId, menuConfig);
    console.log(`[bot-menu] Updated menu for user: ${openId}`);
  } catch (error) {
    console.error("[bot-menu] Failed to update user menu:", error);
    // 不抛出错误,避免影响主流程
  }
}

/**
 * 当组织信息变更时,更新组织相关菜单
 */
export async function updateOrgBotMenu(orgName: string): Promise<void> {
  try {
    const config = useRuntimeConfig();
    const menuConfig = await generateOrgMenu(orgName);
    await updateBotMenu(config.feishuAppId, menuConfig);
    console.log(`[bot-menu] Updated menu for org: ${orgName}`);
  } catch (error) {
    console.error("[bot-menu] Failed to update org menu:", error);
  }
}

/**
 * 处理菜单点击事件
 */
export async function handleMenuClick(openId: string, menuKey: string): Promise<void> {
  console.log(`[bot-menu] Menu clicked: ${menuKey} by ${openId}`);

  // 菜单点击会自动触发对应的 command 或打开 link
  // 这里可以记录统计数据或执行额外逻辑

  // TODO: 记录菜单使用统计
}
