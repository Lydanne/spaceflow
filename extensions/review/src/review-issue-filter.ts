import {
  GitProviderService,
  PullRequestCommit,
  ChangedFile,
  type VerboseLevel,
  shouldLog,
  GitSdkService,
  parseChangedLinesFromPatch,
  parseDiffText,
  parseHunksFromPatch,
  calculateNewLineNumber,
} from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { PullRequestModel } from "./pull-request-model";
import {
  ReviewSpecService,
  ReviewSpec,
  ReviewIssue,
  FileContentsMap,
  FileContentLine,
} from "./review-spec";
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
   * 如果传入 preloaded（specs/fileContents），直接使用；否则从 PR 获取
   */
  async verifyAndUpdateIssues(
    context: ReviewContext,
    issues: ReviewIssue[],
    commits: PullRequestCommit[],
    preloaded?: { specs: ReviewSpec[]; fileContents: FileContentsMap },
    pr?: PullRequestModel,
  ): Promise<ReviewIssue[]> {
    const { llmMode, specSources, verbose } = context;
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

    if (!preloaded && (!specSources?.length || !pr)) {
      if (shouldLog(verbose, 1)) {
        console.log(`   ⏭️  跳过 LLM 验证（缺少 specSources 或 pr）`);
      }
      return issues;
    }

    if (shouldLog(verbose, 1)) {
      console.log(`\n🔍 开始 LLM 验证 ${unfixedIssues.length} 个未修复问题...`);
    }

    let specs: ReviewSpec[];
    let fileContents: FileContentsMap;

    if (preloaded) {
      specs = preloaded.specs;
      fileContents = preloaded.fileContents;
    } else {
      const changedFiles = await pr!.getFiles();
      const headSha = await pr!.getHeadSha();
      specs = await this.loadSpecs(specSources, verbose);
      fileContents = await this.getFileContents(
        pr!.owner,
        pr!.repo,
        changedFiles,
        commits,
        headSha,
        pr!.number,
        verbose,
      );
    }

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

  /**
   * 获取文件内容并构建行号到 commit hash 的映射
   * 返回 Map<filename, Array<[commitHash, lineCode]>>
   */
  async getFileContents(
    owner: string,
    repo: string,
    changedFiles: ChangedFile[],
    commits: PullRequestCommit[],
    ref: string,
    prNumber?: number,
    verbose?: VerboseLevel,
    isLocalMode?: boolean,
  ): Promise<FileContentsMap> {
    const contents: FileContentsMap = new Map();
    const latestCommitHash = commits[commits.length - 1]?.sha?.slice(0, 7) || "+local+";

    // 优先使用 changedFiles 中的 patch 字段（来自 PR 的整体 diff base...head）
    // 这样行号是相对于最终文件的，而不是每个 commit 的父 commit
    // buildLineCommitMap 遍历每个 commit 的 diff，行号可能与最终文件不一致
    if (shouldLog(verbose, 1)) {
      console.log(`📊 正在构建行号到变更的映射...`);
    }

    for (const file of changedFiles) {
      if (file.filename && file.status !== "deleted") {
        try {
          let rawContent: string;
          if (isLocalMode) {
            // 本地模式：读取工作区文件的当前内容
            rawContent = this.gitSdk.getWorkingFileContent(file.filename);
          } else if (prNumber) {
            rawContent = await this.gitProvider.getFileContent(owner, repo, file.filename, ref);
          } else {
            rawContent = await this.gitSdk.getFileContent(ref, file.filename);
          }
          const lines = rawContent.split("\n");

          // 优先使用 file.patch（PR 整体 diff），这是相对于最终文件的行号
          let changedLines = parseChangedLinesFromPatch(file.patch);

          // 如果 changedLines 为空，需要判断是否应该将所有行标记为变更
          // 情况1: 文件是新增的（status 为 added/A）
          // 情况2: patch 为空但文件有 additions（部分 Git Provider API 可能不返回完整 patch）
          const isNewFile =
            file.status === "added" ||
            file.status === "A" ||
            (file.additions && file.additions > 0 && file.deletions === 0 && !file.patch);
          if (changedLines.size === 0 && isNewFile) {
            changedLines = new Set(lines.map((_, i) => i + 1));
            if (shouldLog(verbose, 2)) {
              console.log(
                `   ℹ️ ${file.filename}: 新增文件无 patch，将所有 ${lines.length} 行标记为变更`,
              );
            }
          }

          if (shouldLog(verbose, 3)) {
            console.log(`   📄 ${file.filename}: ${lines.length} 行, ${changedLines.size} 行变更`);
            console.log(`      latestCommitHash: ${latestCommitHash}`);
            if (changedLines.size > 0 && changedLines.size <= 20) {
              console.log(
                `      变更行号: ${Array.from(changedLines)
                  .sort((a, b) => a - b)
                  .join(", ")}`,
              );
            } else if (changedLines.size > 20) {
              console.log(`      变更行号: (共 ${changedLines.size} 行，省略详情)`);
            }
            if (!file.patch) {
              console.log(
                `      ⚠️ 该文件没有 patch 信息 (status=${file.status}, additions=${file.additions}, deletions=${file.deletions})`,
              );
            } else {
              console.log(
                `      patch 前 200 字符: ${file.patch.slice(0, 200).replace(/\n/g, "\\n")}`,
              );
            }
          }

          const contentLines: FileContentLine[] = lines.map((line, index) => {
            const lineNum = index + 1;
            // 如果该行在 PR 的整体 diff 中被标记为变更，则使用最新 commit hash
            const hash = changedLines.has(lineNum) ? latestCommitHash : "-------";
            return [hash, line];
          });
          contents.set(file.filename, contentLines);
        } catch (error) {
          console.warn(`警告: 无法获取文件内容: ${file.filename}`, error);
        }
      }
    }

    if (shouldLog(verbose, 1)) {
      console.log(`📊 映射构建完成，共 ${contents.size} 个文件`);
    }
    return contents;
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
   * 根据代码变更更新历史 issue 的行号
   * 当代码发生变化时，之前发现的 issue 行号可能已经不准确
   * 此方法通过分析 diff 来计算新的行号
   */
  updateIssueLineNumbers(
    issues: ReviewIssue[],
    filePatchMap: Map<string, string>,
    verbose?: VerboseLevel,
  ): ReviewIssue[] {
    let updatedCount = 0;
    let invalidatedCount = 0;
    const updatedIssues = issues.map((issue) => {
      // 如果 issue 已修复、已解决或无效，不需要更新行号
      if (issue.fixed || issue.resolved || issue.valid === "false") {
        return issue;
      }

      const patch = filePatchMap.get(issue.file);
      if (!patch) {
        // 文件没有变更，行号不变
        return issue;
      }

      const lines = this.reviewSpecService.parseLineRange(issue.line);
      if (lines.length === 0) {
        return issue;
      }

      const startLine = lines[0];
      const endLine = lines[lines.length - 1];
      const hunks = parseHunksFromPatch(patch);

      // 计算新的起始行号
      const newStartLine = calculateNewLineNumber(startLine, hunks);
      if (newStartLine === null) {
        // 起始行被删除，直接标记为无效问题
        invalidatedCount++;
        if (shouldLog(verbose, 1)) {
          console.log(`📍 Issue ${issue.file}:${issue.line} 对应的代码已被删除，标记为无效`);
        }
        return { ...issue, valid: "false", originalLine: issue.originalLine ?? issue.line };
      }

      // 如果是范围行号，计算新的结束行号
      let newLine: string;
      if (startLine === endLine) {
        newLine = String(newStartLine);
      } else {
        const newEndLine = calculateNewLineNumber(endLine, hunks);
        if (newEndLine === null || newEndLine === newStartLine) {
          // 结束行被删除或范围缩小为单行，使用起始行
          newLine = String(newStartLine);
        } else {
          newLine = `${newStartLine}-${newEndLine}`;
        }
      }

      // 如果行号发生变化，更新 issue
      if (newLine !== issue.line) {
        updatedCount++;
        if (shouldLog(verbose, 1)) {
          console.log(`📍 Issue 行号更新: ${issue.file}:${issue.line} -> ${issue.file}:${newLine}`);
        }
        return { ...issue, line: newLine, originalLine: issue.originalLine ?? issue.line };
      }

      return issue;
    });

    if ((updatedCount > 0 || invalidatedCount > 0) && shouldLog(verbose, 1)) {
      const parts: string[] = [];
      if (updatedCount > 0) parts.push(`更新 ${updatedCount} 个行号`);
      if (invalidatedCount > 0) parts.push(`标记 ${invalidatedCount} 个无效`);
      console.log(`📊 Issue 行号处理: ${parts.join("，")}`);
    }

    return updatedIssues;
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

  /**
   * 构建文件行号到 commit hash 的映射
   * 遍历每个 commit，获取其修改的文件和行号
   * 优先使用 API，失败时回退到 git 命令
   */
  async buildLineCommitMap(
    owner: string,
    repo: string,
    commits: PullRequestCommit[],
    verbose?: VerboseLevel,
  ): Promise<Map<string, Map<number, string>>> {
    // Map<filename, Map<lineNumber, commitHash>>
    const fileLineMap = new Map<string, Map<number, string>>();

    // 按时间顺序遍历 commits（早的在前），后面的 commit 会覆盖前面的
    for (const commit of commits) {
      if (!commit.sha) continue;

      const shortHash = commit.sha.slice(0, 7);
      let files: Array<{ filename: string; patch: string }> = [];

      // 优先使用 getCommitDiff API 获取 diff 文本
      try {
        const diffText = await this.gitProvider.getCommitDiff(owner, repo, commit.sha);
        files = parseDiffText(diffText);
      } catch {
        // API 失败，回退到 git 命令
        files = this.gitSdk.getCommitDiff(commit.sha);
      }
      if (shouldLog(verbose, 2)) console.log(`   commit ${shortHash}: ${files.length} 个文件变更`);

      for (const file of files) {
        // 解析这个 commit 修改的行号
        const changedLines = parseChangedLinesFromPatch(file.patch);

        // 获取或创建文件的行号映射
        if (!fileLineMap.has(file.filename)) {
          fileLineMap.set(file.filename, new Map());
        }
        const lineMap = fileLineMap.get(file.filename)!;

        // 记录每行对应的 commit hash
        for (const lineNum of changedLines) {
          lineMap.set(lineNum, shortHash);
        }
      }
    }

    return fileLineMap;
  }
}
