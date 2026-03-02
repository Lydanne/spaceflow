import {
  LlmProxyService,
  type LLMMode,
  type VerboseLevel,
  shouldLog,
  type LlmJsonPutSchema,
  LlmJsonPut,
  parallel,
} from "@spaceflow/core";
import {
  ReviewIssue,
  ReviewSpec,
  ReviewRule,
  ReviewSpecService,
  FileContentsMap,
  FileContentLine,
} from "./review-spec";

interface VerifyResult {
  fixed: boolean;
  valid: boolean;
  reason: string;
}

const TRUE = "true";
const FALSE = "false";

const VERIFY_SCHEMA: LlmJsonPutSchema = {
  type: "object",
  properties: {
    fixed: {
      type: "boolean",
      description: "问题是否已被修复",
    },
    valid: {
      type: "boolean",
      description: "问题是否有效，有效的条件就是你需要看看代码是否符合规范",
    },
    reason: {
      type: "string",
      description: "判断依据，说明为什么认为问题已修复或仍存在",
    },
  },
  required: ["fixed", "valid", "reason"],
  additionalProperties: false,
};

export class IssueVerifyService {
  constructor(
    protected readonly llmProxyService: LlmProxyService,
    protected readonly reviewSpecService: ReviewSpecService,
  ) {}

  /**
   * 验证历史 issues 是否已被修复
   * 按并发数批量验证，每批并行调用 LLM
   */
  async verifyIssueFixes(
    existingIssues: ReviewIssue[],
    fileContents: FileContentsMap,
    specs: ReviewSpec[],
    llmMode: LLMMode,
    verbose?: VerboseLevel,
    concurrency: number = 10,
  ): Promise<ReviewIssue[]> {
    if (existingIssues.length === 0) {
      return [];
    }

    if (shouldLog(verbose, 1)) {
      console.log(
        `\n🔍 开始验证 ${existingIssues.length} 个历史问题是否已修复 (并发: ${concurrency})...`,
      );
    }

    const verifiedIssues: ReviewIssue[] = [];
    const llmJsonPut = new LlmJsonPut<VerifyResult>(VERIFY_SCHEMA);

    // 预处理：分离已修复和需要验证的 issues
    const toVerify: {
      issue: ReviewIssue;
      fileContent: FileContentLine[];
      ruleInfo: { rule: ReviewRule; spec: ReviewSpec } | null;
    }[] = [];
    for (const issue of existingIssues) {
      if (issue.fixed) {
        if (shouldLog(verbose, 1)) {
          console.log(`   ⏭️  跳过已修复: ${issue.file}:${issue.line} (${issue.ruleId})`);
        }
        verifiedIssues.push(issue);
        continue;
      }

      // valid === 'false' 的问题跳过复查（已确认无效的问题无需再次验证）
      if (issue.valid === FALSE) {
        if (shouldLog(verbose, 1)) {
          console.log(`   ⏭️  跳过无效问题: ${issue.file}:${issue.line} (${issue.ruleId})`);
        }
        verifiedIssues.push(issue);
        continue;
      }

      const fileContent = fileContents.get(issue.file);
      if (fileContent === undefined) {
        if (shouldLog(verbose, 1)) {
          console.log(`   ✅ 文件已删除: ${issue.file}:${issue.line} (${issue.ruleId})`);
        }
        verifiedIssues.push({
          ...issue,
          fixed: new Date().toISOString(),
          valid: FALSE,
          reason: "文件已删除",
        });
        continue;
      }

      const ruleInfo = this.reviewSpecService.findRuleById(issue.ruleId, specs);
      toVerify.push({ issue, fileContent, ruleInfo });
    }

    // 使用 parallel 库并行处理
    const executor = parallel({
      concurrency,
      onTaskStart: (taskId) => {
        if (shouldLog(verbose, 1)) {
          console.log(`   🔎 验证: ${taskId}`);
        }
      },
      onTaskComplete: (taskId, success) => {
        if (shouldLog(verbose, 1)) {
          console.log(`   ${success ? "✅" : "❌"} 完成: ${taskId}`);
        }
      },
    });

    const results = await executor.map(
      toVerify,
      async ({ issue, fileContent, ruleInfo }) =>
        this.verifySingleIssue(issue, fileContent, ruleInfo, llmMode, llmJsonPut, verbose),
      ({ issue }) => `${issue.file}:${issue.line}`,
    );

    for (const result of results) {
      if (result.success && result.result) {
        verifiedIssues.push(result.result);
      } else {
        // 失败时保留原始 issue
        const originalItem = toVerify.find(
          (item) => `${item.issue.file}:${item.issue.line}` === result.id,
        );
        if (originalItem) {
          verifiedIssues.push(originalItem.issue);
        }
      }
    }

    const fixedCount = verifiedIssues.filter((i) => i.fixed).length;
    const unfixedCount = verifiedIssues.length - fixedCount;
    if (shouldLog(verbose, 1)) {
      console.log(`\n📊 验证完成: ${fixedCount} 个已修复, ${unfixedCount} 个未修复`);
    }

    return verifiedIssues;
  }

