import { and, eq, inArray, isNull } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, guards, requireBinding, type EnhancedButtonConfig } from "~~/server/card-kit";
import { getActiveAccountId } from "~~/server/utils/feishu-active-account";

function getPresetStatus(
  activeUserId: string,
  lockedBy: string | null,
  lockerUsername: string | null,
): { emoji: string; label: string; rank: number } {
  if (lockedBy === activeUserId) {
    return { emoji: "🟢", label: "我正在使用", rank: 0 };
  }
  if (lockedBy) {
    return {
      emoji: "🔒",
      label: `被 ${lockerUsername ?? "其他成员"} 使用中`,
      rank: 2,
    };
  }
  return { emoji: "⚪", label: "空闲可用", rank: 1 };
}

// ─── 控制面板入口场景 ──────────────────────────

export default defineCardPage({
  name: "preset-list",

  beforeEnter: guards(requireBinding()),

  async render(ctx) {
    const db = useDB();
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;
    const owner = ctx.params.owner as string | undefined;
    const repo = ctx.params.repo as string | undefined;
    const repoFullName = owner && repo ? `${owner}/${repo}` : undefined;

    // 获取当前活跃账户 ID
    const activeUserId = await getActiveAccountId(ctx.openId);
    if (!activeUserId) {
      return ctx
        .card({ title: "🔒 未绑定账号", theme: "orange" })
        .text("请先在 Teax 中绑定飞书账号", true)
        .build();
    }

    // 获取用户所属的组织
    const userOrgs = await db
      .selectDistinct({ id: schema.organizations.id })
      .from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
      .innerJoin(
        schema.organizations,
        eq(schema.teams.organization_id, schema.organizations.id),
      )
      .where(eq(schema.teamMembers.user_id, activeUserId));

    const userOrgIds = userOrgs.map((o) => o.id);

    // 查询我的预设组
    const groups = await db
      .select({
        id: schema.workflowPresetGroups.id,
        name: schema.workflowPresetGroups.name,
        description: schema.workflowPresetGroups.description,
        share_token: schema.workflowPresetGroups.share_token,
      })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.created_by, activeUserId))
      .limit(12);

    const groupIds = groups.map((g) => g.id);
    let groupPresets: Array<{
      name: string;
      branch: string;
      group_id: string | null;
      locked_by: string | null;
      locker_username: string | null;
    }> = [];
    if (groupIds.length > 0) {
      groupPresets = await db
        .select({
          name: schema.workflowPresets.name,
          branch: schema.workflowPresets.branch,
          group_id: schema.workflowPresets.group_id,
          locked_by: schema.workflowPresets.locked_by,
          locker_username: schema.users.gitea_username,
        })
        .from(schema.workflowPresets)
        .leftJoin(schema.users, eq(schema.workflowPresets.locked_by, schema.users.id))
        .where(inArray(schema.workflowPresets.group_id, groupIds))
        .limit(160);
    }

    const presetsByGroup = new Map<string, typeof groupPresets>();
    for (const preset of groupPresets) {
      if (!preset.group_id) continue;
      const list = presetsByGroup.get(preset.group_id) ?? [];
      list.push(preset);
      presetsByGroup.set(preset.group_id, list);
    }

    // 查询独立预设
    const standalonePresets = await db
      .select({
        id: schema.workflowPresets.id,
        name: schema.workflowPresets.name,
        share_token: schema.workflowPresets.share_token,
        branch: schema.workflowPresets.branch,
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

    // 查询组织公开预设
    let publicPresets: Array<{
      id: string;
      name: string;
      share_token: string;
      branch: string;
      repository: { full_name: string };
    }> = [];
    if (userOrgIds.length > 0) {
      publicPresets = await db
        .select({
          id: schema.workflowPresets.id,
          name: schema.workflowPresets.name,
          share_token: schema.workflowPresets.share_token,
          branch: schema.workflowPresets.branch,
          repository: { full_name: schema.repositories.full_name },
        })
        .from(schema.workflowPresets)
        .innerJoin(
          schema.repositories,
          eq(schema.workflowPresets.repository_id, schema.repositories.id),
        )
        .where(
          and(
            eq(schema.workflowPresets.is_public, true),
            inArray(schema.workflowPresets.organization_id, userOrgIds),
            isNull(schema.workflowPresets.group_id),
          ),
        )
        .limit(10);
    }

    const card = ctx.card({
      title: repoFullName ? `🎯 ${repoFullName} · 预设面板` : "🎯 预设面板",
      theme: "blue",
    });

    if (repoFullName) {
      card.text("**场景：从控制面板进入**", true);
      card.buttons([{
        text: "选择当前仓库工作流",
        type: "primary",
        navigate: ["wf-select", { repoFullName }, { newMessage: false }],
      }]);
      card.divider();
    }

    if (groups.length === 0 && standalonePresets.length === 0 && publicPresets.length === 0) {
      card.text("暂无预设\n\n预设可保存常用工作流配置，一键触发", true);
      card.systemButtons([
        { text: "创建预设", url: `${baseUrl}/user/settings` },
      ]);
      return card.build();
    }

    card.text("**我的预设组**", true);
    card.divider();

    if (groups.length === 0) {
      card.text("暂无预设组", true);
    } else {
      const groupButtons: EnhancedButtonConfig[] = [];
      for (const group of groups) {
        const groupItems = (presetsByGroup.get(group.id) ?? []).sort((a, b) => {
          const aStatus = getPresetStatus(activeUserId, a.locked_by, a.locker_username);
          const bStatus = getPresetStatus(activeUserId, b.locked_by, b.locker_username);
          if (aStatus.rank !== bStatus.rank) {
            return aStatus.rank - bStatus.rank;
          }
          return a.name.localeCompare(b.name, "zh-CN");
        });

        const summary = groupItems.reduce((acc, item) => {
          const status = getPresetStatus(activeUserId, item.locked_by, item.locker_username);
          if (status.rank === 0) acc.mine += 1;
          else if (status.rank === 1) acc.idle += 1;
          else acc.busy += 1;
          return acc;
        }, { mine: 0, idle: 0, busy: 0 });

        groupButtons.push({
          text: `📁 ${group.name} (🟢${summary.mine}/⚪${summary.idle}/🔒${summary.busy})`,
          type: "default",
          navigate: ["preset-group", { groupToken: group.share_token }, { newMessage: false }],
        });
      }

      for (let i = 0; i < groupButtons.length; i += 2) {
        card.buttons(groupButtons.slice(i, i + 2));
      }
    }

    card.divider();
    card.text("**独立预设**", true);
    if (standalonePresets.length === 0) {
      card.text("暂无独立预设", true);
    } else {
      const standaloneButtons: EnhancedButtonConfig[] = standalonePresets.map((preset) => {
        const repoName = preset.repository?.full_name ?? "";
        return {
          text: `📌 ${preset.name} (${repoName} ${preset.branch})`,
          type: "primary",
          navigate: ["preset-console", { shareToken: preset.share_token }, { newMessage: false }],
        };
      });
      for (let i = 0; i < standaloneButtons.length; i += 2) {
        card.buttons(standaloneButtons.slice(i, i + 2));
      }
    }

    card.divider();
    card.text("**组织公开预设**", true);
    if (publicPresets.length === 0) {
      card.text("暂无组织公开预设", true);
    } else {
      const publicButtons: EnhancedButtonConfig[] = publicPresets.map((preset) => {
        const repoName = preset.repository?.full_name ?? "";
        return {
          text: `🌐 ${preset.name} (${repoName} ${preset.branch})`,
          type: "default",
          navigate: ["preset-console", { shareToken: preset.share_token }, { newMessage: false }],
        };
      });
      for (let i = 0; i < publicButtons.length; i += 2) {
        card.buttons(publicButtons.slice(i, i + 2));
      }
    }

    card.systemButtons([
      { text: "管理预设", url: `${baseUrl}/user/settings` },
    ]);

    return card.build();
  },
});
