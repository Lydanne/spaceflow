/**
 * 工作流触发交互状态机
 * 使用状态机模式管理工作流选择 -> 参数填写 -> 触发的完整流程
 */

import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import type { FeishuInteractiveCard } from "~~/server/utils/feishu-sdk";
import {
  CardStateMachine,
  registerStateMachine,
  type CardState,
  type StepConfig,
  type StepTransition,
} from "~~/server/utils/card-state-machine";
import * as yaml from "yaml";

// ─── 状态数据类型 ─────────────────────────────────────────────

interface WorkflowActionData {
  // 仓库信息
  owner?: string;
  repo?: string;
  repoFullName?: string;
  defaultBranch?: string;

  // 工作流信息
  workflows?: Array<{ path: string; name: string }>;
  selectedWorkflow?: { path: string; name: string };
  workflowInputs?: Record<string, unknown>;
  inputKeys?: string[];

  // 分支信息
  branches?: Array<{ name: string }>;
  selectedBranch?: string;

  // 用户输入
  formData?: Record<string, string>;
}

// ─── 步骤 1: 选择工作流 ─────────────────────────────────────────

const selectWorkflowStep: StepConfig = {
  name: "select_workflow",

  async render(state: CardState): Promise<FeishuInteractiveCard> {
    const data = state.data as WorkflowActionData;

    if (!data.workflows || data.workflows.length === 0) {
      return {
        header: {
          title: { tag: "plain_text", content: "❌ 无可用工作流" },
          template: "red",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `仓库 ${data.repoFullName} 暂无可用工作流`,
            },
          },
        ],
      };
    }

    const options = data.workflows.map((w) => ({
      text: { tag: "plain_text", content: w.name },
      value: JSON.stringify({ path: w.path, name: w.name }),
    }));

    return {
      header: {
        title: { tag: "plain_text", content: `🚀 ${data.repoFullName} - 选择工作流` },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "请选择要触发的工作流:",
          },
        },
        {
          tag: "action",
          actions: [
            {
              tag: "select_static",
              placeholder: { tag: "plain_text", content: "选择工作流" },
              options,
              value: {
                key: "workflow_select",
              },
            },
          ],
        },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "下一步" },
              type: "primary",
              value: JSON.stringify({ action: "next" }),
            },
          ],
        },
      ],
    };
  },

  async onAction(state: CardState, action: Record<string, unknown>): Promise<StepTransition> {
    const data = state.data as WorkflowActionData;
    const selectedWorkflow = action.option as string | undefined;

    if (!selectedWorkflow) {
      throw new Error("请选择一个工作流");
    }

    let workflowData: { path: string; name: string };
    try {
      workflowData = JSON.parse(selectedWorkflow) as { path: string; name: string };
    } catch {
      throw new Error("工作流数据格式错误");
    }

    // 获取工作流文件内容并解析
    const gitea = await createServiceGiteaClient();
    const workflowContent = await gitea.getFileContent(
      data.owner!,
      data.repo!,
      workflowData.path,
    );

    if (!workflowContent) {
      throw new Error(`无法读取工作流文件: ${workflowData.path}`);
    }

    // 解析 workflow_dispatch 输入
    const workflowYaml = yaml.parse(workflowContent) as Record<string, unknown>;
    const onConfig = workflowYaml.on as Record<string, unknown> | string[] | undefined;
    let inputs: Record<string, unknown> = {};

    if (onConfig && typeof onConfig === "object" && !Array.isArray(onConfig)) {
      const dispatchConfig = onConfig.workflow_dispatch as Record<string, unknown> | undefined;
      if (dispatchConfig) {
        inputs = (dispatchConfig.inputs as Record<string, unknown>) || {};
      }
    }

    // 获取分支列表
    const branches = await gitea.getRepoBranches(data.owner!, data.repo!);

    return {
      nextStep: "fill_params",
      data: {
        selectedWorkflow: workflowData,
        workflowInputs: inputs,
        inputKeys: Object.keys(inputs),
        branches: branches.map((b) => ({ name: b.name })),
      },
      autoRender: true,
    };
  },
};

// ─── 步骤 2: 填写参数 ─────────────────────────────────────────

