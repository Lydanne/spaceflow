import { defineCardPage, asyncTask, guards, requireBinding, requireRepoPermission } from "~~/server/card-kit";
import { useGiteaSdk, botLogin } from "~~/server/utils/gitea";
import { dispatchAndPoll, buildDispatchErrorCard, buildTriggerResultCard, fetchWorkflowFormData, renderWorkflowForm } from "~~/server/utils/workflow-trigger";

export default defineCardPage({
  name: "cp:trigger-wf",

  beforeEnter: guards(
    requireBinding(),
    requireRepoPermission("actions:trigger"),
  ),

  async render(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const workflowPath = ctx.params.workflowPath as string;

    const giteaService = await useGiteaSdk(botLogin(ctx.openId)).role("fallback-admin");
    const workflowName = workflowPath.split("/").pop() || workflowPath;

    const formData = await fetchWorkflowFormData(giteaService, { owner, repo, workflowPath });

    const card = ctx.card({ title: `🔧 触发工作流`, theme: "blue" });
    card.text(`**仓库**: ${owner}/${repo}\n**工作流**: ${workflowName}`, true);
    card.divider();

    renderWorkflowForm(card, formData, { formName: "trigger_wf_form", submitText: "🚀 触发" });

    card.divider();
    card.button("⬅️ 返回", { navigate: ["cp:actions", { owner, repo }] });

    return card.build();
  },

  async onAction(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const workflowPath = ctx.params.workflowPath as string;
    const formValue = ctx.formValue || {};
    const workflowFileName = workflowPath.split("/").pop() || workflowPath;
    const openId = ctx.openId;

    // Build inputs synchronously
    const branch = formValue.branch || "main";
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(formValue)) {
      if (key === "branch") continue;
      inputs[key] = String(value);
    }

    // Return AsyncTaskResult: loading card rendered immediately, task runs in background
    return asyncTask(
      `**仓库**: ${owner}/${repo}\n**分支**: ${branch}\n**工作流**: ${workflowFileName}\n\n⏳ 正在触发工作流，请稍候...`,
      async () => {
        const giteaService = await useGiteaSdk(botLogin(openId)).role("fallback-admin");

        let result;
        try {
          result = await dispatchAndPoll(giteaService, { owner, repo, workflowFileName, branch, inputs });
        } catch (err) {
          console.error("[cp:trigger-wf] dispatchWorkflow error:", err);
          await ctx.update(buildDispatchErrorCard(err));
          return;
        }

        await ctx.update(buildTriggerResultCard({
          repoFullName: `${owner}/${repo}`,
          branch,
          workflowPath: workflowFileName,
          runId: result.runId,
          runNumber: result.runNumber,
        }));
      },
    );
  },
});
