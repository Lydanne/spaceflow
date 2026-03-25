import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, navigate } from "~~/server/card-kit";
import { useGiteaSdk } from "~~/server/utils/gitea";

export default defineCardPage({
  name: "wf:select",

  async render(ctx) {
    const repoFullName = ctx.params.repoFullName as string;
    if (!repoFullName) {
      return ctx
        .card({ title: "❌ 参数错误", theme: "red" })
        .text("缺少仓库名称", true)
        .build();
    }

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      return ctx
        .card({ title: "❌ 参数错误", theme: "red" })
        .text("仓库名称格式错误，应为 owner/repo", true)
        .build();
    }

    // 验证用户绑定
    const db = useDB();
    const [binding] = await db
      .select({ user_id: schema.userFeishu.user_id })
      .from(schema.userFeishu)
      .where(eq(schema.userFeishu.feishu_open_id, ctx.openId))
      .limit(1);

    if (!binding?.user_id) {
      return ctx
        .card({ title: "❌ 未绑定账号", theme: "orange" })
        .text("请先在 Teax 中绑定飞书账号", true)
        .build();
    }

    // 验证仓库
    const [repoRecord] = await db
      .select({
        id: schema.repositories.id,
        full_name: schema.repositories.full_name,
        default_branch: schema.repositories.default_branch,
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

    // 获取工作流列表
    const gitea = await useGiteaSdk().role("admin");
    const workflowsResult = await gitea.getRepoWorkflows(owner, repo);
    const workflows = workflowsResult.workflows || [];

    if (workflows.length === 0) {
      return ctx
        .card({ title: "❌ 无可用工作流", theme: "red" })
        .text(`仓库 ${repoFullName} 暂无可用工作流`, true)
        .build();
    }

    const card = ctx.card({
      title: `🚀 ${repoFullName} - 选择工作流`,
      theme: "blue",
    });

    card.text("请选择要触发的工作流:", true);

    card.form("wf_select_form");
    card.select({
      name: "workflow",
      label: "工作流",
      placeholder: "选择工作流",
      required: true,
      options: workflows.map((w) => ({
        label: w.name,
        value: JSON.stringify({ path: w.path, name: w.name }),
      })),
    });
    card.formButtons({
      submit: { text: "下一步 ▶", type: "primary" },
    });
    card.endForm();

    return card.build();
  },

  async onAction(ctx) {
    const repoFullName = ctx.params.repoFullName as string;
    const formValue = ctx.formValue || {};
    const workflowJson = formValue.workflow;

    if (!workflowJson) {
      return navigate("wf:select", { repoFullName });
    }

    let workflowData: { path: string; name: string };
    try {
      workflowData = JSON.parse(workflowJson) as { path: string; name: string };
    } catch {
      return navigate("wf:select", { repoFullName });
    }

    return navigate("wf:params", {
      repoFullName,
      workflowPath: workflowData.path,
      workflowName: workflowData.name,
    });
  },
});
