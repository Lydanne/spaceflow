import {
  LlmProxyService,
  logStreamEvent,
  createStreamLoggerState,
  type LLMMode,
  type VerboseLevel,
  shouldLog,
  type LlmJsonPutSchema,
  LlmJsonPut,
  GitProviderService,
  ChangedFile,
} from "@spaceflow/core";
import micromatch from "micromatch";
import type { DeletionImpactResult } from "./review-spec";
import { spawn } from "child_process";

export interface DeletedCodeBlock {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  commit?: string;
}

const DELETION_IMPACT_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    impacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string", description: "被删除代码所在的文件路径" },
          deletedCode: { type: "string", description: "被删除的代码片段摘要（前50字符）" },
          riskLevel: {
            type: "string",
            enum: ["high", "medium", "low", "none"],
            description:
              "风险等级：high=可能导致功能异常，medium=可能影响部分功能，low=影响较小，none=无影响",
          },
          affectedFiles: {
            type: "array",
            items: { type: "string" },
            description: "可能受影响的文件列表",
          },
          reason: { type: "string", description: "影响分析的详细说明" },
          suggestion: { type: "string", description: "建议的处理方式" },
        },
        required: ["file", "deletedCode", "riskLevel", "affectedFiles", "reason"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "删除代码影响的整体总结" },
  },
  required: ["impacts", "summary"],
  additionalProperties: false,
};

export type DeletionDiffSource = "provider-api" | "git-diff";

export interface DeletionAnalysisContext {
  owner?: string;
  repo?: string;
  prNumber?: number;
  baseRef?: string;
  headRef?: string;
  /** diff 来源：provider-api 使用 Git Provider API，git-diff 使用本地 git 命令（两点语法） */
  diffSource?: DeletionDiffSource;
  /** 分析模式：openai 使用标准模式，claude-agent 使用 Agent 模式（可使用工具） */
  analysisMode?: LLMMode;
  /** 文件过滤 glob 模式，与 review.includes 一致 */
  includes?: string[];
}

export class DeletionImpactService {
  constructor(
    protected readonly llmProxyService: LlmProxyService,
    protected readonly gitProvider: GitProviderService,
  ) {}

