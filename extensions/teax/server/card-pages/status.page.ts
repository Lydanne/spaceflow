import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";
import { useGiteaSdk } from "~~/server/utils/gitea";

export default defineCardPage({
  name: "status",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const repoFullName = ctx.params.repoFullName as string;

    if (!repoFullName?.includes("/")) {
      return ctx
        .card({ title: "❌ 参数错误", theme: "red" })
        .text("用法: /status <owner/repo>\n例如: /status myorg/myrepo", true)
        .build();
    }

    const [owner, repo] = repoFullName.split("/");

    // 验证仓库是否在 Teax 中注册
    const [repoRecord] = await db
      .select({
        id: schema.repositories.id,
        full_name: schema.repositories.full_name,
      })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, repoFullName))
      .limit(1);

    if (!repoRecord) {
      return ctx
        .card({ title: "❌ 仓库未注册", theme: "red" })
        .text(`仓库 ${repoFullName} 未在 Teax 中注册`, true)
        .build();
    }

    try {
      const gitea = await useGiteaSdk().role("admin");
      const result = await gitea.getRepoWorkflowRuns(owner!, repo!, 1, 5);
      const runs = result.workflow_runs || [];

      if (runs.length === 0) {
        return ctx
          .card({ title: `📋 ${repoFullName}`, theme: "blue" })
          .text("暂无构建记录", true)
          .build();
      }

      const conclusionEmoji: Record<string, string> = {
        success: "✅",
        failure: "❌",
        cancelled: "⚫",
        skipped: "⏭",
      };

      const statusEmoji: Record<string, string> = {
        running: "🔄",
        queued: "⏳",
        waiting: "⏳",
      };

      const lines = runs.map((r) => {
        const emoji = r.conclusion
          ? conclusionEmoji[r.conclusion] || "❓"
          : statusEmoji[r.status] || "❓";
        const branch = r.head_branch || "?";
        return `${emoji} #${r.run_number} **${r.display_title}** (${branch})`;
      });

      const config = useRuntimeConfig();
      const actionsUrl = `${config.public.appUrl}/${owner}/${repo}/actions`;

      return ctx
        .card({ title: `📋 ${repoFullName} 构建状态`, theme: "blue" })
        .text(lines.join("\n"), true)
        .divider()
        .button("查看全部", { url: actionsUrl })
        .build();
    } catch (err) {
      console.error("[status] error:", err);
      return ctx
        .card({ title: "❌ 查询失败", theme: "red" })
        .text("查询构建状态失败，请稍后重试", true)
        .build();
    }
  },
});
