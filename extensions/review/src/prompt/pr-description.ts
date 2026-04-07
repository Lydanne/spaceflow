import type { PromptFn } from "./types";
import { validateArray } from "./types";
import type { PullRequestCommit, ChangedFile } from "@spaceflow/core";
import type { FileContentsMap } from "../review-spec";

/**
 * 内存使用限制常量
 */
const MEMORY_LIMITS = {
  MAX_TOTAL_LENGTH: 8000, // 代码变更内容最大总长度
  MAX_FILES: 30, // 最大文件数量
  MAX_SNIPPET_LENGTH: 50, // 每个文件最大代码行数
  MAX_COMMITS: 10, // 最大 commit 数量（用于标题生成）
  MAX_FILES_FOR_TITLE: 20, // 标题生成时最大文件数量
} as const;

/**
 * PR 描述生成提示词
 */
export interface PrDescriptionContext {
  commits: PullRequestCommit[];
  changedFiles: ChangedFile[];
  fileContents?: FileContentsMap;
  [key: string]: unknown;
}

export const buildPrDescriptionPrompt: PromptFn<PrDescriptionContext> = (ctx) => {
  // 验证必需的输入参数
  validateArray(ctx.commits, "commits");
  validateArray(ctx.changedFiles, "changedFiles");

  const commitMessages = ctx.commits
    .map((c) => `- ${c.sha?.slice(0, 7)}: ${c.commit?.message?.split("\n")[0]}`)
    .join("\n");
  const fileChanges = ctx.changedFiles
    .slice(0, MEMORY_LIMITS.MAX_FILES)
    .map((f) => `- ${f.filename} (${f.status})`)
    .join("\n");

  // 构建代码变更内容（只包含变更行，优化内存使用）
  let codeChangesSection = "";
  if (ctx.fileContents && ctx.fileContents.size > 0) {
    const codeSnippets: string[] = [];
    let totalLength = 0;

    // 使用 Map.entries() 进行更高效的迭代
    for (const [filename, lines] of ctx.fileContents) {
      if (totalLength >= MEMORY_LIMITS.MAX_TOTAL_LENGTH) break;

      // 只提取有变更的行（commitHash 不是 "-------"）
      const changedLines = lines
        .map(([hash, code], idx) => (hash !== "-------" ? `${idx + 1}: ${code}` : null))
        .filter(Boolean);

      if (changedLines.length > 0) {
        // 限制每个文件的代码行数，避免单个文件占用过多内存
        const limitedLines = changedLines.slice(0, MEMORY_LIMITS.MAX_SNIPPET_LENGTH);
        const snippet = `### ${filename}\n\`\`\`\n${limitedLines.join("\n")}\n\`\`\``;

        // 检查添加此片段是否会超过内存限制
        if (totalLength + snippet.length <= MEMORY_LIMITS.MAX_TOTAL_LENGTH) {
          codeSnippets.push(snippet);
          totalLength += snippet.length;
        } else {
          // 如果添加当前片段会超过限制，尝试截断它
          const remainingLength = MEMORY_LIMITS.MAX_TOTAL_LENGTH - totalLength;
          if (remainingLength > 100) {
            // 至少保留 100 字符的片段
            // snippet 格式为 "### filename\n```\ncode\n```"
            // 截断时去掉结尾的 ``` 再追加，避免双重代码块
            const closingTag = "\n```";
            const contentEnd = snippet.lastIndexOf(closingTag);
            const truncateAt = Math.max(
              0,
              contentEnd > 0 ? Math.min(remainingLength - 20, contentEnd) : remainingLength - 20,
            );
            const truncatedSnippet = snippet.substring(0, truncateAt) + "\n..." + closingTag;
            codeSnippets.push(truncatedSnippet);
            break;
          }
          break;
        }
      }
    }

    if (codeSnippets.length > 0) {
      codeChangesSection = `\n\n## 代码变更内容\n${codeSnippets.join("\n\n")}`;
    }
  }

  return {
    systemPrompt: "",
    userPrompt: `请根据以下 PR 的 commit 记录、文件变更和代码内容，用简洁的中文总结这个 PR 实现了什么功能。
要求：
1. 第一行输出 PR 标题，格式必须是: Feat xxx 或 Fix xxx 或 Refactor xxx（根据变更类型选择，整体不超过 50 个字符）
2. 空一行后输出详细描述
3. 描述应该简明扼要，突出核心功能点
4. 使用 Markdown 格式
5. 不要逐条列出 commit，而是归纳总结
6. 重点分析代码变更的实际功能

## Commit 记录 (${ctx.commits.length} 个)
${commitMessages || "无"}

## 文件变更 (${ctx.changedFiles.length} 个文件)
${fileChanges || "无"}${ctx.changedFiles.length > MEMORY_LIMITS.MAX_FILES ? `\n... 等 ${ctx.changedFiles.length - MEMORY_LIMITS.MAX_FILES} 个文件` : ""}${codeChangesSection}`,
  };
};

/**
 * PR 标题生成提示词
 */
export interface PrTitleContext {
  commits: PullRequestCommit[];
  changedFiles: ChangedFile[];
  [key: string]: unknown;
}

export const buildPrTitlePrompt: PromptFn<PrTitleContext> = (ctx) => {
  // 验证必需的输入参数
  validateArray(ctx.commits, "commits");
  validateArray(ctx.changedFiles, "changedFiles");

  const commitMessages = ctx.commits
    .slice(0, MEMORY_LIMITS.MAX_COMMITS)
    .map((c) => c.commit?.message?.split("\n")[0])
    .filter(Boolean)
    .join("\n");
  const fileChanges = ctx.changedFiles
    .slice(0, MEMORY_LIMITS.MAX_FILES_FOR_TITLE)
    .map((f) => `${f.filename} (${f.status})`)
    .join("\n");

  return {
    systemPrompt: "",
    userPrompt: `请根据以下 commit 记录和文件变更，生成一个简短的 PR 标题。
要求：
1. 格式必须是: Feat: xxx 或 Fix: xxx 或 Refactor: xxx
2. 根据变更内容选择合适的前缀（新功能用 Feat，修复用 Fix，重构用 Refactor）
3. xxx 部分用简短的中文描述（整体不超过 50 个字符）
4. 只输出标题，不要加任何解释

Commit 记录:
${commitMessages || "无"}

文件变更:
${fileChanges || "无"}`,
  };
};