  /**
   * 分析删除代码的影响
   */
  async analyzeDeletionImpact(
    context: DeletionAnalysisContext,
    llmMode: LLMMode,
    verbose?: VerboseLevel,
  ): Promise<DeletionImpactResult> {
    if (shouldLog(verbose, 1)) {
      console.log(`\n🔍 开始分析删除代码的影响...`);
    }

    // 1. 获取删除的代码块
    let deletedBlocks: DeletedCodeBlock[];
    const diffSource = context.diffSource ?? (context.prNumber ? "provider-api" : "git-diff");

    if (diffSource === "provider-api" && context.prNumber && context.owner && context.repo) {
      // Git Provider API 模式：使用 API 获取 diff
      if (shouldLog(verbose, 1)) {
        console.log(`   📡 使用 Git Provider API 获取 PR #${context.prNumber} 的 diff`);
      }
      const changedFiles = await this.gitProvider.getPullRequestFiles(
        context.owner,
        context.repo,
        context.prNumber,
      );
      // 检查 changedFiles 是否包含 patch 字段
      const filesWithPatch = changedFiles.filter((f) => f.patch);
      const filesWithDeletions = changedFiles.filter((f) => f.deletions && f.deletions > 0);
      if (shouldLog(verbose, 1)) {
        console.log(
          `   📊 共 ${changedFiles.length} 个文件, ${filesWithPatch.length} 个有 patch, ${filesWithDeletions.length} 个有删除`,
        );
      }

      if (filesWithPatch.length > 0) {
        // 有 patch 字段，直接解析
        deletedBlocks = this.extractDeletedBlocksFromChangedFiles(changedFiles);
      } else if (filesWithDeletions.length > 0) {
        // 没有 patch 字段但有删除，使用 PR diff API
        if (shouldLog(verbose, 1)) {
          console.log(`   ⚠️ API 未返回 patch 字段，使用 PR diff API`);
        }
        try {
          const diffText = await this.gitProvider.getPullRequestDiff(
            context.owner,
            context.repo,
            context.prNumber,
          );
          deletedBlocks = this.extractDeletedBlocksFromDiffText(diffText);
        } catch (e) {
          if (shouldLog(verbose, 1)) {
            console.log(`   ❌ PR diff API 失败: ${e instanceof Error ? e.message : String(e)}`);
          }
          deletedBlocks = [];
        }
      } else {
        // 没有删除的文件
        deletedBlocks = [];
      }
    } else if (context.baseRef && context.headRef) {
      // Git Diff 模式：使用本地 git 命令（两点语法）
      if (shouldLog(verbose, 1)) {
        console.log(`   💻 使用 Git Diff 获取 ${context.baseRef}..${context.headRef} 的差异`);
      }
      deletedBlocks = await this.getDeletedCodeBlocks(context.baseRef, context.headRef, verbose);
    } else {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⚠️ 缺少必要参数，跳过删除分析`);
      }
      return { impacts: [], summary: "缺少必要参数" };
    }
    if (deletedBlocks.length === 0) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ✅ 没有发现删除的代码`);
      }
      return { impacts: [], summary: "没有发现删除的代码" };
    }
    if (shouldLog(verbose, 1)) {
      console.log(`   📦 发现 ${deletedBlocks.length} 个删除的代码块`);
    }

    // 1.5 使用 includes 过滤文件
    if (context.includes && context.includes.length > 0) {
      const beforeCount = deletedBlocks.length;
      const filenames = deletedBlocks.map((b) => b.file);
      const matchedFilenames = micromatch(filenames, context.includes);
      deletedBlocks = deletedBlocks.filter((b) => matchedFilenames.includes(b.file));
      if (shouldLog(verbose, 1)) {
        console.log(`   🔍 Includes 过滤: ${beforeCount} -> ${deletedBlocks.length} 个删除块`);
      }
      if (deletedBlocks.length === 0) {
        return { impacts: [], summary: "过滤后没有需要分析的删除代码" };
      }
    }

    // 2. 获取删除代码的引用关系
    const references = await this.findCodeReferences(deletedBlocks);
    if (shouldLog(verbose, 1)) {
      console.log(`   🔗 找到 ${references.size} 个文件可能引用了被删除的代码`);
    }

    // 3. 根据分析模式选择不同的分析方法
    const analysisMode = context.analysisMode ?? "openai";
    let result: DeletionImpactResult;

    if (["claude-code", "open-code"].includes(analysisMode)) {
      // Claude Agent 模式：使用工具主动探索代码库
      result = await this.analyzeWithAgent(analysisMode, deletedBlocks, references, verbose);
    } else {
      // OpenAI 模式：标准 chat completion
      result = await this.analyzeWithLLM(deletedBlocks, references, llmMode, verbose);
    }

    // 防御性检查：确保 impacts 是数组
    if (!result.impacts || !Array.isArray(result.impacts)) {
      result.impacts = [];
    }

    const highRiskCount = result.impacts.filter((i) => i.riskLevel === "high").length;
    const mediumRiskCount = result.impacts.filter((i) => i.riskLevel === "medium").length;
    if (shouldLog(verbose, 1)) {
      console.log(`\n📊 分析完成: ${highRiskCount} 个高风险, ${mediumRiskCount} 个中风险`);
    }

    return result;
  }

  /**
   * 从 Git Provider API 返回的 ChangedFile 中提取被删除的代码块
   */
  protected extractDeletedBlocksFromChangedFiles(changedFiles: ChangedFile[]): DeletedCodeBlock[] {
    const deletedBlocks: DeletedCodeBlock[] = [];

    for (const file of changedFiles) {
      if (!file.filename || !file.patch) continue;

      const blocks = this.parseDeletedBlocksFromPatch(file.filename, file.patch);
      deletedBlocks.push(...blocks);
    }

    // 过滤掉空白行和注释行为主的删除块
    return this.filterMeaningfulBlocks(deletedBlocks);
  }

  /**
   * 从单个文件的 patch 中解析删除的代码块
   */
  protected parseDeletedBlocksFromPatch(filename: string, patch: string): DeletedCodeBlock[] {
    const deletedBlocks: DeletedCodeBlock[] = [];
    const lines = patch.split("\n");
    let currentDeleteBlock: { startLine: number; lines: string[] } | null = null;

    for (const line of lines) {
      // 解析 hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/);
      if (hunkMatch) {
        // 保存之前的删除块
        if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
          deletedBlocks.push({
            file: filename,
            startLine: currentDeleteBlock.startLine,
            endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
            content: currentDeleteBlock.lines.join("\n"),
          });
        }
        currentDeleteBlock = {
          startLine: parseInt(hunkMatch[1], 10),
          lines: [],
        };
        continue;
      }

      // 删除的行（以 - 开头，但不是 ---）
      if (line.startsWith("-") && !line.startsWith("---") && currentDeleteBlock) {
        currentDeleteBlock.lines.push(line.slice(1)); // 去掉 - 前缀
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        // 新增行，保存当前删除块
        if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
          deletedBlocks.push({
            file: filename,
            startLine: currentDeleteBlock.startLine,
            endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
            content: currentDeleteBlock.lines.join("\n"),
          });
          currentDeleteBlock = { startLine: currentDeleteBlock.startLine, lines: [] };
        }
      }
    }

    // 保存最后一个删除块
    if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
      deletedBlocks.push({
        file: filename,
        startLine: currentDeleteBlock.startLine,
        endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
        content: currentDeleteBlock.lines.join("\n"),
      });
    }

    return deletedBlocks;
  }

  /**
   * 过滤掉空白行和注释行为主的删除块
   */
  protected filterMeaningfulBlocks(blocks: DeletedCodeBlock[]): DeletedCodeBlock[] {
    return blocks.filter((block) => {
      const meaningfulLines = block.content.split("\n").filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("/*")
        );
      });
      return meaningfulLines.length > 0;
    });
  }

  /**
   * 从 diff 文本中提取被删除的代码块
   */
  protected extractDeletedBlocksFromDiffText(diffText: string): DeletedCodeBlock[] {
    const deletedBlocks: DeletedCodeBlock[] = [];
    const fileDiffs = diffText.split(/^diff --git /m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
      // 解析文件名
      const headerMatch = fileDiff.match(/^a\/(.+?) b\/(.+?)[\r\n]/);
      if (!headerMatch) continue;

      const filename = headerMatch[1]; // 使用原文件名（a/...）
      const lines = fileDiff.split("\n");
      let currentDeleteBlock: { startLine: number; lines: string[] } | null = null;

      for (const line of lines) {
        // 解析 hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/);
        if (hunkMatch) {
          // 保存之前的删除块
          if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
            deletedBlocks.push({
              file: filename,
              startLine: currentDeleteBlock.startLine,
              endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
              content: currentDeleteBlock.lines.join("\n"),
            });
          }
          currentDeleteBlock = {
            startLine: parseInt(hunkMatch[1], 10),
            lines: [],
          };
          continue;
        }

        // 删除的行（以 - 开头，但不是 ---）
        if (line.startsWith("-") && !line.startsWith("---") && currentDeleteBlock) {
          currentDeleteBlock.lines.push(line.slice(1)); // 去掉 - 前缀
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          // 新增行，保存当前删除块
          if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
            deletedBlocks.push({
              file: filename,
              startLine: currentDeleteBlock.startLine,
              endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
              content: currentDeleteBlock.lines.join("\n"),
            });
            currentDeleteBlock = { startLine: currentDeleteBlock.startLine, lines: [] };
          }
        }
      }

      // 保存最后一个删除块
      if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
        deletedBlocks.push({
          file: filename,
          startLine: currentDeleteBlock.startLine,
          endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
          content: currentDeleteBlock.lines.join("\n"),
        });
      }
    }

    // 过滤掉空白行和注释行为主的删除块
    return this.filterMeaningfulBlocks(deletedBlocks);
  }

  /**
   * 从 git diff 中提取被删除的代码块
   */
  protected async getDeletedCodeBlocks(
    baseRef: string,
    headRef: string,
    verbose?: VerboseLevel,
  ): Promise<DeletedCodeBlock[]> {
    if (shouldLog(verbose, 1)) {
      console.log(`   🔎 分析 ${baseRef}...${headRef} 的删除代码`);
    }
    // 尝试解析 ref，支持本地分支、远程分支、commit SHA
    const resolvedBaseRef = await this.resolveRef(baseRef, verbose);
    const resolvedHeadRef = await this.resolveRef(headRef, verbose);

    // 使用两点语法 (..) 而非三点语法 (...)，避免浅克隆时找不到 merge base
    // 两点语法直接比较两个 ref 的差异，不需要计算共同祖先
    const diffOutput = await this.runGitCommand([
      "diff",
      "-U0", // 不显示上下文，只显示变更
      `${resolvedBaseRef}..${resolvedHeadRef}`,
    ]);

    const deletedBlocks: DeletedCodeBlock[] = [];
    const fileDiffs = diffOutput.split(/^diff --git /m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
      // 解析文件名
      const headerMatch = fileDiff.match(/^a\/(.+?) b\/(.+?)[\r\n]/);
      if (!headerMatch) continue;

      const filename = headerMatch[1]; // 使用原文件名（a/...）
      const lines = fileDiff.split("\n");
      let currentDeleteBlock: { startLine: number; lines: string[] } | null = null;

      for (const line of lines) {
        // 解析 hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/);
        if (hunkMatch) {
          // 保存之前的删除块
          if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
            deletedBlocks.push({
              file: filename,
              startLine: currentDeleteBlock.startLine,
              endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
              content: currentDeleteBlock.lines.join("\n"),
            });
          }
          currentDeleteBlock = {
            startLine: parseInt(hunkMatch[1], 10),
            lines: [],
          };
          continue;
        }

        // 删除的行（以 - 开头，但不是 ---）
        if (line.startsWith("-") && !line.startsWith("---") && currentDeleteBlock) {
          currentDeleteBlock.lines.push(line.slice(1)); // 去掉 - 前缀
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          // 新增行，保存当前删除块
          if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
            deletedBlocks.push({
              file: filename,
              startLine: currentDeleteBlock.startLine,
              endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
              content: currentDeleteBlock.lines.join("\n"),
            });
            currentDeleteBlock = { startLine: currentDeleteBlock.startLine, lines: [] };
          }
        }
      }

      // 保存最后一个删除块
      if (currentDeleteBlock && currentDeleteBlock.lines.length > 0) {
        deletedBlocks.push({
          file: filename,
          startLine: currentDeleteBlock.startLine,
          endLine: currentDeleteBlock.startLine + currentDeleteBlock.lines.length - 1,
          content: currentDeleteBlock.lines.join("\n"),
        });
      }
    }

    // 过滤掉空白行和注释行为主的删除块
    return this.filterMeaningfulBlocks(deletedBlocks);
  }

  /**
   * 查找可能引用被删除代码的文件
   */
  protected async findCodeReferences(
    deletedBlocks: DeletedCodeBlock[],
  ): Promise<Map<string, string[]>> {
    const references = new Map<string, string[]>();

    for (const block of deletedBlocks) {
      // 从删除的代码中提取可能的标识符（函数名、类名、变量名等）
      const identifiers = this.extractIdentifiers(block.content);
      const fileRefs: string[] = [];

      for (const identifier of identifiers) {
        if (identifier.length < 3) continue; // 跳过太短的标识符

        try {
          // 使用 git grep 查找引用
          const grepOutput = await this.runGitCommand([
            "grep",
            "-l", // 只输出文件名
            "-w", // 全词匹配
            identifier,
            "--",
            "*.ts",
            "*.js",
            "*.tsx",
            "*.jsx",
          ]);

          const files = grepOutput
            .trim()
            .split("\n")
            .filter((f) => f && f !== block.file);
          fileRefs.push(...files);
        } catch {
          // grep 没找到匹配，忽略
        }
      }

      if (fileRefs.length > 0) {
        const uniqueRefs = [...new Set(fileRefs)];
        references.set(`${block.file}:${block.startLine}-${block.endLine}`, uniqueRefs);
      }
    }

    return references;
  }

  /**
   * 从代码中提取标识符
   */
  protected extractIdentifiers(code: string): string[] {
    const identifiers: string[] = [];

    // 匹配函数定义
    const funcMatches = code.matchAll(/(?:function|async\s+function)\s+(\w+)/g);
    for (const match of funcMatches) {
      identifiers.push(match[1]);
    }

    // 匹配方法定义
    const methodMatches = code.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g);
    for (const match of methodMatches) {
      if (!["if", "for", "while", "switch", "catch", "function"].includes(match[1])) {
        identifiers.push(match[1]);
      }
    }

    // 匹配类定义
    const classMatches = code.matchAll(/class\s+(\w+)/g);
    for (const match of classMatches) {
      identifiers.push(match[1]);
    }

    // 匹配接口定义
    const interfaceMatches = code.matchAll(/interface\s+(\w+)/g);
    for (const match of interfaceMatches) {
      identifiers.push(match[1]);
    }

    // 匹配类型定义
    const typeMatches = code.matchAll(/type\s+(\w+)/g);
    for (const match of typeMatches) {
      identifiers.push(match[1]);
    }

    // 匹配 export 的变量/常量
    const exportMatches = code.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g);
    for (const match of exportMatches) {
      identifiers.push(match[1]);
    }

    return [...new Set(identifiers)];
  }

  /**
   * 使用 LLM 分析删除代码的影响
   */
  protected async analyzeWithLLM(
    deletedBlocks: DeletedCodeBlock[],
    references: Map<string, string[]>,
    llmMode: LLMMode,
    verbose?: VerboseLevel,
  ): Promise<DeletionImpactResult> {
    const llmJsonPut = new LlmJsonPut<DeletionImpactResult>(DELETION_IMPACT_SCHEMA);

    const systemPrompt = `你是一个代码审查专家，专门分析删除代码可能带来的影响。

## 任务
分析以下被删除的代码块，判断删除这些代码是否会影响到其他功能。

## 分析要点
1. **功能依赖**: 被删除的代码是否被其他模块调用或依赖
2. **接口变更**: 删除是否会导致 API 或接口不兼容
3. **副作用**: 删除是否会影响系统的其他行为
4. **数据流**: 删除是否会中断数据处理流程

## 风险等级判断标准
- **high**: 删除的代码被其他文件直接调用，删除后会导致编译错误或运行时异常
- **medium**: 删除的代码可能影响某些功能的行为，但不会导致直接错误
- **low**: 删除的代码影响较小，可能只是清理无用代码
- **none**: 删除的代码确实是无用代码，不会产生任何影响

## 输出要求
- 对每个有风险的删除块给出详细分析
- 如果删除是安全的，也要说明原因
- 提供具体的建议`;

    const deletedCodeSection = deletedBlocks
      .map((block, index) => {
        const refs = references.get(`${block.file}:${block.startLine}-${block.endLine}`) || [];
        return `### 删除块 ${index + 1}: ${block.file}:${block.startLine}-${block.endLine}

\`\`\`
${block.content}
\`\`\`

可能引用此代码的文件: ${refs.length > 0 ? refs.join(", ") : "未发现直接引用"}
`;
      })
      .join("\n");

    const userPrompt = `## 被删除的代码块

${deletedCodeSection}

请分析这些删除操作可能带来的影响。`;

    if (shouldLog(verbose, 2)) {
      console.log(`\nsystemPrompt:\n----------------\n${systemPrompt}\n----------------`);
      console.log(`\nuserPrompt:\n----------------\n${userPrompt}\n----------------`);
    }

    try {
      const stream = this.llmProxyService.chatStream(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          adapter: llmMode,
          jsonSchema: llmJsonPut,
          verbose,
        },
      );

      let result: DeletionImpactResult | undefined;
      for await (const event of stream) {
        if (event.type === "result") {
          result = event.response.structuredOutput as DeletionImpactResult | undefined;
        } else if (event.type === "error") {
          console.error(`   ❌ 分析失败: ${event.message}`);
        }
      }

      // 防御性检查：确保返回的是有效对象
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return { impacts: [], summary: "分析返回格式无效" };
      }
      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`   ❌ LLM 调用失败: ${error.message}`);
        if (error.stack) {
          console.error(`   堆栈信息:\n${error.stack}`);
        }
      } else {
        console.error(`   ❌ LLM 调用失败: ${String(error)}`);
      }
      return { impacts: [], summary: "LLM 调用失败" };
    }
  }

  /**
   * 使用 Claude Agent 模式分析删除代码的影响
   * Claude Agent 可以使用工具主动探索代码库，分析更深入
   */
  protected async analyzeWithAgent(
    analysisMode: LLMMode,
    deletedBlocks: DeletedCodeBlock[],
    references: Map<string, string[]>,
    verbose?: VerboseLevel,
  ): Promise<DeletionImpactResult> {
    const llmJsonPut = new LlmJsonPut<DeletionImpactResult>(DELETION_IMPACT_SCHEMA);

    const systemPrompt = `你是一个资深代码架构师，擅长分析代码变更的影响范围和潜在风险。

## 任务
深入分析以下被删除的代码块，评估删除操作对代码库的影响。

## 你的能力
你可以使用以下工具来深入分析代码：
- **Read**: 读取文件内容，查看被删除代码的完整上下文
- **Grep**: 搜索代码库，查找对被删除代码的引用
- **Glob**: 查找匹配模式的文件

## 分析流程
1. 首先阅读被删除代码的上下文，理解其功能
2. 使用 Grep 搜索代码库中对这些代码的引用
3. 分析引用处的代码，判断删除后的影响
4. 给出风险评估和建议

## 风险等级判断标准
- **high**: 删除的代码被其他文件直接调用，删除后会导致编译错误或运行时异常
- **medium**: 删除的代码可能影响某些功能的行为，但不会导致直接错误
- **low**: 删除的代码影响较小，可能只是清理无用代码
- **none**: 删除的代码确实是无用代码，不会产生任何影响

## 输出要求
- 对每个有风险的删除块给出详细分析
- 如果删除是安全的，也要说明原因
- 提供具体的建议`;

    const deletedCodeSection = deletedBlocks
      .map((block, index) => {
        const refs = references.get(`${block.file}:${block.startLine}-${block.endLine}`) || [];
        return `### 删除块 ${index + 1}: ${block.file}:${block.startLine}-${block.endLine}

\`\`\`
${block.content}
\`\`\`

可能引用此代码的文件: ${refs.length > 0 ? refs.join(", ") : "未发现直接引用"}
`;
      })
      .join("\n");

    const userPrompt = `## 被删除的代码块

${deletedCodeSection}

## 补充说明

请使用你的工具能力深入分析这些删除操作可能带来的影响。
- 如果需要查看更多上下文，请读取相关文件
- 如果需要确认引用关系，请搜索代码库
- 分析完成后，给出结构化的影响评估`;

    if (shouldLog(verbose, 2)) {
      console.log(
        `\n[Agent Mode] systemPrompt:\n----------------\n${systemPrompt}\n----------------`,
      );
      console.log(`\n[Agent Mode] userPrompt:\n----------------\n${userPrompt}\n----------------`);
    }

    if (shouldLog(verbose, 1)) {
      console.log(`   🤖 使用 Agent 模式分析（${analysisMode}，可使用工具）...`);
    }

    try {
      const stream = this.llmProxyService.chatStream(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          adapter: analysisMode,
          jsonSchema: llmJsonPut,
          allowedTools: ["Read", "Grep", "Glob"],
          verbose,
        },
      );

      let result: DeletionImpactResult | undefined;
      const streamLoggerState = createStreamLoggerState();
      for await (const event of stream) {
        if (shouldLog(verbose, 1)) {
          logStreamEvent(event, streamLoggerState);
        }
        if (event.type === "result") {
          result = event.response.structuredOutput as DeletionImpactResult | undefined;
        } else if (event.type === "error") {
          console.error(`   ❌ 分析失败: ${event.message}`);
        }
      }

      // 防御性检查：确保返回的是有效对象
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return { impacts: [], summary: "分析返回格式无效" };
      }
      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`   ❌ Agent 调用失败: ${error.message}`);
        if (error.stack) {
          console.error(`   堆栈信息:\n${error.stack}`);
        }
      } else {
        console.error(`   ❌ Agent 调用失败: ${String(error)}`);
      }
      return { impacts: [], summary: "Agent 调用失败" };
    }
  }

  /**
   * 解析 ref，支持本地分支、远程分支、commit SHA
   * 优先级：本地分支 > origin/分支 > fetch后重试 > 原始值
   */
  protected async resolveRef(ref: string, verbose?: VerboseLevel): Promise<string> {
    if (!ref) {
      throw new Error(`resolveRef: ref 参数不能为空。调用栈: ${new Error().stack}`);
    }
    // 如果已经是 commit SHA 格式（7-40位十六进制），直接返回
    if (/^[0-9a-f]{7,40}$/i.test(ref)) {
      if (shouldLog(verbose, 1)) {
        console.log(`   📌 ${ref} 是 commit SHA，直接使用`);
      }
      return ref;
    }

    // 如果已经是 origin/ 格式，直接返回
    if (ref.startsWith("origin/")) {
      if (shouldLog(verbose, 1)) {
        console.log(`   📌 ${ref} 已是远程分支格式，直接使用`);
      }
      return ref;
    }

    // 尝试解析本地分支
    try {
      await this.runGitCommand(["rev-parse", "--verify", ref]);
      if (shouldLog(verbose, 1)) {
        console.log(`   📌 ${ref} 解析为本地分支`);
      }
      return ref;
    } catch {
      // 本地分支不存在，尝试 origin/分支
    }

    // 尝试 origin/分支
    try {
      await this.runGitCommand(["rev-parse", "--verify", `origin/${ref}`]);
      if (shouldLog(verbose, 1)) {
        console.log(`   📌 ${ref} 解析为 origin/${ref}`);
      }
      return `origin/${ref}`;
    } catch {
      // origin/分支也不存在，尝试 fetch
    }

    // 尝试 fetch 该分支
    if (shouldLog(verbose, 1)) {
      console.log(`   ⏳ 尝试 fetch ${ref}...`);
    }
    try {
      await this.runGitCommand([
        "fetch",
        "origin",
        `${ref}:refs/remotes/origin/${ref}`,
        "--depth=1",
      ]);
      if (shouldLog(verbose, 1)) {
        console.log(`   📌 ${ref} fetch 成功，使用 origin/${ref}`);
      }
      return `origin/${ref}`;
    } catch (e) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⚠️ fetch ${ref} 失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (shouldLog(verbose, 1)) {
      console.log(`   ⚠️ 无法解析 ${ref}，使用原始值`);
    }
    return ref;
  }

  protected runGitCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git 命令失败 (${code}): ${stderr}`));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }
}