const fillParamsStep: StepConfig = {
  name: "fill_params",

  async render(state: CardState): Promise<FeishuInteractiveCard> {
    const data = state.data as WorkflowActionData;
    const workflow = data.selectedWorkflow!;
    const inputs = data.workflowInputs || {};
    const inputKeys = data.inputKeys || [];

    const branchOptions = (data.branches || []).map((b) => ({
      text: { tag: "plain_text", content: b.name },
      value: b.name,
    }));

    const formElements: Array<{ tag: string; [key: string]: unknown }> = [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**工作流**: ${workflow.name}\n**仓库**: ${data.repoFullName}`,
        },
      },
      {
        tag: "hr",
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: "**分支**",
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "select_static",
            placeholder: { tag: "plain_text", content: "选择分支" },
            options: branchOptions,
            initial_option: branchOptions.find((b) => b.value === data.defaultBranch)?.value || branchOptions[0]?.value,
            value: {
              key: "branch",
            },
          },
        ],
      },
    ];

    // 添加工作流参数表单
    if (inputKeys.length > 0) {
      formElements.push({
        tag: "hr",
      });
      formElements.push({
        tag: "div",
        text: {
          tag: "lark_md",
          content: "**工作流参数**",
        },
      });

      for (const key of inputKeys) {
        const inputDef = inputs[key] as Record<string, unknown>;
        const description = inputDef.description as string | undefined;
        const defaultValue = inputDef.default as string | undefined;
        const required = inputDef.required as boolean | undefined;
        const inputType = inputDef.type as string | undefined;

        let label = key;
        if (required) {
          label += " *";
        }
        if (description) {
          label += ` - ${description}`;
        }

        formElements.push({
          tag: "div",
          text: {
            tag: "lark_md",
            content: label,
          },
        });

        if (inputType === "choice" && inputDef.options) {
          const options = inputDef.options as string[];
          formElements.push({
            tag: "action",
            actions: [
              {
                tag: "select_static",
                placeholder: { tag: "plain_text", content: `选择 ${key}` },
                options: options.map((opt) => ({
                  text: { tag: "plain_text", content: opt },
                  value: opt,
                })),
                initial_option: defaultValue,
                value: {
                  key: `input_${key}`,
                },
              },
            ],
          });
        } else if (inputType === "boolean") {
          formElements.push({
            tag: "action",
            actions: [
              {
                tag: "select_static",
                placeholder: { tag: "plain_text", content: `选择 ${key}` },
                options: [
                  { text: { tag: "plain_text", content: "true" }, value: "true" },
                  { text: { tag: "plain_text", content: "false" }, value: "false" },
                ],
                initial_option: defaultValue === "true" ? "true" : "false",
                value: {
                  key: `input_${key}`,
                },
              },
            ],
          });
        } else {
          formElements.push({
            tag: "input",
            name: `input_${key}`,
            placeholder: defaultValue || `请输入 ${key}`,
            default_value: defaultValue || "",
          });
        }
      }
    }

    // 添加触发按钮
    formElements.push({
      tag: "hr",
    });
    formElements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: "🚀 触发工作流" },
          type: "primary",
          value: JSON.stringify({ action: "trigger" }),
        },
      ],
    });

    return {
      header: {
        title: { tag: "plain_text", content: `🚀 ${data.repoFullName} - ${workflow.name}` },
        template: "blue",
      },
      elements: formElements,
    };
  },

  async onAction(state: CardState, action: Record<string, unknown>): Promise<StepTransition> {
    const data = state.data as WorkflowActionData;
    const formValue = action.form_value as Record<string, unknown> | undefined;

    if (!formValue) {
      throw new Error("表单数据为空");
    }

    const branch = formValue.branch as string | undefined;
    if (!branch) {
      throw new Error("请选择分支");
    }

    // 收集输入参数
    const inputs: Record<string, string> = {};
    const inputKeys = data.inputKeys || [];
    for (const key of inputKeys) {
      const value = formValue[`input_${key}`] as string | undefined;
      if (value) {
        inputs[key] = value;
      }
    }

    // 触发工作流
    const gitea = await createServiceGiteaClient();
    await gitea.dispatchWorkflow(
      data.owner!,
      data.repo!,
      data.selectedWorkflow!.path,
      branch,
      inputs,
    );

    return {
      nextStep: null, // 结束流程
      data: {
        selectedBranch: branch,
        formData: inputs,
      },
    };
  },
};

// ─── 创建并注册状态机 ─────────────────────────────────────────

const workflowActionMachine = new CardStateMachine({
  name: "workflow_action",
  initialStep: "select_workflow",
  steps: {
    select_workflow: selectWorkflowStep,
    fill_params: fillParamsStep,
  },
  async onComplete(state: CardState) {
    const data = state.data as WorkflowActionData;
    console.log(`[WorkflowAction] Triggered: ${data.repoFullName} - ${data.selectedWorkflow?.name}`);
  },
  async onError(_state: CardState, error: Error) {
    return {
      header: {
        title: { tag: "plain_text", content: "❌ 处理失败" },
        template: "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: error.message || "处理工作流时出错,请稍后重试",
          },
        },
      ],
    };
  },
});

registerStateMachine(workflowActionMachine, "workflow_action");

// ─── 导出启动函数 ─────────────────────────────────────────────

export async function startWorkflowAction(params: {
  messageId: string;
  openId: string;
  repoFullName: string;
}): Promise<FeishuInteractiveCard> {
  const parts = params.repoFullName.split("/");
  const owner = parts[0] || "";
  const repo = parts[1] || "";

  // 验证用户绑定
  const db = useDB();
  const [binding] = await db
    .select({ user_id: schema.userFeishu.user_id })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, params.openId))
    .limit(1);

  if (!binding?.user_id) {
    throw new Error("请先在 Teax 中绑定飞书账号");
  }

  // 验证仓库
  const [repoRecord] = await db
    .select({
      id: schema.repositories.id,
      full_name: schema.repositories.full_name,
      default_branch: schema.repositories.default_branch,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.full_name, params.repoFullName))
    .limit(1);

  if (!repoRecord) {
    throw new Error(`仓库 ${params.repoFullName} 未在 Teax 中注册`);
  }

  // 获取工作流列表
  const gitea = await createServiceGiteaClient();
  const workflowsResult = await gitea.getRepoWorkflows(owner, repo);
  const workflows = workflowsResult.workflows || [];

  if (workflows.length === 0) {
    throw new Error(`${params.repoFullName} 暂无可用工作流`);
  }

  // 启动状态机
  const { card } = await workflowActionMachine.start({
    messageId: params.messageId,
    openId: params.openId,
    userId: binding.user_id,
    initialData: {
      owner,
      repo,
      repoFullName: params.repoFullName,
      defaultBranch: repoRecord.default_branch,
      workflows: workflows.map((w) => ({ path: w.path, name: w.name })),
    },
  });

  return card;
}
