import { defineCardPage } from "~~/server/card-kit";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { parseWorkflowYaml, extractInputs, type WorkflowInputDef } from "~~/server/utils/workflow-yaml";
import { getActiveAccount } from "~~/server/services/account.service";
import { queryUserPermissionGroups, rowGrantsPermission } from "~~/server/utils/permission";
import { useDB, schema } from "~~/server/db";
import { eq } from "drizzle-orm";

// --- Helper: permission check without H3Event ---
async function checkUserPermission(userId: string, orgId: string, permission: string, repositoryId?: string): Promise<boolean> {
  const groups = await queryUserPermissionGroups(userId, orgId);
  return groups.some((group) => rowGrantsPermission(group, permission, repositoryId));
}

export default defineCardPage({
  name: "cp:trigger-wf",

  async render(ctx) {
    const owner = ctx.params.owner as string;
    const repo = ctx.params.repo as string;
    const workflowPath = ctx.params.workflowPath as string;

    const gitea = await useGiteaSdk().role("admin");
    const workflowName = workflowPath.split("/").pop() || workflowPath;

    // 获取分支列表
    let branches: Array<{ label: string; value: string }> = [];
    let defaultBranch = "main";
    try {
      const branchList = await gitea.getRepoBranches(owner, repo);
      branches = branchList.map((b) => ({ label: b.name, value: b.name }));
      // 获取默认分支
      const repoInfo = await gitea.getRepo(owner, repo);
      defaultBranch = repoInfo.default_branch || "main";
    } catch (err) {
      console.warn("[cp:trigger-wf] Failed to fetch branches:", err);
    }

    // 获取 workflow inputs
    let inputDefs: Record<string, WorkflowInputDef> | null = null;
    try {
      const content = await gitea.getFileContent(owner, repo, workflowPath, defaultBranch);
      if (content) {
        const doc = parseWorkflowYaml(content);
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

    // 1. Check user binding
    const activeUser = await getActiveAccount(ctx.openId);
    if (!activeUser) {
      const config = useRuntimeConfig();
      const baseUrl = config.public.appUrl as string;
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const card = new EnhancedCardBuilder(
        { title: "🔗 未绑定账号", theme: "orange" },
        "",
      )
        .text(`请先在 Teax 中绑定飞书账号\n\n[前往绑定](${baseUrl}/user/settings)`, true)
        .build();
      await ctx.updateCard(card);
      return undefined;
    }

    // 2. Check permission
    const db = useDB();
    const [repoRecord] = await db
      .select({ id: schema.repositories.id, organization_id: schema.repositories.organization_id })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, `${owner}/${repo}`))
      .limit(1);

    if (!repoRecord) {
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const card = new EnhancedCardBuilder(
        { title: "❌ 仓库不存在", theme: "red" },
        "",
      )
        .text("该仓库未在系统中注册", true)
        .build();
      await ctx.updateCard(card);
      return undefined;
    }

    const canTrigger = await checkUserPermission(activeUser.id, repoRecord.organization_id, "actions:trigger", repoRecord.id);
    if (!canTrigger) {
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const card = new EnhancedCardBuilder(
        { title: "❌ 无权限", theme: "red" },
        "",
      )
        .text("您没有触发此工作流的权限", true)
        .build();
      await ctx.updateCard(card);
      return undefined;
    }

    // 3. Build inputs
    const branch = formValue.branch || "main";
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(formValue)) {
      if (key === "branch") continue;
      inputs[key] = String(value);
    }

    // 4. Show loading
    {
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const loadingCard = new EnhancedCardBuilder(
        { title: "🚀 触发工作流", theme: "blue" },
        "",
      )
        .text("⏳ 正在触发工作流，请稍候...", true)
        .build();
      await ctx.updateCard(loadingCard);
    }

    // 5. Dispatch workflow
    const gitea = await useGiteaSdk().role("admin");
    const workflowFileName = workflowPath.split("/").pop() || workflowPath;

    try {
      await gitea.dispatchWorkflow(owner, repo, workflowFileName, branch, inputs);
    } catch (err) {
      console.error("[cp:trigger-wf] dispatchWorkflow error:", err);
      const errObj = err as { data?: { message?: string }; message?: string };
      const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
      const { EnhancedCardBuilder } = await import("~~/server/card-kit");
      const card = new EnhancedCardBuilder(
        { title: "❌ 触发失败", theme: "red" },
        "",
      )
        .text(msg, true)
        .build();
      await ctx.updateCard(card);
      return undefined;
    }

    // 6. Poll for new run
    let newRunId: number | null = null;
    let newRunNumber: number | null = null;
    let latestRunId = 0;

    try {
      const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
      const latestRun = runs.workflow_runs?.find((run) => run.path?.includes(workflowFileName));
      if (latestRun) {
        latestRunId = latestRun.id;
      }
    } catch {
      // Ignore
    }

    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
        const newRun = runs.workflow_runs?.find((run) => {
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

    // 7. Show result
    const config = useRuntimeConfig();
    const baseUrl = config.public.appUrl as string;
    const { EnhancedCardBuilder } = await import("~~/server/card-kit");
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
    await ctx.updateCard(resultCard.build());

    return undefined;
  },
});
