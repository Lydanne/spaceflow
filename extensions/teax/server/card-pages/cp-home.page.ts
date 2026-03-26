import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp-home",

  async render(ctx) {
    const db = useDB();

    // 获取用户绑定
    const [binding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.openId))
      .limit(1);

    if (!binding?.user_id) {
      return ctx
        .card({ title: "🔒 未绑定账号", theme: "orange" })
        .text(
          "请先绑定 Gitea 账号才能使用控制面板\n\n访问 Teax 网站进行绑定",
          true,
        )
        .build();
    }

    // 获取用户的组织列表
    const userOrgs = await db
      .selectDistinct({
        org_id: schema.organizations.id,
        org_name: schema.organizations.name,
      })
      .from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
      .innerJoin(
        schema.organizations,
        eq(schema.teams.organization_id, schema.organizations.id),
      )
      .where(eq(schema.teamMembers.user_id, binding.user_id))
      .limit(20);

    if (userOrgs.length === 0) {
      return ctx
        .card({ title: "📋 控制面板", theme: "blue" })
        .text("您还没有加入任何组织\n\n请联系管理员将您添加到组织中", true)
        .build();
    }

    const card = ctx.card({ title: "📋 控制面板", theme: "blue" });
    card.text("**请选择组织**", true);
    card.divider();

    for (const org of userOrgs) {
      card.button(`📁 ${org.org_name}`, {
        navigate: ["cp-repos", { orgName: org.org_name }, { mode: "push" }],
      });
    }

    card.systemButtons();

    return card.build();
  },
});
