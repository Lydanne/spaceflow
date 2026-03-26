import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp-repos",

  async render(ctx) {
    const orgName = ctx.params.orgName as string;
    const db = useDB();

    // 获取组织信息
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.name, orgName))
      .limit(1);

    if (!org) {
      return ctx
        .card({ title: "❌ 组织不存在", theme: "red" })
        .text(`组织 **${orgName}** 不存在`, true)
        .build();
    }

    // 获取组织的仓库列表
    const repos = await db
      .select({
        id: schema.repositories.id,
        name: schema.repositories.name,
        full_name: schema.repositories.full_name,
      })
      .from(schema.repositories)
      .where(eq(schema.repositories.organization_id, org.id))
      .limit(20);

    if (repos.length === 0) {
      return ctx
        .card({ title: `📁 ${orgName}`, theme: "blue" })
        .text("该组织还没有仓库", true)
        .divider()
        .backButton("⬅️ 返回")
        .build();
    }

    const card = ctx.card({ title: `📁 ${orgName}`, theme: "blue" });
    card.text(`**${orgName}** 的仓库列表`, true);
    card.divider();

    for (const repo of repos) {
      card.button(`📦 ${repo.name}`, {
        navigate: ["cp-repo-menu", { owner: orgName, repo: repo.name }, { mode: "push" }],
      });
    }

    card.divider();
    card.backButton("⬅️ 返回");

    return card.build();
  },

});
