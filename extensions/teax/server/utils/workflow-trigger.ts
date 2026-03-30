import type { GiteaService } from "./gitea";
import { EnhancedCardBuilder } from "../card-kit/builder";
import type { CardJSON, EnhancedCardBuilderInterface } from "../card-kit/types";
import {
  parseWorkflowYaml,
  extractInputs,
  type WorkflowInputDef,
} from "./workflow-yaml";
import {
  DEFAULT_VERBOSE_LEVEL,
  parseVerboseLevel,
  VERBOSE_FORM_FIELD,
  type VerboseLevel,
} from "./verbose";

// ─── dispatch + poll ──────────────────────────

export interface DispatchAndPollOptions {
  owner: string;
  repo: string;
  workflowFileName: string;
  branch: string;
  inputs?: Record<string, string | number | boolean>;
}

export interface DispatchAndPollResult {
  runId: number | null;
  runNumber: number | null;
}

/**
 * 触发工作流并轮询等待新的 Run 出现。
 * @returns `{ runId, runNumber }` — 如果轮询到新 Run，runId 非 null；否则为 null（表示已提交但未检测到）。
 * @throws dispatch 失败时抛出原始错误。
 */
export async function dispatchAndPoll(
  gitea: GiteaService,
  opts: DispatchAndPollOptions,
): Promise<DispatchAndPollResult> {
  const { owner, repo, workflowFileName, branch, inputs } = opts;

  // 记录当前最新 run id（用于轮询比较）
  let latestRunId = 0;
  try {
    const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
    const latestRun = runs.workflow_runs?.find((run) =>
      run.path?.includes(workflowFileName),
    );
    if (latestRun) {
      latestRunId = latestRun.id;
    }
  } catch {
    // Ignore
  }

  // Dispatch
  await gitea.dispatchWorkflow(owner, repo, workflowFileName, branch, inputs);

  // Poll for new run
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 5);
      const newRun = runs.workflow_runs?.find((run) => {
        return run.path?.includes(workflowFileName) && run.id > latestRunId;
      });
      if (newRun) {
        return { runId: newRun.id, runNumber: newRun.run_number };
      }
    } catch {
      // Continue polling
    }
  }

  return { runId: null, runNumber: null };
}

// ─── 错误卡片 ──────────────────────────

/**
 * 从 dispatch 错误中提取信息并构建失败卡片。
 */
export function buildDispatchErrorCard(err: unknown): CardJSON {
  const errObj = err as { data?: { message?: string }; message?: string };
  const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
  return new EnhancedCardBuilder({ title: "❌ 触发失败", theme: "red" }, "")
    .text(msg, true)
    .build();
}

// ─── 结果卡片 ──────────────────────────

export interface TriggerResultCardOptions {
  repoFullName: string;
  branch: string;
  workflowPath: string;
  runId: number | null;
  runNumber: number | null;
  /** 本次运行参数（可选） */
  runInputs?: Record<string, unknown>;
  /** 追加到结果卡片末尾的额外行 */
  extraLines?: string[];
}

/**
 * 构建触发结果卡片。
 */
export function buildTriggerResultCard(
  opts: TriggerResultCardOptions,
): CardJSON {
  const { repoFullName, branch, workflowPath, runId, runNumber, runInputs, extraLines }
    = opts;
  const config = useRuntimeConfig();
  const baseUrl = config.public.appUrl as string;

  const resultCard = new EnhancedCardBuilder(
    {
      title: runId ? "✅ 工作流已触发" : "⚠️ 工作流已提交",
      theme: runId ? "green" : "orange",
    },
    "",
  );

  const lines = [
    `**仓库**: ${repoFullName}`,
    `**分支**: ${branch}`,
    `**工作流**: ${workflowPath}`,
  ];

  const inputEntries = Object.entries(runInputs || {});
  if (inputEntries.length > 0) {
    lines.push("**运行参数**:");
    for (const [key, value] of inputEntries) {
      const displayValue = typeof value === "string"
        ? value
        : JSON.stringify(value);
      lines.push(`- ${key}: \`${displayValue}\``);
    }
    lines.push(""); // 参数列表后空一行
  }

  if (runId) {
    lines.push(`**运行编号**: #${runNumber}`);
    lines.push(
      `[查看运行详情](${baseUrl}/${repoFullName}/actions/runs/${runId})`,
    );
  }

  if (extraLines?.length) {
    lines.push(...extraLines);
  }

  resultCard.text(lines.join("\n"), true);
  return resultCard.build();
}

// ─── 工作流表单数据获取 ──────────────────────────

export interface WorkflowFormData {
  /** 排序后的分支列表（默认分支在前） */
  branches: Array<{ label: string; value: string }>;
  /** 默认分支 */
  defaultBranch: string;
  /** 工作流 input 定义（null 表示获取失败） */
  inputDefs: Record<string, WorkflowInputDef> | null;
}

export interface FetchWorkflowFormDataOptions {
  owner: string;
  repo: string;
  workflowPath: string;
  /** 覆盖默认分支（如 preset 指定的分支） */
  defaultBranch?: string;
}

/**
 * 获取工作流表单所需的数据：分支列表 + workflow input 定义。
 * 分支列表自动排序（默认分支在前）。
 */
