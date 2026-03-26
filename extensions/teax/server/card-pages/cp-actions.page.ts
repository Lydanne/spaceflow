import { defineCardPage } from "~~/server/card-kit";
import { useGiteaSdk, botLogin } from "~~/server/utils/gitea";

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

    let runs: Array<{
      id: number;
      run_number: number;
      display_title: string;
      status: string;
      conclusion: string | null;
      head_branch: string;
      head_sha: string;
      started_at: string;
    }> = [];
    let workflows: Array<{ name: string; path: string }> = [];

    try {
      // 使用用户 token（通过飞书 openId 获取），fallback 到 admin token
      const giteaService = await useGiteaSdk(botLogin(ctx.openId)).role("fallback-admin");

      // 只获取前5条运行记录
      const response = await giteaService.getRepoWorkflowRuns(owner, repo, 1, 5);
      runs = response.workflow_runs ?? [];

      // 获取可用的 workflow 列表
      const wfResponse = await giteaService.getRepoWorkflows(owner, repo);
      workflows = wfResponse.workflows ?? [];
    } catch (error) {
      console.error("[cp:actions] Failed to fetch data:", error);
    }

    const card = ctx.card({
      title: `🚀 Actions - ${owner}/${repo}`,
      theme: "blue",
    });

    // === 触发工作流区域（上） ===
    if (workflows.length > 0) {
      card.text("**🚗 触发工作流**", true);
      card.divider();

      // 显示可用的 workflow 按钮
      const workflowButtons = workflows.map((wf) => ({
        text: wf.name.replace(/\.ya?ml$/, ""),
        type: "default" as const,
        navigate: ["cp:trigger-wf", { owner, repo, workflowPath: wf.path }, { newMessage: true }] as [string, Record<string, unknown>, { newMessage: boolean }],
      }));

      // 每4个一组显示按钮
      for (let i = 0; i < workflowButtons.length; i += 4) {
        const chunk = workflowButtons.slice(i, i + 4);
        card.buttons(chunk);
      }
    }

    // === 运行记录区域（下） ===
    card.divider();
    card.text("**📋 运行记录**", true);
    card.divider();

    if (runs.length === 0) {
      card.text(
        `暂无运行记录\n\n[在浏览器中查看全部](${baseUrl}/${owner}/${repo}/actions)`,
        true,
      );
    } else {
      // 显示前5条记录，每条可点击跳转
      for (const run of runs) {
        const emoji = getStatusEmoji(run.status, run.conclusion);
        const timeAgo = formatTimeAgo(run.started_at);
        const shortSha = run.head_sha.substring(0, 7);
        const runUrl = `${baseUrl}/${owner}/${repo}/actions/runs/${run.id}`;
        card.text(
          `${emoji} [${run.display_title}](${runUrl})\n分支: ${run.head_branch} · ${shortSha}\n时间: ${timeAgo}`,
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
