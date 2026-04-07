import {
  PullRequestCommit,
  ChangedFile,
  type LLMMode,
  LlmProxyService,
  logStreamEvent,
  createStreamLoggerState,
  shouldLog,
  type VerboseLevel,
  type LlmJsonPutSchema,
  LlmJsonPut,
  parallel,
} from "@spaceflow/core";
import {
  ReviewSpecService,
  ReviewSpec,
  ReviewIssue,
  ReviewResult,
  FileSummary,
  FileContentsMap,
} from "./review-spec";
import { readdir } from "fs/promises";
import { dirname, extname } from "path";
import micromatch from "micromatch";
import type { FileReviewPrompt, ReviewPrompt, LLMReviewOptions } from "./types/review-llm";
import { buildLinesWithNumbers, buildCommitsSection, extractCodeBlocks } from "./utils/review-llm";
import { extractCodeBlockTypes } from "./review-includes-filter";

export type { FileReviewPrompt, ReviewPrompt, LLMReviewOptions } from "./types/review-llm";

const REVIEW_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string", description: "发生问题的文件路径" },
          line: {
            type: "string",
            description:
              "问题所在的行号，只支持单行或多行 (如 123 或 123-125)，不允许使用 `,` 分隔多个行号",
          },
          ruleId: { type: "string", description: "违反的规则 ID（如 JsTs.FileName.UpperCamel）" },
          specFile: {
            type: "string",
            description: "规则来源的规范文件名（如 js&ts.file-name.md）",
          },
          reason: { type: "string", description: "问题的简要概括" },
          suggestion: {
            type: "string",
            description:
              "修改后的完整代码片段。要求以代码为主体，并在代码中使用详细的中文注释解释逻辑改进点。不要包含 Markdown 反引号。",
          },
          commit: { type: "string", description: "相关的 7 位 commit SHA" },
          severity: {
            type: "string",
            description: "问题严重程度，根据规则文档中的 severity 标记确定",
            enum: ["error", "warn"],
          },
        },
        required: ["file", "line", "ruleId", "specFile", "reason"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "本次代码审查的整体总结" },
  },
  required: ["issues", "summary"],
  additionalProperties: false,
};

export class ReviewLlmProcessor {
  readonly llmJsonPut: LlmJsonPut<ReviewResult>;

  constructor(
    protected readonly llmProxyService: LlmProxyService,
    protected readonly reviewSpecService: ReviewSpecService,
  ) {
    this.llmJsonPut = new LlmJsonPut(REVIEW_SCHEMA, {
      llmRequest: async (prompt) => {
        const response = await this.llmProxyService.chat(
          [
            { role: "system", content: prompt.systemPrompt },
            { role: "user", content: prompt.userPrompt },
          ],
          { adapter: "openai" },
        );
        if (!response.content) {
          throw new Error("LLM 返回了空内容");
        }
        return response.content;
      },
    });
  }

  /**
   * 根据文件过滤 specs，只返回与该文件匹配的规则
   * - 如果 spec 有 includes 配置，只有当文件名匹配 includes 模式时才包含该 spec
   * - 如果 spec 没有 includes 配置，则按扩展名匹配
   */
  filterSpecsForFile(specs: ReviewSpec[], filename: string): ReviewSpec[] {
    const ext = extname(filename).slice(1).toLowerCase();
    if (!ext) return [];

    return specs.filter((spec) => {
      // 先检查扩展名是否匹配
      if (!spec.extensions.includes(ext)) {
        return false;
      }

      // 如果有 includes 配置，检查文件名是否匹配 includes 模式
      if (spec.includes.length > 0) {
        return micromatch.isMatch(filename, spec.includes, { matchBase: true });
      }

      // 没有 includes 配置，扩展名匹配即可
      return true;
    });
  }

