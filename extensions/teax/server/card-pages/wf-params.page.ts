import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, navigate, asyncTask } from "~~/server/card-kit";
import { useGiteaSdk, botLogin } from "~~/server/utils/gitea";
import { buildDispatchErrorCard, buildTriggerResultCard, fetchWorkflowFormData, renderWorkflowForm } from "~~/server/utils/workflow-trigger";

export default defineCardPage({
  name: "wf-params",

  async render(ctx) {
    const repoFullName = ctx.params.repoFullName as string;
    const workflowPath = ctx.params.workflowPath as string;
    const workflowName = ctx.params.workflowName as string;

    if (!repoFullName || !workflowPath) {
      return ctx
        .card({ title: "❌ 参数错误", theme: "red" })
        .text("缺少仓库或工作流信息", true)
        .build();
    }

    const [owner, repo] = repoFullName.split("/");

    // 获取仓库默认分支
    const db = useDB();
    const [repoRecord] = await db
      .select({ default_branch: schema.repositories.default_branch })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, repoFullName))
      .limit(1);

    const defaultBranch = repoRecord?.default_branch || "main";

    const gitea = await useGiteaSdk().role("admin");
    const formData = await fetchWorkflowFormData(gitea, {
      owner: owner!,
      repo: repo!,
      workflowPath,
      defaultBranch,
    });

    const card = ctx.card({ title: `🚀 ${repoFullName} - ${workflowName}`, theme: "blue" });
    card.text(`**工作流**: ${workflowName}\n**仓库**: ${repoFullName}`, true);
    card.divider();

    renderWorkflowForm(card, formData, { formName: "wf_params_form" });

    return card.build();
  },

  async onAction(ctx) {
    const repoFullName = ctx.params.repoFullName as string;
    const workflowPath = ctx.params.workflowPath as string;
    const workflowName = ctx.params.workflowName as string;
    const formValue = ctx.formValue || {};

    const [owner, repo] = repoFullName.split("/");

    const branch = formValue.branch;
    if (!branch) {
      return navigate("wf-params", {
        repoFullName,
        workflowPath,
        workflowName,
      });
    }

    // Collect input parameters
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(formValue)) {
      if (key === "branch") continue;
      inputs[key] = String(value);
    }

    // Return AsyncTaskResult
    return asyncTask(
      `**仓库**: ${repoFullName}\n**工作流**: ${workflowName}\n\n⏳ 正在触发工作流，请稍候...`,
      async () => {
        try {
          const gitea = await useGiteaSdk(botLogin(ctx.openId)).role("fallback-admin");
          await gitea.dispatchWorkflow(owner!, repo!, workflowPath, branch, inputs);
        } catch (err) {
          console.error("[wf-params] dispatchWorkflow error:", err);
          await ctx.update(buildDispatchErrorCard(err));
          return;
        }

        const extraLines: string[] = [];
        if (Object.keys(inputs).length > 0) {
          extraLines.push(`**参数**: ${Object.entries(inputs).map(([k, v]) => `${k}=${v}`).join(", ")}`);
        }

        await ctx.update(buildTriggerResultCard({
          repoFullName,
          branch,
          workflowPath: workflowName,
          runId: null,
          runNumber: null,
          extraLines,
        }));
      },
    );
  },
});
