import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, navigate, asyncTask, EnhancedCardBuilder } from "~~/server/card-kit";
import { useGiteaSdk } from "~~/server/utils/gitea";
import * as yaml from "yaml";

export default defineCardPage({
  name: "wf:params",

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

    // 获取工作流文件并解析 inputs
    const gitea = await useGiteaSdk().role("admin");
    let inputDefs: Record<string, Record<string, unknown>> = {};

    try {
      const content = await gitea.getFileContent(owner!, repo!, workflowPath);
      if (content) {
        const workflowYaml = yaml.parse(content) as Record<string, unknown>;
        const onConfig = workflowYaml.on as Record<string, unknown> | string[] | undefined;
        if (onConfig && typeof onConfig === "object" && !Array.isArray(onConfig)) {
          const dispatchConfig = onConfig.workflow_dispatch as Record<string, unknown> | undefined;
          if (dispatchConfig) {
            inputDefs = (dispatchConfig.inputs as Record<string, Record<string, unknown>>) || {};
          }
        }
      }
    } catch (err) {
      console.warn("[wf:params] Failed to parse workflow:", err);
    }

    // 获取分支列表
    let branches: Array<{ label: string; value: string }> = [];
    try {
      const branchList = await gitea.getRepoBranches(owner!, repo!);
      branches = branchList.map((b) => ({ label: b.name, value: b.name }));
    } catch {
      branches = [{ label: defaultBranch, value: defaultBranch }];
    }

    // 排序：默认分支在前
    const defaultFirst = branches.find((b) => b.value === defaultBranch);
    const rest = branches.filter((b) => b.value !== defaultBranch);
    const sortedBranches = defaultFirst ? [defaultFirst, ...rest] : branches;

    const inputKeys = Object.keys(inputDefs);

    const card = ctx.card({
      title: `🚀 ${repoFullName} - ${workflowName}`,
      theme: "blue",
    });

    card.text(`**工作流**: ${workflowName}\n**仓库**: ${repoFullName}`, true);
    card.divider();

    card.form("wf_params_form");

    // Branch selector - 默认选中仓库默认分支
    card.select({
      name: "branch",
      label: "分支",
      placeholder: "选择分支",
      required: true,
      options: sortedBranches,
      initial_option: defaultBranch,
    });

    // Workflow input parameters
    if (inputKeys.length > 0) {
      for (const key of inputKeys) {
        const inputDef = inputDefs[key]!;
        const description = inputDef.description as string | undefined;
        const defaultValue = inputDef.default as string | undefined;
        const required = inputDef.required as boolean | undefined;
        const inputType = inputDef.type as string | undefined;
        console.log(`[wf-params] key=${key}, type=${inputType}, defaultValue=${defaultValue}, inputDef=`, JSON.stringify(inputDef));

        const label = description
          ? `${key}${required ? " *" : ""} - ${description}`
          : `${key}${required ? " *" : ""}`;

        if (inputType === "choice" && inputDef.options) {
          const options = inputDef.options as string[];
          card.select({
            name: `input_${key}`,
            label,
            placeholder: `选择 ${key}`,
            required: required || false,
            options: options.map((opt) => ({ label: opt, value: opt })),
            initial_option: defaultValue,
          });
        } else if (inputType === "boolean") {
          card.select({
            name: `input_${key}`,
            label,
            placeholder: `选择 ${key}`,
            required: required || false,
            options: [
              { label: "true", value: "true" },
              { label: "false", value: "false" },
            ],
            initial_option: defaultValue,
          });
        } else {
          card.inputV2({
            name: `input_${key}`,
            label,
            placeholder: defaultValue || `请输入 ${key}`,
            required: required || false,
            default_value: defaultValue,
          });
        }
      }
    }

    card.formButtons({
      submit: { text: "🚀 触发工作流", type: "primary" },
    });
    card.endForm();

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
      return navigate("wf:params", {
        repoFullName,
        workflowPath,
        workflowName,
      });
    }

    // Collect input parameters
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(formValue)) {
      if (key === "branch") continue;
      if (key.startsWith("input_")) {
        inputs[key.replace("input_", "")] = value;
      }
    }

    // Return AsyncTaskResult
    return asyncTask(
      `**仓库**: ${repoFullName}\n**工作流**: ${workflowName}\n\n⏳ 正在触发工作流，请稍候...`,
      async () => {
        const updateCard = ctx.updateCard;

        try {
          const gitea = await useGiteaSdk().role("admin");
          await gitea.dispatchWorkflow(owner!, repo!, workflowPath, branch, inputs);
        } catch (err) {
          console.error("[wf:params] dispatchWorkflow error:", err);
          const errObj = err as { data?: { message?: string }; message?: string };
          const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
          await updateCard(
            new EnhancedCardBuilder({ title: "❌ 触发失败", theme: "red" }, "")
              .text(msg, true)
              .build(),
          );
          return;
        }

        await updateCard(
          new EnhancedCardBuilder({ title: "✅ 工作流已触发", theme: "green" }, "")
            .text(
              [
                `**仓库**: ${repoFullName}`,
                `**分支**: ${branch}`,
                `**工作流**: ${workflowName}`,
                Object.keys(inputs).length > 0
                  ? `**参数**: ${Object.entries(inputs).map(([k, v]) => `${k}=${v}`).join(", ")}`
                  : "",
              ].filter(Boolean).join("\n"),
              true,
            )
            .build(),
        );
      },
    );
  },
});