export async function fetchWorkflowFormData(
  gitea: GiteaService,
  opts: FetchWorkflowFormDataOptions,
): Promise<WorkflowFormData> {
  const { owner, repo, workflowPath } = opts;

  // 获取分支列表 + 默认分支
  let branches: Array<{ label: string; value: string }> = [];
  let defaultBranch = opts.defaultBranch || "main";
  try {
    const branchList = await gitea.getRepoBranches(owner, repo);
    branches = branchList.map((b) => ({ label: b.name, value: b.name }));
    if (!opts.defaultBranch) {
      const repoInfo = await gitea.getRepo(owner, repo);
      defaultBranch = repoInfo.default_branch || "main";
    }
  } catch (err) {
    console.warn("[workflow-trigger] Failed to fetch branches:", err);
    branches = [{ label: defaultBranch, value: defaultBranch }];
  }

  // 排序：默认分支在前
  const defaultFirst = branches.find((b) => b.value === defaultBranch);
  const rest = branches.filter((b) => b.value !== defaultBranch);
  const sortedBranches = defaultFirst ? [defaultFirst, ...rest] : branches;

  // 解析 workflow inputs
  let inputDefs: Record<string, WorkflowInputDef> | null = null;
  try {
    const content = await gitea.getFileContent(
      owner,
      repo,
      workflowPath,
      defaultBranch,
    );
    if (content) {
      const doc = parseWorkflowYaml(content);
      if (doc) {
        inputDefs = extractInputs(doc);
      }
    }
  } catch (err) {
    console.warn("[workflow-trigger] Failed to parse workflow:", err);
  }

  return { branches: sortedBranches, defaultBranch, inputDefs };
}

// ─── 工作流表单渲染 ──────────────────────────

export interface RenderWorkflowFormOptions {
  /** 表单名称 */
  formName: string;
  /** 提交按钮文案（默认 "🚀 触发工作流"） */
  submitText?: string;
  /** 是否禁用分支选择 */
  disableBranch?: boolean;
  /** 分支禁用提示文案 */
  disableBranchReason?: string;
  /** 锁定的 input key 集合（渲染为 disabled 只读控件） */
  lockedInputs?: Set<string>;
  /** 锁定参数的预设值 */
  lockedValues?: Record<string, unknown>;
  /** 参数初始值（优先于 workflow 默认值） */
  initialValues?: Record<string, unknown>;
  /** 是否显示 verbose 选择器（0/1/2） */
  showVerboseSelect?: boolean;
  /** verbose 字段名，默认 VERBOSE_FORM_FIELD */
  verboseName?: string;
  /** verbose 默认值，默认 1 */
  verboseDefault?: VerboseLevel;
}

/**
 * 在 card builder 上渲染工作流触发表单：分支选择 + workflow inputs + 提交按钮。
 * 锁定的参数会渲染为 disabled 只读控件（带 🔒 提示）。
 */
export function renderWorkflowForm(
  card: EnhancedCardBuilderInterface,
  data: WorkflowFormData,
  opts: RenderWorkflowFormOptions,
): void {
  card.form(opts.formName);

  // 分支选择
  if (data.branches.length > 0) {
    card.select({
      name: "branch",
      label: "分支",
      placeholder: "选择分支",
      required: true,
      disabled: opts.disableBranch
        ? opts.disableBranchReason || "🔒 当前不可修改分支"
        : undefined,
      options: data.branches,
      initial_option: data.defaultBranch,
    });
  }

  // Workflow inputs
  if (data.inputDefs) {
    for (const [key, def] of Object.entries(data.inputDefs)) {
      const label = def.description || key;
      const isLocked = opts.lockedInputs?.has(key);
      const lockedValue = isLocked
        ? String(opts.lockedValues?.[key] ?? def.default ?? "")
        : undefined;
      const initialValue = opts.initialValues?.[key];

      if (def.type === "choice" && def.options?.length) {
        const defaultValue = isLocked
          ? lockedValue
          : initialValue != null
            ? String(initialValue)
            : def.default != null
              ? String(def.default)
              : undefined;
        const optionValues = def.options.map((o) => String(o));
        if (defaultValue && !optionValues.includes(defaultValue)) {
          optionValues.unshift(defaultValue);
        }
        card.select({
          name: key,
          label,
          placeholder: `选择 ${key}`,
          required: def.required || false,
          disabled: isLocked ? "🔒 该参数已锁定" : undefined,
          options: optionValues.map((o) => ({ label: o, value: o })),
          initial_option: defaultValue,
        });
      } else if (def.type === "boolean") {
        const boolDefault = isLocked
          ? lockedValue
          : initialValue != null
            ? String(initialValue)
            : def.default != null
              ? def.default
                ? "true"
                : "false"
              : undefined;
        card.select({
          name: key,
          label,
          placeholder: `选择 ${key}`,
          required: def.required || false,
          disabled: isLocked ? "🔒 该参数已锁定" : undefined,
          options: [
            { label: "是", value: "true" },
            { label: "否", value: "false" },
          ],
          initial_option: boolDefault,
        });
      } else {
        card.inputV2({
          name: key,
          label,
          placeholder: def.default ? String(def.default) : `输入 ${key}`,
          required: isLocked ? false : def.required || false,
          default_value: isLocked
            ? lockedValue
            : initialValue != null
              ? String(initialValue)
              : def.default
                ? String(def.default)
                : undefined,
          disabled: isLocked ? "🔒 该参数已锁定" : undefined,
        });
      }
    }
  }

  if (opts.showVerboseSelect) {
    const verboseFieldName = opts.verboseName || VERBOSE_FORM_FIELD;
    const verboseDefault = String(parseVerboseLevel(opts.verboseDefault, DEFAULT_VERBOSE_LEVEL));
    card.select({
      name: verboseFieldName,
      label: "日志级别",
      placeholder: "选择日志级别",
      required: false,
      options: [
        { label: "0 - 静默", value: "0" },
        { label: "1 - 标准", value: "1" },
        { label: "2 - 调试", value: "2" },
      ],
      initial_option: verboseDefault,
    });
  }

  card.formButtons({
    submit: { text: opts.submitText || "🚀 触发工作流", type: "primary" },
  });
  card.endForm();
}
