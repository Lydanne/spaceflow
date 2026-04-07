import type { PromptFn } from "./types";
import { validateArray, validateRequired } from "./types";
import type { DeletedCodeBlock } from "../deletion-impact.service";

/**
 * 删除影响分析 - 标准 LLM 模式
 */
export interface DeletionImpactContext {
  deletedBlocks: DeletedCodeBlock[];
  references: Map<string, string[]>;
  [key: string]: unknown;
}

const DELETION_IMPACT_SYSTEM = `你是一个代码审查专家，专门分析删除代码可能带来的影响。

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

function buildDeletedCodeSection(ctx: DeletionImpactContext): string {
  return ctx.deletedBlocks
    .map((block, index) => {
      const refs = ctx.references.get(`${block.file}:${block.startLine}-${block.endLine}`) || [];
      return `### 删除块 ${index + 1}: ${block.file}:${block.startLine}-${block.endLine}\n\n\`\`\`\n${block.content}\n\`\`\`\n\n可能引用此代码的文件: ${refs.length > 0 ? refs.join(", ") : "未发现直接引用"}\n`;
    })
    .join("\n");
}

export const buildDeletionImpactPrompt: PromptFn<DeletionImpactContext> = (ctx) => {
  validateArray(ctx.deletedBlocks, "deletedBlocks");
  validateRequired(ctx.references, "references");
  return {
    systemPrompt: DELETION_IMPACT_SYSTEM,
    userPrompt: `## 被删除的代码块\n\n${buildDeletedCodeSection(ctx)}\n请分析这些删除操作可能带来的影响。`,
  };
};

/** @deprecated 使用 buildDeletionImpactPrompt */
export const buildDeletionImpactSystemPrompt: PromptFn<DeletionImpactContext> = (ctx) =>
  buildDeletionImpactPrompt(ctx);

/** @deprecated 使用 buildDeletionImpactPrompt */
export const buildDeletionImpactUserPrompt: PromptFn<DeletionImpactContext> = (ctx) =>
  buildDeletionImpactPrompt(ctx);

const DELETION_IMPACT_AGENT_SYSTEM = `你是一个资深代码架构师，擅长分析代码变更的影响范围和潜在风险。

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

export const buildDeletionImpactAgentPrompt: PromptFn<DeletionImpactContext> = (ctx) => {
  validateArray(ctx.deletedBlocks, "deletedBlocks");
  validateRequired(ctx.references, "references");
  return {
    systemPrompt: DELETION_IMPACT_AGENT_SYSTEM,
    userPrompt: `## 被删除的代码块\n\n${buildDeletedCodeSection(ctx)}\n## 补充说明\n\n请使用你的工具能力深入分析这些删除操作可能带来的影响。\n- 如果需要查看更多上下文，请读取相关文件\n- 如果需要确认引用关系，请搜索代码库\n- 分析完成后，给出结构化的影响评估`,
  };
};

/** @deprecated 使用 buildDeletionImpactAgentPrompt */
export const buildDeletionImpactAgentSystemPrompt: PromptFn<DeletionImpactContext> = (ctx) =>
  buildDeletionImpactAgentPrompt(ctx);

/** @deprecated 使用 buildDeletionImpactAgentPrompt */
export const buildDeletionImpactAgentUserPrompt: PromptFn<DeletionImpactContext> = (ctx) =>
  buildDeletionImpactAgentPrompt(ctx);
