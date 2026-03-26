import { and, eq, inArray, isNull } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, guards, requireBinding } from "~~/server/card-kit";
import { getActiveAccountId } from "~~/server/utils/feishu-active-account";

export default defineCardPage({
  name: "preset:list",

  beforeEnter: guards(requireBinding()),

  async render(ctx) {
    const db = useDB();
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    // 获取当前活跃账户 ID
    const activeUserId = await getActiveAccountId(ctx.openId);
    if (!activeUserId) {
      return ctx
        .card({ title: "🔒 未绑定账号", theme: "orange" })
        .text("请先在 Teax 中绑定飞书账号", true)
        .build();
    }

    // 查询用户的预设组
    const groups = await db
      .select({
        id: schema.workflowPresetGroups.id,
        name: schema.workflowPresetGroups.name,
        description: schema.workflowPresetGroups.description,
        share_token: schema.workflowPresetGroups.share_token,
      })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.created_by, activeUserId))
      .limit(10);

    // 查询预设组内的预设
    const groupIds = groups.map((g) => g.id);
    let groupPresets: Array<{
      id: string;
      name: string;
      share_token: string;
      group_id: string | null;
    }> = [];
    if (groupIds.length > 0) {
      groupPresets = await db
        .select({
          id: schema.workflowPresets.id,
          name: schema.workflowPresets.name,
          share_token: schema.workflowPresets.share_token,
          group_id: schema.workflowPresets.group_id,
        })
        .from(schema.workflowPresets)
        .where(inArray(schema.workflowPresets.group_id, groupIds))
        .limit(50);
    }

    // 按 group_id 分组
    const presetsByGroup = new Map<string, typeof groupPresets>();
    for (const p of groupPresets) {
      if (!p.group_id) continue;
      const list = presetsByGroup.get(p.group_id) ?? [];
      list.push(p);
      presetsByGroup.set(p.group_id, list);
    }

    // 查询独立预设 (group_id IS NULL)
    const standalonePresets = await db
      .select({
        id: schema.workflowPresets.id,
        name: schema.workflowPresets.name,
        share_token: schema.workflowPresets.share_token,
        repository: {
          full_name: schema.repositories.full_name,
        },
      })
      .from(schema.workflowPresets)
      .innerJoin(
        schema.repositories,
        eq(schema.workflowPresets.repository_id, schema.repositories.id),
      )
      .where(
        and(
          eq(schema.workflowPresets.created_by, activeUserId),
          isNull(schema.workflowPresets.group_id),
        ),
      )
      .limit(10);

    const card = ctx.card({ title: "📦 我的工作流预设", theme: "blue" });

    // 空状态
    if (groups.length === 0 && standalonePresets.length === 0) {
      card.text("您还没有创建工作流预设\n\n工作流预设可以保存常用的工作流配置，方便快速触发", true);
      card.divider();
      card.button("💡 了解如何创建", { url: `${baseUrl}/user/settings` });
      return card.build();
    }

    // 预设组列表
    if (groups.length > 0) {
      card.text("**📁 预设组**", true);
      card.divider();

      for (const g of groups) {
        const presets = presetsByGroup.get(g.id) ?? [];
        const presetCount = presets.length;

        card.text(`**${g.name}**${g.description ? ` — ${g.description}` : ""} (${presetCount}个预设)`, true);

        // 每排两个按钮：进入、跳转
        if (presets.length > 0) {
          const buttons = presets.slice(0, 4).map((p) => [
            {
              text: `▶️ ${p.name}`,
              type: "primary" as const,
              navigate: ["preset:console", { shareToken: p.share_token }, { newMessage: true }] as [string, Record<string, unknown>, { newMessage: boolean }],
            },
            {
              text: "🔗",
              type: "default" as const,
              url: `${baseUrl}/workflows/${p.share_token}`,
            },
          ]).flat();

          // 每两个按钮一排（一个进入 + 一个跳转）
          for (let i = 0; i < buttons.length; i += 2) {
            const chunk = buttons.slice(i, i + 2);
            card.buttons(chunk);
          }
        }

        // 组分享链接
        if (g.share_token) {
          card.button("📎 分享预设组", { url: `${baseUrl}/workflow-groups/${g.share_token}` });
        }

        card.divider();
      }
    }

    // 独立预设列表
    if (standalonePresets.length > 0) {
      if (groups.length > 0) {
        card.text("**📋 独立预设**", true);
        card.divider();
      }

      for (const p of standalonePresets) {
        const repoName = p.repository?.full_name ?? "";
        card.text(`**${p.name}**${repoName ? ` (${repoName})` : ""}`, true);

        // 每排两个按钮：进入、跳转
        card.buttons([
          {
            text: "▶️ 触发",
            type: "primary",
            navigate: ["preset:console", { shareToken: p.share_token }, { newMessage: true }] as [string, Record<string, unknown>, { newMessage: boolean }],
          },
          {
            text: "🔗",
            type: "default",
            url: `${baseUrl}/workflows/${p.share_token}`,
          },
        ]);

        card.divider();
      }
    }

    // 底部链接
    card.button("⚙️ 管理预设", { url: `${baseUrl}/user/settings` });

    return card.build();
  },
});
