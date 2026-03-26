import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";
import { getActiveAccount } from "~~/server/services/account.service";

export default defineCardPage({
  name: "orgs",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const activeUser = await getActiveAccount(ctx.openId);

    if (!activeUser) {
      return ctx
        .card({ title: "❌ 未绑定", theme: "red" })
        .text("请先在 Teax 中绑定飞书账号", true)
        .build();
    }

    const orgs = await db
      .selectDistinct({
        id: schema.organizations.id,
        name: schema.organizations.name,
        full_name: schema.organizations.full_name,
      })
      .from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
      .innerJoin(
        schema.organizations,
        eq(schema.teams.organization_id, schema.organizations.id),
      )
      .where(eq(schema.teamMembers.user_id, activeUser.id));

    if (orgs.length === 0) {
      return ctx
        .card({ title: "🏢 我的组织", theme: "blue" })
        .text("您暂未加入任何组织", true)
        .build();
    }

    const lines = orgs.map((o) => `• **${o.full_name || o.name}** (${o.name})`);

    return ctx
      .card({ title: "🏢 我的组织", theme: "blue" })
      .text(lines.join("\n"), true)
      .divider()
      .text("💡 使用 `/repos <组织名>` 查看组织下的仓库", true)
      .build();
  },
});
