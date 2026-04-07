import type { PromptFn } from "./types";
import { validateRequired, validateArray } from "./types";
import type { ReviewIssue, ReviewRule, ReviewSpec, FileContentLine } from "../review-spec";

/**
 * 问题验证提示词上下文
 */
export interface IssueVerifyContext {
  issue: ReviewIssue;
  fileContent: FileContentLine[];
  ruleInfo: { rule: ReviewRule; spec: ReviewSpec } | null;
  specsSection?: string;
  [key: string]: unknown;
}

/**
 * 构建问题验证提示词
 */
export const buildIssueVerifyPrompt: PromptFn<IssueVerifyContext> = (ctx) => {
  // 验证必需的输入参数
  validateRequired(ctx.issue, "issue");
  validateArray(ctx.fileContent, "fileContent");

  const padWidth = String(ctx.fileContent.length).length;
  const linesWithNumbers = ctx.fileContent
    .map(([, line], index) => `${String(index + 1).padStart(padWidth)}| ${line}`)
    .join("\n");

  const systemPrompt = `你是一个代码审查专家。你的任务是判断之前发现的一个代码问题：
1. 是否有效（是否真的违反了规则）
2. 是否已经被修复

请仔细分析当前的代码内容。

## 输出要求
- valid: 布尔值，true 表示问题有效（代码确实违反了规则），false 表示问题无效（误报）
- fixed: 布尔值，true 表示问题已经被修复，false 表示问题仍然存在
- reason: 判断依据

## 判断标准

### valid 判断
- 根据规则 ID 和问题描述，判断代码是否真的违反了该规则
- 如果问题描述与实际代码不符，valid 为 false
- 如果规则不适用于该代码场景，valid 为 false

### fixed 判断
- 只有当问题所在的代码已被修改，且修改后的代码不再违反规则时，fixed 才为 true
- 如果问题所在的代码仍然存在且仍违反规则，fixed 必须为 false
- 如果代码行号发生变化但问题本质仍存在，fixed 必须为 false

## 重要提醒
- valid=false 时，fixed 的值无意义（无效问题无需修复）
- 请确保 valid 和 fixed 的值与 reason 的描述一致！`;

  // 构建规则定义部分
  let ruleSection = "";
  if (ctx.specsSection) {
    ruleSection = ctx.specsSection;
  } else if (ctx.ruleInfo) {
    const { spec, rule } = ctx.ruleInfo;
    ruleSection = `### ${spec.filename} (${spec.type})\n\n${spec.content.slice(0, 200)}...\n\n#### 规则\n- ${rule.id}: ${rule.title}\n  ${rule.description}`;
  }

  const userPrompt = `## 规则定义

${ruleSection}

## 之前发现的问题

- **文件**: ${ctx.issue.file}
- **行号**: ${ctx.issue.line}
- **规则**: ${ctx.issue.ruleId} (来自 ${ctx.issue.specFile})
- **问题描述**: ${ctx.issue.reason}
${ctx.issue.suggestion ? `- **原建议**: ${ctx.issue.suggestion}` : ""}

## 当前文件内容

\`\`\`
${linesWithNumbers}
\`\`\`

请判断这个问题是否有效，以及是否已经被修复。`;

  return { systemPrompt, userPrompt };
};
