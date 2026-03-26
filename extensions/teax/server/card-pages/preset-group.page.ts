import { eq } from "drizzle-orm";
import { defineCardPage, guards, requireBinding, type EnhancedButtonConfig } from "~~/server/card-kit";
import { useDB, schema } from "~~/server/db";
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
      emoji: "🟡",
      label: `${lockerUsername ?? "其他成员"} 正在使用`,
      rank: 2,
    };
  }
  return { emoji: "⚪", label: "空闲", rank: 1 };
}

export default defineCardPage({
  name: "preset-group",

  beforeEnter: guards(requireBinding()),

  async render(ctx) {
    const db = useDB();
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    const activeUserId = await getActiveAccountId(ctx.openId);
    if (!activeUserId) {
      return ctx
        .card({ title: "🔒 未绑定账号", theme: "orange" })
        .text("请先在 Teax 中绑定飞书账号", true)
        .build();
    }

    const groupToken = ctx.params.groupToken as string | undefined;
    if (!groupToken) {
      return ctx
        .card({ title: "❌ 参数缺失", theme: "red" })
        .text("缺少预设组标识", true)
        .button("返回预设组列表", {
          navigate: ["preset-list", {}, { newMessage: false, mode: "push" }],
        })
        .build();
    }

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
      return ctx
        .card({ title: "❌ 预设组不存在", theme: "red" })
        .text("该预设组不存在或已被删除", true)
        .button("返回预设组列表", {
          navigate: ["preset-list", {}, { newMessage: false, mode: "push" }],
        })
        .build();
    }

    const presets = await db
      .select({
        id: schema.workflowPresets.id,
        name: schema.workflowPresets.name,
        share_token: schema.workflowPresets.share_token,
        branch: schema.workflowPresets.branch,
        locked_by: schema.workflowPresets.locked_by,
        locker_username: schema.users.gitea_username,
      })
      .from(schema.workflowPresets)
      .leftJoin(schema.users, eq(schema.workflowPresets.locked_by, schema.users.id))
      .where(eq(schema.workflowPresets.group_id, group.id))
      .limit(30);

    const sortedPresets = [...presets].sort((a, b) => {
      const aStatus = getPresetStatus(activeUserId, a.locked_by, a.locker_username);
      const bStatus = getPresetStatus(activeUserId, b.locked_by, b.locker_username);
      if (aStatus.rank !== bStatus.rank) {
        return aStatus.rank - bStatus.rank;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });

    const summary = sortedPresets.reduce((acc, preset) => {
      const status = getPresetStatus(activeUserId, preset.locked_by, preset.locker_username);
      if (status.rank === 0) acc.mine += 1;
      else if (status.rank === 1) acc.idle += 1;
      else acc.busy += 1;
      return acc;
    }, { mine: 0, idle: 0, busy: 0 });

    const card = ctx.card({ title: `📦 ${group.name}`, theme: "blue" });

    if (group.description) {
      card.text(group.description, true);
    }

    if (sortedPresets.length === 0) {
      card.text("该预设组内暂无预设", true);
    } else {
      card.divider();
      card.text(
        `共 ${sortedPresets.length} 个子预设 · 🟡 ${summary.busy} · 🟢 ${summary.mine} · ⚪ ${summary.idle}`,
        true,
      );
      card.divider();

      const buttons: EnhancedButtonConfig[] = sortedPresets.map((preset) => {
        const status = getPresetStatus(activeUserId, preset.locked_by, preset.locker_username);
        return {
          text: `${status.emoji} ${preset.name} · ${preset.branch}`,
          type: status.rank === 2 ? "default" : "primary",
          navigate: ["preset-console", { shareToken: preset.share_token }, { newMessage: false, mode: "push" }],
        };
      });

      for (let i = 0; i < buttons.length; i += 2) {
        card.buttons(buttons.slice(i, i + 2));
      }
    }

    card.systemButtons([
      { text: "在浏览器中打开", url: `${baseUrl}/workflow-groups/${groupToken}` },
    ]);

    return card.build();
  },
});
