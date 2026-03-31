import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";
import type { User } from "~~/server/db/schema";
import { REPO_NOTIFY_EVENT_OPTIONS, type RepoNotifyEvent } from "~~/shared/notify-events";
import { normalizeUserSettings } from "~~/shared/user-settings";

export default defineCardPage({
  name: "notify",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const activeUser = ctx.inject<User>(requireBinding)!;

    const [userRow] = await db
      .select({
        settings: schema.users.settings,
      })
      .from(schema.users)
      .where(eq(schema.users.id, activeUser.id))
      .limit(1);

    if (!userRow) {
      return ctx
        .card({ title: "❌ 未找到设置", theme: "red" })
        .text("未找到通知设置", true)
        .build();
    }

    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;
    const prefs = normalizeUserSettings(userRow.settings).notifyPreferences;

    const eventValueMap: Record<RepoNotifyEvent, boolean> = {
      workflow_success: prefs.repoEvents.workflow_success,
      workflow_failure: prefs.repoEvents.workflow_failure,
      push: prefs.repoEvents.push,
      pr_opened: prefs.repoEvents.pr_opened,
      issue_opened: prefs.repoEvents.issue_opened,
      agent_completed: prefs.repoEvents.agent_completed,
      agent_failed: prefs.repoEvents.agent_failed,
    };

    const settings = [
      ...REPO_NOTIFY_EVENT_OPTIONS.map((ev) => `${eventValueMap[ev.value] ? "✅" : "❌"} ${ev.label}`),
      `${prefs.personalEvents.approval ? "✅" : "❌"} 审批通知`,
      `${prefs.personalEvents.system ? "✅" : "❌"} 系统通知`,
    ];

    return ctx
      .card({ title: "🔔 通知设置", theme: "blue" })
      .text("**当前通知偏好**\n\n" + settings.join("\n"), true)
      .divider()
      .systemButtons([
        { text: "前往设置页面", url: `${baseUrl}/user/settings` },
      ])
      .build();
  },
});
