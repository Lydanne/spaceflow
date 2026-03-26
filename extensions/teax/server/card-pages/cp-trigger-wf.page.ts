import { defineCardPage, EnhancedCardBuilder, asyncTask, guards, requireBinding, requireRepoPermission } from "~~/server/card-kit";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { parseWorkflowYaml, extractInputs, type WorkflowInputDef } from "~~/server/utils/workflow-yaml";
import { getActiveAccount } from "~~/server/services/account.service";
import { getUserGiteaTokens } from "~~/server/services/auth.service";

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

    // 使用用户 token（通过飞书 openId 获取），fallback 到 admin token
    const gitea = useGiteaSdk({
      userTokenProvider: async () => {
        const user = await getActiveAccount(ctx.openId);
        return user ? getUserGiteaTokens(user.id) : null;
      },
    });
    const giteaService = await gitea.role("admin");
    const workflowName = workflowPath.split("/").pop() || workflowPath;

    // 获取分支列表
    let branches: Array<{ label: string; value: string }> = [];
    let defaultBranch = "main";
    try {
      const branchList = await giteaService.getRepoBranches(owner, repo);
      branches = branchList.map((b) => ({ label: b.name, value: b.name }));
      // 获取默认分支
      const repoInfo = await giteaService.getRepo(owner, repo);
      defaultBranch = repoInfo.default_branch || "main";
    } catch (err) {
      console.warn("[cp:trigger-wf] Failed to fetch branches:", err);
    }

    // 获取 workflow inputs
    let inputDefs: Record<string, WorkflowInputDef> | null = null;
    let workflowYaml: string | null = null;
    try {
      workflowYaml = await giteaService.getFileContent(owner, repo, workflowPath, defaultBranch);
      if (workflowYaml) {
        const doc = parseWorkflowYaml(workflowYaml);
        if (doc) {
          inputDefs = extractInputs(doc);
        }
      }
    } catch (err) {
      console.warn("[cp:trigger-wf] Failed to fetch workflow content:", err);
    }

    // 排序分支：默认分支在前
    const defaultFirst = branches.find((b) => b.value === defaultBranch);
    const rest = branches.filter((b) => b.value !== defaultBranch);
    const sortedBranches = defaultFirst ? [defaultFirst, ...rest] : branches;

    const card = ctx.card({
      title: `🔧 触发工作流`,
      theme: "blue",
    });

    card.text(`**仓库**: ${owner}/${repo}\n**工作流**: ${workflowName}`, true);
    card.divider();

    card.form("trigger_wf_form");

    // 分支选择
    if (sortedBranches.length > 0) {
      card.select({
        name: "branch",
        label: "分支",
        placeholder: "选择分支",
        required: true,
        options: sortedBranches,
        initial_option: defaultBranch,
      });
    }

    // Workflow inputs
    if (inputDefs) {
      for (const [key, def] of Object.entries(inputDefs)) {
        if (def.type === "choice" && def.options?.length) {
          const defaultValue = def.default != null ? String(def.default) : undefined;
          card.select({
            name: key,
            label: def.description || key,
            placeholder: `选择 ${def.description || key}`,
            required: def.required || false,
            options: def.options.map((o) => ({ label: o, value: o })),
            initial_option: defaultValue,
          });
        } else if (def.type === "boolean") {
          const boolDefault = def.default != null ? (def.default ? "true" : "false") : undefined;
          card.select({
            name: key,
            label: def.description || key,
            placeholder: `选择 ${def.description || key}`,
            required: def.required || false,
            options: [
              { label: "是", value: "true" },
              { label: "否", value: "false" },
            ],
            initial_option: boolDefault,
          });
        } else {
          card.inputV2({
            name: key,
            label: def.description || key,
            placeholder: def.default ? String(def.default) : `输入 ${def.description || key}`,
            required: def.required || false,
            default_value: def.default ? String(def.default) : undefined,
          });
        }
      }
    }

    card.formButtons({
      submit: { text: "🚀 触发", type: "primary" },
    });

    card.endForm();

    card.divider();
    card.button("⬅️ 返回", {
      navigate: ["cp:actions", { owner, repo }],
    });

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
        // Dispatch workflow
        const gitea = useGiteaSdk({
          userTokenProvider: async () => {
            const user = await getActiveAccount(openId);
            return user ? getUserGiteaTokens(user.id) : null;
          },
        });
        const giteaService = await gitea.role("admin");

        try {
          await giteaService.dispatchWorkflow(owner, repo, workflowFileName, branch, inputs);
        } catch (err) {
          console.error("[cp:trigger-wf] dispatchWorkflow error:", err);
          const errObj = err as { data?: { message?: string }; message?: string };
          const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
          await ctx.update(
            new EnhancedCardBuilder({ title: "❌ 触发失败", theme: "red" }, "")
              .text(msg, true)
              .build(),
          );
          return;
        }

        // 4. Poll for new run
        let newRunId: number | null = null;
        let newRunNumber: number | null = null;
        let latestRunId = 0;

        try {
          const runs = await giteaService.getRepoWorkflowRuns(owner, repo, 1, 5);
          const latestRun = runs.workflow_runs?.find((run: { path?: string }) => run.path?.includes(workflowFileName));
          if (latestRun) {
            latestRunId = latestRun.id;
          }
        } catch {
          // Ignore
        }

        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            const runs = await giteaService.getRepoWorkflowRuns(owner, repo, 1, 5);
            const newRun = runs.workflow_runs?.find((run: { path?: string; id: number }) => {
              return run.path?.includes(workflowFileName) && run.id > latestRunId;
            });
            if (newRun) {
              newRunId = newRun.id;
              newRunNumber = newRun.run_number;
              break;
            }
          } catch {
            // Continue polling
          }
        }

        // 5. Show result
        const config = useRuntimeConfig();
        const baseUrl = config.public.appUrl as string;
        const resultCard = new EnhancedCardBuilder(
          {
            title: newRunId ? "✅ 工作流已触发" : "⚠️ 工作流已提交",
            theme: newRunId ? "green" : "orange",
          },
          "",
        );

        const resultLines = [
          `**仓库**: ${owner}/${repo}`,
          `**分支**: ${branch}`,
          `**工作流**: ${workflowFileName}`,
        ];

        if (newRunId) {
          resultLines.push(`**运行编号**: #${newRunNumber}`);
          resultLines.push(`[查看运行详情](${baseUrl}/${owner}/${repo}/actions/runs/${newRunId})`);
        }

        resultCard.text(resultLines.join("\n"), true);
        await ctx.update(resultCard.build());
      },
    );
  },
});
