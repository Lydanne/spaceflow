import { defineCardPage } from "~~/server/card-kit";
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
  name: "cp:actions",

  async render(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl;

    const gitea = useGiteaSdk();
    let runs: Awaited<
      ReturnType<
        Awaited<ReturnType<typeof gitea.role>>["getRepoWorkflowRuns"]
      >
    >["workflow_runs"] = [];

    try {
      const giteaService = await gitea.role("admin");
      const response = await giteaService.getRepoWorkflowRuns(owner, repo, 1, 10);
      runs = response.workflow_runs ?? [];
      console.log(`[cp:actions] Gitea API returned ${runs.length} runs`);
    } catch (error) {
      console.error("[cp:actions] Failed to fetch workflow runs:", error);
    }

    const card = ctx.card({
      title: `🚀 Actions - ${owner}/${repo}`,
      theme: "blue",
    });

    card.text(
      `**🚀 Actions 运行记录**\n最近 ${runs.length > 0 ? runs.length : 0} 条记录`,
      true,
    );
    card.divider();

    if (runs.length === 0) {
      card.text(
        `暂无运行记录\n\n[在浏览器中查看全部](${baseUrl}/${owner}/${repo}/actions)`,
        true,
      );
    } else {
      for (const run of runs) {
        const emoji = getStatusEmoji(run.status, run.conclusion);
        const timeAgo = formatTimeAgo(run.started_at);
        const shortSha = run.head_sha.substring(0, 7);
        card.text(
          `${emoji} **${run.display_title}**\n分支: ${run.head_branch} · ${shortSha}\n时间: ${timeAgo}`,
          true,
        );
      }

      card.divider();
      card.text(
        `[查看全部运行记录](${baseUrl}/${owner}/${repo}/actions)`,
        true,
      );
    }

    card.divider();
    card.button("⬅️ 返回", {
      navigate: ["cp:repo-menu", { owner, repo }],
    });

    return card.build();
  },
});
