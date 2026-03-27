import { eq, desc } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";

export default defineCardPage({
  name: "approvals",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();

    const pendingApprovals = await db
      .select({
        id: schema.approvalFlows.id,
        title: schema.approvalFlows.title,
        flow_type: schema.approvalFlows.flow_type,
        created_at: schema.approvalFlows.created_at,
      })
      .from(schema.approvalFlows)
      .where(eq(schema.approvalFlows.status, "pending"))
      .orderBy(desc(schema.approvalFlows.created_at))
      .limit(10);

    if (pendingApprovals.length === 0) {
      return ctx
        .card({ title: "✅ 审批列表", theme: "green" })
        .text("暂无待处理的审批", true)
        .build();
    }

    const lines = pendingApprovals.map((a) => {
      const date = a.created_at
        ? new Date(a.created_at).toLocaleDateString("zh-CN")
        : "";
      return `• **${a.title}**\n  ${a.flow_type} · ${date}`;
    });

    return ctx
      .card({ title: `📋 待处理审批 (${pendingApprovals.length})`, theme: "orange" })
      .text(lines.join("\n\n"), true)
      .systemButtons()
      .build();
  },
});
