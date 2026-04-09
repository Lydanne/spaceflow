import {
  GitProviderService,
  PullRequestCommit,
  ChangedFile,
  type VerboseLevel,
  shouldLog,
  GitSdkService,
} from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { ReviewSpecService, ReviewSpec, ReviewIssue, FileContentsMap } from "./review-spec";
import { IssueVerifyService } from "./issue-verify.service";
import { generateIssueKey } from "./utils/review-pr-comment";
import type { ReviewContext } from "./review-context";

export class ReviewIssueFilter {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
    protected readonly reviewSpecService: ReviewSpecService,
    protected readonly issueVerifyService: IssueVerifyService,
    protected readonly gitSdk: GitSdkService,
  ) {}

  /**
   * 加载并去重审查规则
   */
  async loadSpecs(specSources: string[], verbose?: VerboseLevel): Promise<ReviewSpec[]> {
    if (shouldLog(verbose, 1)) {
      console.log(`📂 解析规则来源: ${specSources.length} 个`);
    }
    const specDirs = await this.reviewSpecService.resolveSpecSources(specSources, verbose);
    if (shouldLog(verbose, 2)) {
      console.log(`   解析到 ${specDirs.length} 个规则目录`, specDirs);
    }

    let specs: ReviewSpec[] = [];
    for (const specDir of specDirs) {
      const dirSpecs = await this.reviewSpecService.loadReviewSpecs(specDir);
      specs.push(...dirSpecs);
    }
    if (shouldLog(verbose, 1)) {
      console.log(`   找到 ${specs.length} 个规则文件`);
    }

    const beforeDedup = specs.reduce((sum, s) => sum + s.rules.length, 0);
    specs = this.reviewSpecService.deduplicateSpecs(specs);
    const afterDedup = specs.reduce((sum, s) => sum + s.rules.length, 0);
    if (beforeDedup !== afterDedup && shouldLog(verbose, 1)) {
      console.log(`   去重规则: ${beforeDedup} -> ${afterDedup} 条`);
    }

    return specs;
  }

  /**
   * LLM 验证历史问题是否已修复
   */
  async verifyAndUpdateIssues(
    context: ReviewContext,
    issues: ReviewIssue[],
    commits: PullRequestCommit[],
    preloaded: { specs: ReviewSpec[]; fileContents: FileContentsMap },
  ): Promise<ReviewIssue[]> {
    const { llmMode, verbose } = context;
    const unfixedIssues = issues.filter((i) => i.valid !== "false" && !i.fixed);

    if (unfixedIssues.length === 0) {
      return issues;
    }

    if (!llmMode) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⏭️  跳过 LLM 验证（缺少 llmMode）`);
      }
      return issues;
    }

    if (shouldLog(verbose, 1)) {
      console.log(`\n🔍 开始 LLM 验证 ${unfixedIssues.length} 个未修复问题...`);
    }

    const { specs, fileContents } = preloaded;

    return await this.issueVerifyService.verifyIssueFixes(
      issues,
      fileContents,
      specs,
      llmMode,
      verbose,
      context.verifyConcurrency,
    );
  }

  async getChangedFilesBetweenRefs(
    _owner: string,
    _repo: string,
    baseRef: string,
    headRef: string,
  ): Promise<ChangedFile[]> {
    // 使用 getDiffBetweenRefs 获取包含 patch 的文件列表
    // 这样可以正确解析变更行号，用于过滤非变更行的问题
    const diffFiles = await this.gitSdk.getDiffBetweenRefs(baseRef, headRef);
    const statusFiles = await this.gitSdk.getChangedFilesBetweenRefs(baseRef, headRef);

    // 合并 status 和 patch 信息
    const statusMap = new Map(statusFiles.map((f) => [f.filename, f.status]));
    return diffFiles.map((f) => ({
      filename: f.filename,
      status: statusMap.get(f.filename) || "modified",
      patch: f.patch,
    }));
  }

  async getCommitsBetweenRefs(baseRef: string, headRef: string): Promise<PullRequestCommit[]> {
    const gitCommits = await this.gitSdk.getCommitsBetweenRefs(baseRef, headRef);
    return gitCommits.map((c) => ({
      sha: c.sha,
      commit: {
        message: c.message,
        author: c.author,
      },
    }));
  }

  async getFilesForCommit(
    owner: string,
    repo: string,
    sha: string,
    prNumber?: number,
  ): Promise<string[]> {
    if (prNumber) {
      const commit = await this.gitProvider.getCommit(owner, repo, sha);
      return commit.files?.map((f) => f.filename || "").filter(Boolean) || [];
    } else {
      return this.gitSdk.getFilesForCommit(sha);
    }
  }

  async fillIssueCode(
    issues: ReviewIssue[],
    fileContents: FileContentsMap,
  ): Promise<ReviewIssue[]> {
    return issues.map((issue) => {
      const contentLines = fileContents.get(issue.file);
      if (!contentLines) {
        return issue;
      }
      const lineNums = this.reviewSpecService.parseLineRange(issue.line);
      if (lineNums.length === 0) {
        return issue;
      }
      const startLine = lineNums[0];
      const endLine = lineNums[lineNums.length - 1];
      if (startLine < 1 || startLine > contentLines.length) {
        return issue;
      }
      const codeLines = contentLines
        .slice(startLine - 1, Math.min(endLine, contentLines.length))
        .map(([, line]) => line);
      const code = codeLines.join("\n").trim();
      return { ...issue, code };
    });
  }

  /**
   * 过滤掉不属于本次 PR commits 的问题（排除 merge commit 引入的代码）
   * 根据 fileContents 中问题行的实际 commit hash 进行验证，而不是依赖 LLM 填写的 commit
   */
  filterIssuesByValidCommits(
    issues: ReviewIssue[],
    commits: PullRequestCommit[],
    fileContents: FileContentsMap,
    verbose?: VerboseLevel,
  ): ReviewIssue[] {
    const validCommitHashes = new Set(commits.map((c) => c.sha?.slice(0, 7)).filter(Boolean));

    if (shouldLog(verbose, 3)) {
      console.log(`   🔍 有效 commit hashes: ${Array.from(validCommitHashes).join(", ")}`);
    }

    const beforeCount = issues.length;
    const filtered = issues.filter((issue) => {
      const contentLines = fileContents.get(issue.file);
      if (!contentLines) {
        // 文件不在 fileContents 中，保留 issue
        if (shouldLog(verbose, 3)) {
          console.log(`   ✅ Issue ${issue.file}:${issue.line} - 文件不在 fileContents 中，保留`);
        }
        return true;
      }

      const lineNums = this.reviewSpecService.parseLineRange(issue.line);
      if (lineNums.length === 0) {
        if (shouldLog(verbose, 3)) {
          console.log(`   ✅ Issue ${issue.file}:${issue.line} - 无法解析行号，保留`);
        }
        return true;
      }

      // 检查问题行范围内是否有任意一行属于本次 PR 的有效 commits
      for (const lineNum of lineNums) {
        const lineData = contentLines[lineNum - 1];
        if (lineData) {
          const [actualHash] = lineData;
          if (actualHash !== "-------" && validCommitHashes.has(actualHash)) {
            if (shouldLog(verbose, 3)) {
              console.log(
                `   ✅ Issue ${issue.file}:${issue.line} - 行 ${lineNum} hash=${actualHash} 匹配，保留`,
              );
            }
            return true;
          }
        }
      }

      // 问题行都不属于本次 PR 的有效 commits
      if (shouldLog(verbose, 2)) {
        console.log(`   Issue ${issue.file}:${issue.line} 不在本次 PR 变更行范围内，跳过`);
      }
      if (shouldLog(verbose, 3)) {
        const hashes = lineNums.map((ln) => {
          const ld = contentLines[ln - 1];
          return ld ? `${ln}:${ld[0]}` : `${ln}:N/A`;
        });
        console.log(`   ❌ Issue ${issue.file}:${issue.line} - 行号 hash: ${hashes.join(", ")}`);
      }
      return false;
    });
    if (beforeCount !== filtered.length && shouldLog(verbose, 1)) {
      console.log(`   过滤非本次 PR commits 问题后: ${beforeCount} -> ${filtered.length} 个问题`);
    }
    return filtered;
  }

  filterDuplicateIssues(
    newIssues: ReviewIssue[],
    existingIssues: ReviewIssue[],
  ): { filteredIssues: ReviewIssue[]; skippedCount: number } {
    // 所有历史问题（无论 valid 状态）都阻止新问题重复添加
    // valid='false' 的问题已被评审人标记为无效，不应再次报告
    // valid='true' 的问题已存在，无需重复
    // fixed 的问题已解决，无需重复
    const existingKeys = new Set(existingIssues.map((issue) => this.generateIssueKey(issue)));
    const filteredIssues = newIssues.filter(
      (issue) => !existingKeys.has(this.generateIssueKey(issue)),
    );
    const skippedCount = newIssues.length - filteredIssues.length;
    return { filteredIssues, skippedCount };
  }

  generateIssueKey(issue: ReviewIssue): string {
    return generateIssueKey(issue);
  }
}