  /**
   * 构建 systemPrompt
   */
  buildSystemPrompt(specsSection: string): string {
    return `你是一个专业的代码审查专家，负责根据团队的编码规范对代码进行严格审查。

## 审查规范

${specsSection}

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
  }

  async buildReviewPrompt(
    specs: ReviewSpec[],
    changedFiles: ChangedFile[],
    fileContents: FileContentsMap,
    commits: PullRequestCommit[],
    existingResult?: ReviewResult | null,
  ): Promise<ReviewPrompt> {
    const fileDataList = changedFiles
      .filter((f) => f.status !== "deleted" && f.filename)
      .map((file) => {
        const filename = file.filename!;
        const contentLines = fileContents.get(filename);
        if (!contentLines) {
          return { filename, file, contentLines: null, commitsSection: "- 无相关 commits" };
        }
        const commitsSection = buildCommitsSection(contentLines, commits);
        return { filename, file, contentLines, commitsSection };
      });

    const filePrompts: FileReviewPrompt[] = await Promise.all(
      fileDataList.map(async ({ filename, file, contentLines, commitsSection }) => {
        const fileDirectoryInfo = await this.getFileDirectoryInfo(filename);

        // 根据文件过滤 specs，只注入与当前文件匹配的规则
        const fileSpecs = this.filterSpecsForFile(specs, filename);

        // 收集该文件对应 specs 的 code-* 过滤类型
        const allSpecIncludes = fileSpecs.flatMap((s) => s.includes);
        const codeBlockTypes = extractCodeBlockTypes(allSpecIncludes);

        // 构建带行号的内容：有 code-* 过滤时只输出匹配的代码块范围
        let linesWithNumbers: string;
        if (!contentLines) {
          linesWithNumbers = "(无法获取内容)";
        } else if (codeBlockTypes.length > 0) {
          const visibleRanges = extractCodeBlocks(contentLines, codeBlockTypes);
          linesWithNumbers = buildLinesWithNumbers(contentLines, visibleRanges);
        } else {
          linesWithNumbers = buildLinesWithNumbers(contentLines);
        }

        // 获取该文件上一次的审查结果
        const existingFileSummary = existingResult?.summary?.find((s) => s.file === filename);
        const existingFileIssues = existingResult?.issues?.filter((i) => i.file === filename) ?? [];

        let previousReviewSection = "";
        if (existingFileSummary || existingFileIssues.length > 0) {
          const parts: string[] = [];
          if (existingFileSummary?.summary) {
            parts.push(`**总结**:\n`);
            parts.push(`${existingFileSummary.summary}\n`);
          }
          if (existingFileIssues.length > 0) {
            parts.push(`**已发现的问题** (${existingFileIssues.length} 个):\n`);
            for (const issue of existingFileIssues) {
              const status = issue.fixed
                ? "✅ 已修复"
                : issue.valid === "false"
                  ? "❌ 无效"
                  : "⚠️ 待处理";
              parts.push(`- [${status}] 行 ${issue.line}: ${issue.reason} (规则: ${issue.ruleId})`);
            }
            parts.push("");
            // parts.push("请注意：不要重复报告上述已发现的问题，除非代码有新的变更导致问题复现。\n");
          }
          previousReviewSection = parts.join("\n");
        }

        const userPrompt = `## ${filename} (${file.status})

### 文件内容

\`\`\`
${linesWithNumbers}
\`\`\`

### 该文件的相关 Commits

${commitsSection}

### 该文件所在的目录树

${fileDirectoryInfo}

### 上一次审查结果

${previousReviewSection}`;

        const specsSection = this.reviewSpecService.buildSpecsSection(fileSpecs);
        const systemPrompt = this.buildSystemPrompt(specsSection);

        return { filename, systemPrompt, userPrompt };
      }),
    );

    return { filePrompts };
  }

  async runLLMReview(
    llmMode: LLMMode,
    reviewPrompt: ReviewPrompt,
    options: LLMReviewOptions = {},
  ): Promise<ReviewResult> {
    console.log(`🤖 调用 ${llmMode} 进行代码审查...`);

    try {
      const result = await this.callLLM(llmMode, reviewPrompt, options);
      if (!result) {
        throw new Error("AI 未返回有效结果");
      }
      return {
        success: true,
        description: "", // 由 execute 方法填充
        issues: result.issues || [],
        summary: result.summary || [],
        round: 1, // 由 execute 方法根据 existingResult 更新
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error("LLM 调用失败:", error.message);
        if (error.stack) {
          console.error("堆栈信息:\n" + error.stack);
        }
      } else {
        console.error("LLM 调用失败:", error);
      }
      return {
        success: false,
        description: "",
        issues: [],
        summary: [],
        round: 1,
      };
    }
  }

  async getFileDirectoryInfo(filename: string): Promise<string> {
    const dir = dirname(filename);
    const currentFileName = filename.split("/").pop();

    if (dir === "." || dir === "") {
      return "（根目录）";
    }

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      const sortedEntries = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const lines: string[] = [`📁 ${dir}/`];

      for (let i = 0; i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const isCurrent = entry.name === currentFileName;
        const branch = isLast ? "└── " : "├── ";
        const icon = entry.isDirectory() ? "📂" : "📄";
        const marker = isCurrent ? " ← 当前文件" : "";

        lines.push(`${branch}${icon} ${entry.name}${marker}`);
      }

      return lines.join("\n");
    } catch {
      return `📁 ${dir}/`;
    }
  }

  async callLLM(
    llmMode: LLMMode,
    reviewPrompt: ReviewPrompt,
    options: LLMReviewOptions = {},
  ): Promise<{ issues: ReviewIssue[]; summary: FileSummary[] } | null> {
    const { verbose, concurrency = 5, timeout, retries = 0, retryDelay = 1000 } = options;
    const fileCount = reviewPrompt.filePrompts.length;
    console.log(
      `📂 开始并行审查 ${fileCount} 个文件 (并发: ${concurrency}, 重试: ${retries}, 超时: ${timeout ?? "无"}ms)`,
    );

    const executor = parallel({
      concurrency,
      timeout,
      retries,
      retryDelay,
      stopOnError: retries > 0,
      onTaskStart: (taskId) => {
        console.log(`🚀 开始审查: ${taskId}`);
      },
      onTaskComplete: (taskId, success) => {
        console.log(`${success ? "✅" : "❌"} 完成审查: ${taskId}`);
      },
      onRetry: (taskId, attempt, error) => {
        console.log(`🔄 重试 ${taskId} (第 ${attempt} 次): ${error.message}`);
      },
    });

    const results = await executor.map(
      reviewPrompt.filePrompts,
      (filePrompt) => this.reviewSingleFile(llmMode, filePrompt, verbose),
      (filePrompt) => filePrompt.filename,
    );

    const allIssues: ReviewIssue[] = [];
    const fileSummaries: FileSummary[] = [];

    for (const result of results) {
      if (result.success && result.result) {
        allIssues.push(...result.result.issues);
        fileSummaries.push(result.result.summary);
      } else {
        fileSummaries.push({
          file: result.id,
          resolved: 0,
          unresolved: 0,
          summary: `❌ 审查失败: ${result.error?.message ?? "未知错误"}`,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`🔍 审查完成: ${successCount}/${fileCount} 个文件成功`);

    return {
      issues: this.normalizeIssues(allIssues),
      summary: fileSummaries,
    };
  }

  async reviewSingleFile(
    llmMode: LLMMode,
    filePrompt: FileReviewPrompt,
    verbose?: VerboseLevel,
  ): Promise<{ issues: ReviewIssue[]; summary: FileSummary }> {
    if (shouldLog(verbose, 3)) {
      console.log(
        `\nsystemPrompt:\n----------------\n${filePrompt.systemPrompt}\n----------------`,
      );
      console.log(`\nuserPrompt:\n----------------\n${filePrompt.userPrompt}\n----------------`);
    }

    const stream = this.llmProxyService.chatStream(
      [
        { role: "system", content: filePrompt.systemPrompt },
        { role: "user", content: filePrompt.userPrompt },
      ],
      {
        adapter: llmMode,
        jsonSchema: this.llmJsonPut,
        verbose,
        allowedTools: [
          "Read",
          "Glob",
          "Grep",
          "WebSearch",
          "TodoWrite",
          "TodoRead",
          "Task",
          "Skill",
        ],
      },
    );

    const streamLoggerState = createStreamLoggerState();
    let fileResult: { issues?: ReviewIssue[]; summary?: string } | undefined;

    for await (const event of stream) {
      if (shouldLog(verbose, 2)) {
        logStreamEvent(event, streamLoggerState);
      }

      if (event.type === "result") {
        fileResult = event.response.structuredOutput as
          | { issues?: ReviewIssue[]; summary?: string }
          | undefined;
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    // 在获取到问题时立即记录发现时间
    const now = new Date().toISOString();
    const issues = (fileResult?.issues ?? []).map((issue) => ({
      ...issue,
      date: issue.date ?? now,
    }));

    return {
      issues,
      summary: {
        file: filePrompt.filename,
        resolved: 0,
        unresolved: 0,
        summary: fileResult?.summary ?? "",
      },
    };
  }

  /**
   * 规范化 issues，拆分包含逗号的行号为多个独立 issue，并添加发现时间
   * 例如 "114, 122" 会被拆分成两个 issue，分别是 "114" 和 "122"
   */
  normalizeIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const now = new Date().toISOString();
    return issues.flatMap((issue) => {
      // 确保 line 是字符串（LLM 可能返回数字）
      const lineStr = String(issue.line ?? "");
      const baseIssue = { ...issue, line: lineStr, date: issue.date ?? now };

      if (!lineStr.includes(",")) {
        return baseIssue;
      }

      const lines = lineStr.split(",");

      return lines.map((linePart, index) => ({
        ...baseIssue,
        line: linePart.trim(),
        suggestion: index === 0 ? issue.suggestion : `参考 ${issue.file}:${lines[0]}`,
      }));
    });
  }

  /**
   * 使用 AI 根据 commits、变更文件和代码内容总结 PR 实现的功能
   * @returns 包含 title 和 description 的对象
   */
  async generatePrDescription(
    commits: PullRequestCommit[],
    changedFiles: ChangedFile[],
    llmMode: LLMMode,
    fileContents?: FileContentsMap,
    verbose?: VerboseLevel,
  ): Promise<{ title: string; description: string }> {
    const commitMessages = commits
      .map((c) => `- ${c.sha?.slice(0, 7)}: ${c.commit?.message?.split("\n")[0]}`)
      .join("\n");
    const fileChanges = changedFiles
      .slice(0, 30)
      .map((f) => `- ${f.filename} (${f.status})`)
      .join("\n");
    // 构建代码变更内容（只包含变更行，限制总长度）
    let codeChangesSection = "";
    if (fileContents && fileContents.size > 0) {
      const codeSnippets: string[] = [];
      let totalLength = 0;
      const maxTotalLength = 8000; // 限制代码总长度
      for (const [filename, lines] of fileContents) {
        if (totalLength >= maxTotalLength) break;
        // 只提取有变更的行（commitHash 不是 "-------"）
        const changedLines = lines
          .map(([hash, code], idx) => (hash !== "-------" ? `${idx + 1}: ${code}` : null))
          .filter(Boolean);
        if (changedLines.length > 0) {
          const snippet = `### ${filename}\n\`\`\`\n${changedLines.slice(0, 50).join("\n")}\n\`\`\``;
          if (totalLength + snippet.length <= maxTotalLength) {
            codeSnippets.push(snippet);
            totalLength += snippet.length;
          }
        }
      }
      if (codeSnippets.length > 0) {
        codeChangesSection = `\n\n## 代码变更内容\n${codeSnippets.join("\n\n")}`;
      }
    }
    const prompt = `请根据以下 PR 的 commit 记录、文件变更和代码内容，用简洁的中文总结这个 PR 实现了什么功能。
要求：
1. 第一行输出 PR 标题，格式必须是: Feat xxx 或 Fix xxx 或 Refactor xxx（根据变更类型选择，整体不超过 50 个字符）
2. 空一行后输出详细描述
3. 描述应该简明扼要，突出核心功能点
4. 使用 Markdown 格式
5. 不要逐条列出 commit，而是归纳总结
6. 重点分析代码变更的实际功能

## Commit 记录 (${commits.length} 个)
${commitMessages || "无"}

## 文件变更 (${changedFiles.length} 个文件)
${fileChanges || "无"}
${changedFiles.length > 30 ? `\n... 等 ${changedFiles.length - 30} 个文件` : ""}${codeChangesSection}`;
    try {
      const stream = this.llmProxyService.chatStream([{ role: "user", content: prompt }], {
        adapter: llmMode,
      });
      let content = "";
      for await (const event of stream) {
        if (event.type === "text") {
          content += event.content;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      // 解析标题和描述：第一行是标题，其余是描述
      const lines = content.trim().split("\n");
      const title = lines[0]?.replace(/^#+\s*/, "").trim() || "PR 更新";
      const description = lines.slice(1).join("\n").trim();
      return { title, description };
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn("⚠️ AI 总结 PR 功能失败，使用默认描述:", error);
      }
      return this.buildBasicDescription(commits, changedFiles);
    }
  }

  /**
   * 使用 LLM 生成 PR 标题
   */
  async generatePrTitle(
    commits: PullRequestCommit[],
    changedFiles: ChangedFile[],
  ): Promise<string> {
    const commitMessages = commits
      .slice(0, 10)
      .map((c) => c.commit?.message?.split("\n")[0])
      .filter(Boolean)
      .join("\n");
    const fileChanges = changedFiles
      .slice(0, 20)
      .map((f) => `${f.filename} (${f.status})`)
      .join("\n");
    const prompt = `请根据以下 commit 记录和文件变更，生成一个简短的 PR 标题。
要求：
1. 格式必须是: Feat: xxx 或 Fix: xxx 或 Refactor: xxx
2. 根据变更内容选择合适的前缀（新功能用 Feat，修复用 Fix，重构用 Refactor）
3. xxx 部分用简短的中文描述（整体不超过 50 个字符）
4. 只输出标题，不要加任何解释

Commit 记录:
${commitMessages || "无"}

文件变更:
${fileChanges || "无"}`;
    try {
      const stream = this.llmProxyService.chatStream([{ role: "user", content: prompt }], {
        adapter: "openai",
      });
      let title = "";
      for await (const event of stream) {
        if (event.type === "text") {
          title += event.content;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      return title.trim().slice(0, 50) || this.getFallbackTitle(commits);
    } catch {
      return this.getFallbackTitle(commits);
    }
  }

  /**
   * 获取降级标题（从第一个 commit 消息）
   */
  getFallbackTitle(commits: PullRequestCommit[]): string {
    const firstCommitMsg = commits[0]?.commit?.message?.split("\n")[0] || "PR 更新";
    return firstCommitMsg.slice(0, 50);
  }

  /**
   * 构建基础描述（不做完整的 AI 功能总结，但仍用 LLM 辅助生成标题）
   */
  async buildBasicDescription(
    commits: PullRequestCommit[],
    changedFiles: ChangedFile[],
  ): Promise<{ title: string; description: string }> {
    const parts: string[] = [];
    // 使用 LLM 生成标题
    const title = await this.generatePrTitle(commits, changedFiles);
    if (commits.length > 0) {
      const messages = commits
        .slice(0, 5)
        .map((c) => `- ${c.commit?.message?.split("\n")[0]}`)
        .filter(Boolean);
      if (messages.length > 0) {
        parts.push(`**提交记录**: ${messages.join("; ")}`);
      }
    }
    if (changedFiles.length > 0) {
      const added = changedFiles.filter((f) => f.status === "added").length;
      const modified = changedFiles.filter((f) => f.status === "modified").length;
      const deleted = changedFiles.filter((f) => f.status === "deleted").length;
      const stats: string[] = [];
      if (added > 0) stats.push(`新增 ${added}`);
      if (modified > 0) stats.push(`修改 ${modified}`);
      if (deleted > 0) stats.push(`删除 ${deleted}`);
      parts.push(`**文件变更**: ${changedFiles.length} 个文件 (${stats.join(", ")})`);
    }
    return { title, description: parts.join("\n") };
  }
}
