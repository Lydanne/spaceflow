import {
  LlmProxyService,
  type LLMMode,
  type VerboseLevel,
  shouldLog,
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
import { VERIFY_SCHEMA, buildIssueVerifyPrompt } from "./prompt";

interface VerifyResult {
  fixed: boolean;
  valid: boolean;
  reason: string;
}

const TRUE = "true";
const FALSE = "false";

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
          resolved: new Date().toISOString(),
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
      ({ issue }) => `${issue.file}:${issue.line}:${issue.ruleId}`,
    );

    for (const result of results) {
      if (result.success && result.result) {
        verifiedIssues.push(result.result);
      } else {
        // 失败时保留原始 issue
        const originalItem = toVerify.find(
          (item) => `${item.issue.file}:${item.issue.line}:${item.issue.ruleId}` === result.id,
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
    const specsSection = ruleInfo ? this.reviewSpecService.buildSpecsSection([ruleInfo.spec]) : "";
    const verifyPrompt = buildIssueVerifyPrompt({
      issue,
      fileContent,
      ruleInfo,
      specsSection,
    });

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
          updatedIssue.resolved = new Date().toISOString();
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
   * @deprecated 使用 prompt/issue-verify.ts 中的 buildIssueVerifyPrompt
   * 构建验证单个 issue 是否已修复的 prompt
   */
  protected buildVerifyPrompt(
    issue: ReviewIssue,
    fileContent: FileContentLine[],
    ruleInfo: { rule: ReviewRule; spec: ReviewSpec } | null,
  ): { systemPrompt: string; userPrompt: string } {
    const specsSection = ruleInfo ? this.reviewSpecService.buildSpecsSection([ruleInfo.spec]) : "";

    return buildIssueVerifyPrompt({
      issue,
      fileContent,
      ruleInfo,
      specsSection,
    });
  }
}
