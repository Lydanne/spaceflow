import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, guards, requireBinding, type EnhancedButtonConfig, type CardRenderContext } from "~~/server/card-kit";
import { getActiveAccountId } from "~~/server/utils/feishu-active-account";

// ─── 单预设组渲染 ──────────────────────────

async function renderSingleGroup(
  ctx: CardRenderContext,
  db: ReturnType<typeof useDB>,
  baseUrl: string,
  groupToken: string,
  activeUserId: string,
) {
  // 通过 share_token 查询预设组
  const [group] = await db
    .select({
      id: schema.workflowPresetGroups.id,
      name: schema.workflowPresetGroups.name,
      description: schema.workflowPresetGroups.description,
      share_token: schema.workflowPresetGroups.share_token,
    })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, groupToken))
    .limit(1);

  if (!group) {
    const card = ctx.card({ title: "❌ 预设组不存在", theme: "red" });
    card.text("该预设组不存在或已被删除", true);
    card.buttons([{ text: "⬅️ 返回", back: true }]);
    return card.build();
  }

  // 查询组内预设（含锁定状态 + 锁定者用户名）
  const presets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      share_token: schema.workflowPresets.share_token,
      branch: schema.workflowPresets.branch,
      workflow_path: schema.workflowPresets.workflow_path,
      locked_by: schema.workflowPresets.locked_by,
      locked_at: schema.workflowPresets.locked_at,
      locker_username: schema.users.gitea_username,
    })
    .from(schema.workflowPresets)
    .leftJoin(schema.users, eq(schema.workflowPresets.locked_by, schema.users.id))
    .where(eq(schema.workflowPresets.group_id, group.id))
    .limit(20);

  // 分组：我正在使用 vs 其他
  const myPresets = presets.filter((p) => p.locked_by === activeUserId);
  const otherPresets = presets.filter((p) => p.locked_by !== activeUserId);

  const card = ctx.card({ title: `📦 ${group.name}`, theme: "blue" });

  if (group.description) {
    card.text(group.description, true);
    card.divider();
  }

  if (presets.length === 0) {
    card.text("该预设组内暂无预设", true);
  } else {
    // 我正在使用的预设（置顶）
    if (myPresets.length > 0) {
      card.text("**🟢 我正在使用**", true);
      for (const p of myPresets) {
        card.buttons([{
          text: `▶️ ${p.name} (${p.branch})`,
          type: "primary",
          navigate: ["preset-console", { shareToken: p.share_token }, { newMessage: true }],
        }]);
      }
      card.divider();
    }

    // 其他预设
    if (otherPresets.length > 0) {
      if (myPresets.length > 0) {
        card.text("**其他预设**", true);
      }
      for (const p of otherPresets) {
        if (p.locked_by) {
          // 被他人锁定
          card.text(`🔒 **${p.name}** (${p.branch}) — 被 ${p.locker_username ?? "未知用户"} 使用中`, true);
          card.buttons([{
            text: `${p.name}`,
            type: "default",
            navigate: ["preset-console", { shareToken: p.share_token }, { newMessage: true }],
          }]);
        } else {
          // 空闲
          card.buttons([{
            text: `🔵 ${p.name} (${p.branch})`,
            type: "primary",
            navigate: ["preset-console", { shareToken: p.share_token }, { newMessage: true }],
          }]);
        }
      }
    }
  }

  card.divider();
  card.buttons([
    { text: "⬅️ 返回", back: true },
    { text: "在浏览器中打开", url: `${baseUrl}/workflow-groups/${groupToken}` },
  ]);

  return card.build();
}

// ─── 页面定义 ──────────────────────────

