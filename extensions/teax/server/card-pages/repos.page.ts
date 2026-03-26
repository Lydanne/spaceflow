import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";

export default defineCardPage({
  name: "repos",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const orgName = ctx.params.orgName as string | undefined;

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

    if (repos.length === 0) {
      return ctx
        .card({ title: "📋 仓库列表", theme: "blue" })
        .text(orgName ? `组织 ${orgName} 下暂无已注册仓库` : "暂无已注册仓库", true)
        .build();
    }

    const lines = repos.map((r) => `• ${r.full_name}`);
    const title = orgName ? `📋 ${orgName} 仓库列表` : "📋 仓库列表";

    return ctx
      .card({ title, theme: "blue" })
      .text(lines.join("\n"), true)
      .build();
  },
});