  /**
   * 验证单个 issue 是否已修复
   */
  protected async verifySingleIssue(
    issue: ReviewIssue,
    fileContent: FileContentLine[],
    ruleInfo: { rule: ReviewRule; spec: ReviewSpec } | null,
    llmMode: LLMMode,
    llmJsonPut: LlmJsonPut<VerifyResult>,
    verbose?: VerboseLevel,
  ): Promise<ReviewIssue> {
    const verifyPrompt = this.buildVerifyPrompt(issue, fileContent, ruleInfo);

    try {
      const stream = this.llmProxyService.chatStream(
        [
          { role: "system", content: verifyPrompt.systemPrompt },
          { role: "user", content: verifyPrompt.userPrompt },
        ],
        {
          adapter: llmMode,
          jsonSchema: llmJsonPut,
          verbose,
        },
      );

      let result: VerifyResult | undefined;
      for await (const event of stream) {
        if (event.type === "result") {
          result = event.response.structuredOutput as VerifyResult | undefined;
        } else if (event.type === "error") {
          console.error(`      ❌ 验证失败: ${event.message}`);
        }
      }

      if (result) {
        const updatedIssue: ReviewIssue = {
          ...issue,
          valid: issue.fixed || issue.resolved ? TRUE : result.valid ? TRUE : FALSE,
        };

        if (result.fixed) {
          if (shouldLog(verbose, 1)) {
            console.log(`      ✅ 已修复: ${result.reason}`);
          }
          updatedIssue.fixed = new Date().toISOString();
        } else if (!result.valid) {
          if (shouldLog(verbose, 1)) {
            console.log(`      ❌ 无效问题: ${result.reason}`);
          }
        } else {
          if (shouldLog(verbose, 1)) {
            console.log(`      ⚠️  未修复: ${result.reason}`);
          }
        }

        return updatedIssue;
      } else {
        return issue;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`      ❌ 验证出错: ${error.message}`);
        if (error.stack) {
          console.error(`      堆栈信息:\n${error.stack}`);
        }
      } else {
        console.error(`      ❌ 验证出错: ${String(error)}`);
      }
      return issue;
    }
  }

  /**
   * 构建验证单个 issue 是否已修复的 prompt
   */
  protected buildVerifyPrompt(
    issue: ReviewIssue,
    fileContent: FileContentLine[],
    ruleInfo: { rule: ReviewRule; spec: ReviewSpec } | null,
  ): { systemPrompt: string; userPrompt: string } {
    const padWidth = String(fileContent.length).length;
    const linesWithNumbers = fileContent
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
    if (ruleInfo) {
      ruleSection = this.reviewSpecService.buildSpecsSection([ruleInfo.spec]);
    }

    const userPrompt = `## 规则定义

${ruleSection}

## 之前发现的问题

- **文件**: ${issue.file}
- **行号**: ${issue.line}
- **规则**: ${issue.ruleId} (来自 ${issue.specFile})
- **问题描述**: ${issue.reason}
${issue.suggestion ? `- **原建议**: ${issue.suggestion}` : ""}

## 当前文件内容

\`\`\`
${linesWithNumbers}
\`\`\`

请判断这个问题是否有效，以及是否已经被修复。`;

    return { systemPrompt, userPrompt };
  }
}