export default defineCardPage({
  name: "preset-list",

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

    // ─── 单预设组模式（通过 groupToken 参数进入） ──────
    const groupToken = ctx.params.groupToken as string | undefined;
    if (groupToken) {
      return renderSingleGroup(ctx, db, baseUrl, groupToken, activeUserId);
    }

    // ─── 完整列表模式 ──────

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
      branch: string;
      workflow_path: string;
    }> = [];
    if (groupIds.length > 0) {
      groupPresets = await db
        .select({
          id: schema.workflowPresets.id,
          name: schema.workflowPresets.name,
          share_token: schema.workflowPresets.share_token,
          group_id: schema.workflowPresets.group_id,
          branch: schema.workflowPresets.branch,
          workflow_path: schema.workflowPresets.workflow_path,
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

    // 查询独立预设 (group_id IS NULL 且是用户创建的)
    const standalonePresets = await db
      .select({
        id: schema.workflowPresets.id,
        name: schema.workflowPresets.name,
        share_token: schema.workflowPresets.share_token,
        branch: schema.workflowPresets.branch,
        workflow_path: schema.workflowPresets.workflow_path,
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

    // 查询组内公开的预设（is_public = true 且 organization_id 在用户所属组织内）
    let publicPresets: Array<{
      id: string;
      name: string;
      share_token: string;
      branch: string;
      workflow_path: string;
      created_by: string | null;
      repository: { full_name: string };
      organization: { name: string; full_name: string | null };
    }> = [];
    if (userOrgIds.length > 0) {
      publicPresets = await db
        .select({
          id: schema.workflowPresets.id,
          name: schema.workflowPresets.name,
          share_token: schema.workflowPresets.share_token,
          branch: schema.workflowPresets.branch,
          workflow_path: schema.workflowPresets.workflow_path,
          created_by: schema.workflowPresets.created_by,
          repository: { full_name: schema.repositories.full_name },
          organization: {
            name: schema.organizations.name,
            full_name: schema.organizations.full_name,
          },
        })
        .from(schema.workflowPresets)
        .innerJoin(
          schema.repositories,
          eq(schema.workflowPresets.repository_id, schema.repositories.id),
        )
        .innerJoin(
          schema.organizations,
          eq(schema.workflowPresets.organization_id, schema.organizations.id),
        )
        .where(
          and(
            eq(schema.workflowPresets.is_public, true),
            inArray(schema.workflowPresets.organization_id, userOrgIds),
            isNull(schema.workflowPresets.group_id), // 只查独立预设，组内预设在组级别处理
          ),
        )
        .limit(20);
    }

    const card = ctx.card({ title: "📦 工作流预设", theme: "blue" });

    // 空状态
    if (groups.length === 0 && standalonePresets.length === 0 && publicPresets.length === 0) {
      card.text("暂无预设\n\n预设可保存常用工作流配置，一键触发", true);
      card.divider();
      card.buttons([
        { text: "⬅️ 返回", back: true },
        { text: "创建预设", url: `${baseUrl}/user/settings` },
      ]);
      return card.build();
    }

    // 组内公开预设（放在最上面）
    if (publicPresets.length > 0) {
      card.text("**🌐 组织内公开预设**", true);
      card.divider();

      const btns: EnhancedButtonConfig[] = publicPresets.map((p) => {
        const repo = p.repository?.full_name ?? "";
        return {
          text: `${p.name} (${repo})`,
          type: "primary",
          navigate: ["preset-console", { shareToken: p.share_token }, { newMessage: true }],
        };
      });
      for (let i = 0; i < btns.length; i += 2) {
        card.buttons(btns.slice(i, i + 2));
      }
      card.divider();
    }

    // 预设组：组名 + 预设按钮
    if (groups.length > 0) {
      for (const g of groups) {
        const presets = presetsByGroup.get(g.id) ?? [];
        if (presets.length === 0) continue;

        // 组名
        card.text(`**${g.name}**${g.description ? ` ${g.description}` : ""}`, true);

        // 预设按钮（每行2个）
        const btns: EnhancedButtonConfig[] = presets.slice(0, 4).map((p) => {
          const wf = p.workflow_path.replace(/^\.gitea\/workflows\/|\.ya?ml$/gi, "");
          return {
            text: `${p.name} (${p.branch})`,
            type: "primary",
            navigate: ["preset-console", { shareToken: p.share_token }, { newMessage: true }],
          };
        });
        for (let i = 0; i < btns.length; i += 2) {
          card.buttons(btns.slice(i, i + 2));
        }
        card.divider();
      }
    }

    // 独立预设：按钮显示仓库+分支
    if (standalonePresets.length > 0) {
      card.text("**独立预设**", true);

      const btns: EnhancedButtonConfig[] = standalonePresets.map((p) => {
        const repo = p.repository?.full_name ?? "";
        return {
          text: `${p.name} (${repo} ${p.branch})`,
          type: "primary",
          navigate: ["preset-console", { shareToken: p.share_token }, { newMessage: true }],
        };
      });
      for (let i = 0; i < btns.length; i += 2) {
        card.buttons(btns.slice(i, i + 2));
      }
      card.divider();
    }

    card.buttons([
      { text: "⬅️ 返回", back: true },
      { text: "管理预设", url: `${baseUrl}/user/settings` },
    ]);

    return card.build();
  },
});
