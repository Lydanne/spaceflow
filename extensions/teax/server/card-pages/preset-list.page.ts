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
    return { emoji: "🟢", label: "我在使用", rank: 0 };
  }
  if (lockedBy) {
    return {
      emoji: "�",
      label: `${lockerUsername ?? "其他成员"} 正在使用`,
      rank: 2,
    };
  }
  return { emoji: "⚪", label: "空闲", rank: 1 };
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

    // 查询组织公开预设组
    let publicGroups: Array<{
      id: string;
      name: string;
      share_token: string;
      default_branch: string;
      repository: { full_name: string };
    }> = [];
    if (userOrgIds.length > 0) {
      publicGroups = await db
        .select({
          id: schema.workflowPresetGroups.id,
          name: schema.workflowPresetGroups.name,
          share_token: schema.workflowPresetGroups.share_token,
          default_branch: schema.workflowPresetGroups.default_branch,
          repository: { full_name: schema.repositories.full_name },
        })
        .from(schema.workflowPresetGroups)
        .innerJoin(
          schema.repositories,
          eq(schema.workflowPresetGroups.repository_id, schema.repositories.id),
        )
        .where(
          and(
            eq(schema.workflowPresetGroups.is_public, true),
            inArray(schema.workflowPresetGroups.organization_id, userOrgIds),
          ),
        )
        .limit(10);
    }

    const publicGroupIds = publicGroups.map((g) => g.id);
    let publicGroupPresets: Array<{
      group_id: string | null;
      locked_by: string | null;
      locker_username: string | null;
    }> = [];
    if (publicGroupIds.length > 0) {
      publicGroupPresets = await db
        .select({
          group_id: schema.workflowPresets.group_id,
          locked_by: schema.workflowPresets.locked_by,
          locker_username: schema.users.gitea_username,
        })
        .from(schema.workflowPresets)
        .leftJoin(schema.users, eq(schema.workflowPresets.locked_by, schema.users.id))
        .where(inArray(schema.workflowPresets.group_id, publicGroupIds))
        .limit(200);
    }

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

    if (groups.length === 0 && standalonePresets.length === 0 && publicGroups.length === 0 && publicPresets.length === 0) {
      card.text("暂无预设\n\n预设可保存常用工作流配置，一键触发", true);
      card.systemButtons([
        { text: "创建预设", url: `${baseUrl}/user/settings` },
      ]);
      return card.build();
    }

    const publicGroupSummary = new Map<string, { mine: number; idle: number; busy: number }>();
    for (const item of publicGroupPresets) {
      if (!item.group_id) continue;
      const summary = publicGroupSummary.get(item.group_id) ?? { mine: 0, idle: 0, busy: 0 };
      const status = getPresetStatus(activeUserId, item.locked_by, item.locker_username);
      if (status.rank === 0) summary.mine += 1;
      else if (status.rank === 1) summary.idle += 1;
      else summary.busy += 1;
      publicGroupSummary.set(item.group_id, summary);
    }

    card.text("**组织公开项（📁 预设组 / 📌 预设）**", true);

    const publicItems = [
      ...publicGroups.map((group) => ({
        kind: "group" as const,
        name: group.name,
        share_token: group.share_token,
        branch: group.default_branch,
        repo_name: group.repository?.full_name ?? "",
        summary: publicGroupSummary.get(group.id) ?? { mine: 0, idle: 0, busy: 0 },
      })),
      ...publicPresets.map((preset) => ({
        kind: "preset" as const,
        name: preset.name,
        share_token: preset.share_token,
        branch: preset.branch,
        repo_name: preset.repository?.full_name ?? "",
      })),
    ];

    if (publicItems.length === 0) {
      card.text("暂无组织公开项", true);
    } else {
      const publicButtons: EnhancedButtonConfig[] = publicItems.map((item) => {
        const emoji = item.kind === "group" ? "📁" : "📌";
        const navigate: EnhancedButtonConfig["navigate"] = item.kind === "group"
          ? ["preset-group", { groupToken: item.share_token }, { newMessage: false }]
          : ["preset-console", { shareToken: item.share_token }, { newMessage: false }];
        const repoMeta = item.kind === "group"
          ? `🟡${item.summary.busy}/🟢${item.summary.mine}/⚪${item.summary.idle}`
          : `${item.repo_name} ${item.branch}`;
        return {
          text: `${emoji} ${item.name} (${repoMeta})`,
          type: "primary",
          navigate,
        };
      });
      for (let i = 0; i < publicButtons.length; i += 2) {
        card.buttons(publicButtons.slice(i, i + 2));
      }
    }

    card.divider();

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
          text: `📁 ${group.name} (🟡${summary.busy}/🟢${summary.mine}/⚪${summary.idle})`,
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
          type: "default",
          navigate: ["preset-console", { shareToken: preset.share_token }, { newMessage: false }],
        };
      });
      for (let i = 0; i < standaloneButtons.length; i += 2) {
        card.buttons(standaloneButtons.slice(i, i + 2));
      }
    }

    card.systemButtons([
      { text: "管理预设", url: `${baseUrl}/user/settings` },
    ]);

    return card.build();
  },
});
