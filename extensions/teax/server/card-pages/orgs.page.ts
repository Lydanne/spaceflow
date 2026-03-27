import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";
import type { User } from "~~/server/db/schema";

export default defineCardPage({
  name: "orgs",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const activeUser = ctx.inject<User>(requireBinding);
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

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

    const card = ctx.card({ title: "🏢 我的组织", theme: "blue" });

    if (orgs.length === 0) {
      card.text("您暂未加入任何组织", true);
    } else {
      // 每个组织可点击跳转
      for (const org of orgs) {
        const orgUrl = `${baseUrl}/${org.name}`;
        card.text(`• [**${org.full_name || org.name}**](${orgUrl}) (\`${org.name}\`)`, true);
      }
    }

    card.divider();
    card.text("💡 使用 `/repos <组织名>` 查看组织下的仓库", true);
    card.systemButtons();

    return card.build();
  },
});
