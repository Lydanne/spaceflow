import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";

export default defineCardPage({
  name: "repos",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const orgName = ctx.params.orgName as string | undefined;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    let repos: { full_name: string }[];

    if (orgName) {
      const [org] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.name, orgName))
        .limit(1);

      if (!org) {
        return ctx
          .card({ title: "❌ 组织不存在", theme: "red" })
          .text(`未找到组织 ${orgName}`, true)
          .build();
      }

      repos = await db
        .select({ full_name: schema.repositories.full_name })
        .from(schema.repositories)
        .where(eq(schema.repositories.organization_id, org.id))
        .limit(20);
    } else {
      repos = await db
        .select({ full_name: schema.repositories.full_name })
        .from(schema.repositories)
        .limit(20);
    }

    const title = orgName ? `📋 ${orgName} 仓库列表` : "📋 仓库列表";
    const card = ctx.card({ title, theme: "blue" });

    if (repos.length === 0) {
      card.text(orgName ? `组织 ${orgName} 下暂无已注册仓库` : "暂无已注册仓库", true);
    } else {
      // 每个仓库可点击跳转
      for (const repo of repos) {
        const repoUrl = `${baseUrl}/${repo.full_name}`;
        card.text(`• [${repo.full_name}](${repoUrl})`, true);
      }
    }

    return card.build();
  },
});
