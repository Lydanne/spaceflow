import type { PromptFn } from "./types";
import { validateNonEmptyString, validateRequired } from "./types";

/**
 * 代码审查公共系统提示词基础
 */
const CODE_REVIEW_BASE_SYSTEM_PROMPT = `你是一个专业的代码审查专家，负责根据团队的编码规范对代码进行严格审查。

## 审查要求

1. **严格遵循规范**：只按照上述审查规范进行审查，不要添加规范之外的要求
2. **精准定位问题**：每个问题必须指明具体的行号，行号从文件内容中的 "行号|" 格式获取
3. **避免重复报告**：如果提示词中包含"上一次审查结果"，请不要重复报告已存在的问题
4. **提供可行建议**：对于每个问题，提供具体的修改建议代码

## 注意事项

- 变更文件内容已在上下文中提供，无需调用读取工具
- 你可以读取项目中的其他文件以了解上下文
- 不要调用编辑工具修改文件，你的职责是审查而非修改
- 文件内容格式为 "CommitHash 行号| 代码"，输出的 line 字段应对应原始行号

## 输出要求

- 发现问题时：在 issues 数组中列出所有问题，每个问题包含 file、line、ruleId、specFile、reason、suggestion、severity
- 无论是否发现问题：都必须在 summary 中提供该文件的审查总结，简要说明审查结果`;

/**
 * 代码审查 - 系统提示词构建
 */
export interface CodeReviewSystemContext {
  specsSection: string;
  [key: string]: unknown;
}

export const buildCodeReviewSystemPrompt: PromptFn<CodeReviewSystemContext> = (ctx) => {
  validateNonEmptyString(ctx.specsSection, "specsSection");
  return {
    systemPrompt: `${CODE_REVIEW_BASE_SYSTEM_PROMPT}

## 审查规范

${ctx.specsSection}`,
    userPrompt: "",
  };
};

/**
 * 代码审查 - 单文件审查提示词
 */
export interface FileReviewContext {
  filename: string;
  status: string;
  linesWithNumbers: string;
  commitsSection: string;
  fileDirectoryInfo: string;
  previousReviewSection: string;
  specsSection: string;
  [key: string]: unknown;
}

export const buildFileReviewPrompt: PromptFn<FileReviewContext> = (ctx) => {
  // 验证必需的输入参数
  validateNonEmptyString(ctx.filename, "filename");
  validateNonEmptyString(ctx.status, "status");
  validateNonEmptyString(ctx.linesWithNumbers, "linesWithNumbers");
  validateRequired(ctx.specsSection, "specsSection");

  return {
    systemPrompt: `${CODE_REVIEW_BASE_SYSTEM_PROMPT}

## 审查规范

${ctx.specsSection}`,
    userPrompt: `## ${ctx.filename} (${ctx.status})

### 文件内容

\`\`\`
${ctx.linesWithNumbers}
\`\`\`

### 该文件的相关 Commits

${ctx.commitsSection}

### 该文件所在的目录树

${ctx.fileDirectoryInfo}

### 上一次审查结果

${ctx.previousReviewSection}`,
  };
};
