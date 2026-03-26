import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, requireBinding } from "~~/server/card-kit";
import { useGiteaSdk } from "~~/server/utils/gitea";

function getStatusEmoji(status: string, conclusion: string | null): string {
  if (conclusion === "success") return "✅";
  if (conclusion === "failure") return "❌";
  if (conclusion === "cancelled") return "🚫";
  if (status === "in_progress" || status === "waiting") return "⏳";
  return "⚪";
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

export default defineCardPage({
  name: "status",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const db = useDB();
    const repoFullName = ctx.params.repoFullName as string;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

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

      const card = ctx.card({ title: `📋 ${repoFullName}`, theme: "blue" });

      if (runs.length === 0) {
        card.text("暂无构建记录", true);
      } else {
        // 每条记录可点击跳转
        for (const run of runs) {
          const emoji = getStatusEmoji(run.status, run.conclusion);
          const timeAgo = formatTimeAgo(run.started_at);
          const shortSha = run.head_sha?.substring(0, 7) || "?";
          const runUrl = `${baseUrl}/${owner}/${repo}/actions/runs/${run.id}`;
          card.text(
            `${emoji} [#${run.run_number} ${run.display_title}](${runUrl})\n分支: ${run.head_branch} · ${shortSha} · ${timeAgo}`,
            true,
          );
        }
      }

      card.systemButtons([
        { text: "查看全部", url: `${baseUrl}/${owner}/${repo}/actions` },
      ]);

      return card.build();
    } catch (err) {
      console.error("[status] error:", err);
      return ctx
        .card({ title: "❌ 查询失败", theme: "red" })
        .text("查询构建状态失败，请稍后重试", true)
        .build();
    }
  },
});
