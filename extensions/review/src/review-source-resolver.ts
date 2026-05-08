import {
  GitProviderService,
  PullRequestCommit,
  ChangedFile,
  type VerboseLevel,
  shouldLog,
  GitSdkService,
  parseChangedLinesFromPatch,
} from "@spaceflow/core";
import micromatch from "micromatch";
import type { ReviewContext } from "./review-context";
import { ReviewIssueFilter } from "./review-issue-filter";
import { filterFilesByIncludes, extractGlobsFromIncludes } from "./review-includes-filter";
import { PullRequestModel } from "./pull-request-model";
import { ReviewResult, FileContentsMap, FileContentLine } from "./review-spec";
import { REVIEW_COMMENT_MARKER, REVIEW_LINE_COMMENTS_MARKER } from "./utils/review-pr-comment";
import type {
  SourceData,
  LocalFilesResult,
  PrDataResult,
  CommitsAndFiles,
} from "./types/review-source-resolver";
import { ChangedFileCollection } from "./changed-file-collection";

export type {
  SourceData,
  LocalFilesResult,
  PrDataResult,
  CommitsAndFiles,
} from "./types/review-source-resolver";

/**
 * 审查源数据解析器：根据审查模式（本地/PR/分支比较）获取 commits、changedFiles 等输入数据，
 * 并应用前置过滤管道（merge commit、files、commits、includes）。
 *
 * 从 ReviewService 中提取，职责单一化：只负责"获取和过滤源数据"，不涉及 LLM 审查、报告生成等。
 */
export class ReviewSourceResolver {
  constructor(
    private readonly gitProvider: GitProviderService,
    private readonly gitSdk: GitSdkService,
    private readonly issueFilter: ReviewIssueFilter,
  ) {}

  /**
   * 解析输入数据：根据模式（本地/PR/分支比较）获取 commits、changedFiles 等。
   * 包含前置过滤（merge commit、files、commits、includes）。
   * 如果需要提前返回（如同分支、重复 workflow），通过 earlyReturn 字段传递。
   *
   * 数据获取流程：
   *   1. 本地模式 → resolveLocalFiles（暂存区/未提交变更，无变更时回退分支比较）
   *   2. 直接文件模式（-f）→ 构造 changedFiles
   *   3. PR 模式 → resolvePrData（含重复 workflow 检查）
   *   4. 分支比较模式 → resolveBranchCompareData
   *
   * 前置过滤管道（applyPreFilters）：
   *   0. merge commit 过滤
   *   1. --files 过滤
   *   2. --commits 过滤
   *   3. --includes 过滤（支持 status| 前缀语法）
   */
  async resolve(context: ReviewContext): Promise<SourceData> {
    const { prNumber, verbose, files, localMode } = context;

    const isDirectFileMode = !!(files && files.length > 0 && !prNumber);
    let isLocalMode = !!localMode;
    let effectiveBaseRef = context.baseRef;
    let effectiveHeadRef = context.headRef;

    let prModel: PullRequestModel | undefined;
    let commits: PullRequestCommit[] = [];
    let changedFiles: ChangedFile[] = [];

    // ── 阶段 1：按模式获取 commits + changedFiles ──────────

    if (isLocalMode) {
      const local = this.resolveLocalFiles(localMode as "uncommitted" | "staged", verbose);
      if (local.earlyReturn)
        return {
          ...local.earlyReturn,
          changedFiles: ChangedFileCollection.from(local.earlyReturn.changedFiles),
          isDirectFileMode: false,
          fileContents: new Map(),
        };
      isLocalMode = local.isLocalMode;
      changedFiles = local.changedFiles;
      effectiveBaseRef = local.effectiveBaseRef ?? effectiveBaseRef;
      effectiveHeadRef = local.effectiveHeadRef ?? effectiveHeadRef;
    }

    if (isDirectFileMode) {
      // 直接文件审查模式（-f）：绕过 diff，直接按指定文件构造审查输入
      if (shouldLog(verbose, 1)) {
        console.log(`📥 直接审查指定文件模式 (${files!.length} 个文件)`);
      }
      changedFiles = files!.map((f) => ({ filename: f, status: "modified" as const }));
      isLocalMode = true;
    } else if (prNumber) {
      const prData = await this.resolvePrData(context);
      if (prData.earlyReturn) {
        return {
          ...prData,
          changedFiles: ChangedFileCollection.from(prData.changedFiles),
          headSha: prData.headSha!,
          isLocalMode,
          isDirectFileMode,
          fileContents: new Map(),
        };
      }
      prModel = prData.prModel;
      commits = prData.commits;
      changedFiles = prData.changedFiles;
    } else if (effectiveBaseRef && effectiveHeadRef) {
      if (changedFiles.length === 0) {
        const branchData = await this.resolveBranchCompareData(
          context,
          effectiveBaseRef,
          effectiveHeadRef,
        );
        commits = branchData.commits;
        changedFiles = branchData.changedFiles;
      }
    } else if (!isLocalMode) {
      if (shouldLog(verbose, 1)) {
        console.log(`❌ 错误: 缺少 prNumber 或 baseRef/headRef`, {
          prNumber,
          baseRef: context.baseRef,
          headRef: context.headRef,
        });
      }
      throw new Error("必须指定 PR 编号或者 base/head 分支");
    }

    // ── 阶段 2：前置过滤管道 ─────────────────────────────

    ({ commits, changedFiles } = await this.applyPreFilters(
      context,
      commits,
      changedFiles,
      isDirectFileMode,
    ));

    const headSha = prModel ? await prModel.getHeadSha() : context.headRef || "HEAD";
    const collectedFiles = ChangedFileCollection.from(changedFiles);
    const localContentMode = isDirectFileMode ? true : isLocalMode ? context.localMode : false;
    const fileContents = await this.getFileContents(
      context.owner,
      context.repo,
      collectedFiles.toArray(),
      commits,
      headSha,
      context.prNumber,
      localContentMode,
      context.showAll,
      context.verbose,
    );
    return {
      prModel,
      commits,
      changedFiles: collectedFiles,
      headSha,
      isLocalMode,
      isDirectFileMode,
      fileContents,
    };
  }

  // ─── 数据获取子方法 ──────────────────────────────────────

  /**
   * 本地模式：获取暂存区或未提交的变更文件。
   * 如果本地无变更，自动回退到分支比较模式并检测 base/head 分支。
   * 同分支时通过 earlyReturn 提前终止。
   */
  private resolveLocalFiles(
    localMode: "uncommitted" | "staged",
    verbose?: VerboseLevel,
  ): LocalFilesResult {
    if (shouldLog(verbose, 1)) {
      console.log(`📥 本地模式: 获取${localMode === "staged" ? "暂存区" : "未提交"}的代码变更`);
    }
    const localFiles =
      localMode === "staged" ? this.gitSdk.getStagedFiles() : this.gitSdk.getUncommittedFiles();

    if (localFiles.length === 0) {
      // 本地无变更，回退到分支比较模式
      if (shouldLog(verbose, 1)) {
        console.log(
          `ℹ️  没有${localMode === "staged" ? "暂存区" : "未提交"}的代码变更，回退到分支比较模式`,
        );
      }
      const effectiveHeadRef = this.gitSdk.getCurrentBranch() ?? "HEAD";
      const effectiveBaseRef = this.gitSdk.getDefaultBranch();
      if (shouldLog(verbose, 1)) {
        console.log(`📌 自动检测分支: base=${effectiveBaseRef}, head=${effectiveHeadRef}`);
      }
      // 同分支无法比较，提前返回
      if (effectiveBaseRef === effectiveHeadRef) {
        console.log(`ℹ️  当前分支 ${effectiveHeadRef} 与默认分支相同，没有可审查的代码变更`);
        return {
          changedFiles: [],
          isLocalMode: false,
          earlyReturn: {
            commits: [],
            changedFiles: [],
            headSha: "HEAD",
            isLocalMode: false,
            earlyReturn: { success: true, description: "", issues: [], summary: [], round: 1 },
          },
        };
      }
      return { changedFiles: [], isLocalMode: false, effectiveBaseRef, effectiveHeadRef };
    }

    // 一次性获取所有 diff，避免每个文件调用一次 git 命令
    const localDiffs =
      localMode === "staged" ? this.gitSdk.getStagedDiff() : this.gitSdk.getUncommittedDiff();
    const diffMap = new Map(localDiffs.map((d) => [d.filename, d.patch]));

    const changedFiles: ChangedFile[] = localFiles.map((f) => ({
      filename: f.filename,
      status: f.status as ChangedFile["status"],
      patch: diffMap.get(f.filename),
    }));

    if (shouldLog(verbose, 1)) {
      console.log(`   Changed files: ${changedFiles.length}`);
    }
    return { changedFiles, isLocalMode: true };
  }

  /**
   * PR 模式：获取 PR 信息、commits、changedFiles。
   * 同时检查是否有同名 review workflow 正在运行（防止重复审查）。
   */
  private async resolvePrData(context: ReviewContext): Promise<PrDataResult> {
    const { owner, repo, prNumber, verbose, ci, duplicateWorkflowResolved } = context;

    if (shouldLog(verbose, 1)) {
      console.log(`📥 获取 PR #${prNumber} 信息 (owner: ${owner}, repo: ${repo})`);
    }
    const prModel = new PullRequestModel(this.gitProvider, owner, repo, prNumber!);
    const prInfo = await prModel.getInfo();
    const commits = await prModel.getCommits();
    const changedFiles = await prModel.getFiles();
    if (shouldLog(verbose, 1)) {
      console.log(`   PR: ${prInfo?.title}`);
      console.log(`   Commits: ${commits.length}`);
      console.log(`   Changed files: ${changedFiles.length}`);
    }

    // 检查是否有其他同名 review workflow 正在运行中
    if (duplicateWorkflowResolved !== "off" && ci && prInfo?.head?.sha) {
      const duplicateResult = await this.checkDuplicateWorkflow(
        prModel,
        prInfo.head.sha,
        duplicateWorkflowResolved,
        verbose,
      );
      if (duplicateResult) {
        return {
          prModel,
          commits,
          changedFiles,
          headSha: prInfo.head.sha,
          earlyReturn: duplicateResult,
        };
      }
    }

    return { prModel, commits, changedFiles };
  }

  /**
   * 分支比较模式：获取 base...head 之间的 changedFiles 和 commits。
   */
  private async resolveBranchCompareData(
    context: ReviewContext,
    baseRef: string,
    headRef: string,
  ): Promise<CommitsAndFiles> {
    const { owner, repo, verbose } = context;

    if (shouldLog(verbose, 1)) {
      console.log(`📥 获取 ${baseRef}...${headRef} 的差异 (owner: ${owner}, repo: ${repo})`);
    }
    const changedFiles = await this.issueFilter.getChangedFilesBetweenRefs(
      owner,
      repo,
      baseRef,
      headRef,
    );
    const commits = await this.issueFilter.getCommitsBetweenRefs(baseRef, headRef);
    if (shouldLog(verbose, 1)) {
      console.log(`   Changed files: ${changedFiles.length}`);
      console.log(`   Commits: ${commits.length}`);
    }
    return { commits, changedFiles };
  }

  // ─── 前置过滤 ──────────────────────────────────────────

  /**
   * 前置过滤管道：对 commits 和 changedFiles 依次执行过滤。
   *
   * 过滤顺序：
   *   0. merge commit — 排除以 "Merge " 开头的 commit
   *   1. --files — 仅保留用户指定的文件
   *   2. --commits — 仅保留用户指定的 commit 及其涉及的文件
   *   3. --includes — glob 模式过滤文件和 commits（支持 status| 前缀语法）
   */
  private async applyPreFilters(
    context: ReviewContext,
    commits: PullRequestCommit[],
    rawChangedFiles: ChangedFile[],
    isDirectFileMode: boolean,
  ): Promise<CommitsAndFiles> {
    const {
      owner,
      repo,
      prNumber,
      verbose,
      includes,
      files,
      commits: filterCommits,
      showAll,
    } = context;
    let changedFiles = ChangedFileCollection.from(rawChangedFiles);

    // 0. 过滤掉 merge commit（showAll=false 时启用）
    if (!showAll) {
      const before = commits.length;
      const beforeFiles = changedFiles.length;
      commits = commits.filter((c) => !this.isMergeCommit(c));
      if (before !== commits.length && shouldLog(verbose, 1)) {
        console.log(`   跳过 Merge Commits: ${before} -> ${commits.length} 个`);
      }
      if (before !== commits.length) {
        const commitFilenames = await this.collectCommitFilenames(
          owner,
          repo,
          commits,
          prNumber,
        );
        changedFiles = changedFiles.filterByCommitFiles(commitFilenames);
        if (shouldLog(verbose, 1)) {
          console.log(
            `   按非 Merge Commits 过滤文件: ${beforeFiles} -> ${changedFiles.length} 个文件`,
          );
        }
      }
    } else if (shouldLog(verbose, 2)) {
      console.log(`   showAll=true，跳过 Merge Commit 过滤`);
    }

    // 1. 按指定的 files 过滤
    if (files && files.length > 0) {
      const before = changedFiles.length;
      changedFiles = changedFiles.filterByFilenames(files);
      if (shouldLog(verbose, 1)) {
        console.log(`   Files 过滤文件: ${before} -> ${changedFiles.length} 个文件`);
      }
    }

    // 2. 按指定的 commits 过滤（同时过滤文件：仅保留属于匹配 commits 的文件）
    if (filterCommits && filterCommits.length > 0) {
      const beforeCommits = commits.length;
      commits = commits.filter((c) => filterCommits.some((fc) => fc && c.sha?.startsWith(fc)));
      if (shouldLog(verbose, 1)) {
        console.log(`   Commits 过滤: ${beforeCommits} -> ${commits.length} 个`);
      }

      const beforeFiles = changedFiles.length;
      const commitFilenames = await this.collectCommitFilenames(owner, repo, commits, prNumber);
      changedFiles = changedFiles.filterByCommitFiles(commitFilenames);
      if (shouldLog(verbose, 1)) {
        console.log(`   按 Commits 过滤文件: ${beforeFiles} -> ${changedFiles.length} 个文件`);
      }
    }

    // 3. 使用 includes 过滤文件和 commits（支持 added|/modified|/deleted| 前缀语法）
    if (isDirectFileMode && includes && includes.length > 0) {
      if (shouldLog(verbose, 1)) {
        console.log(`ℹ️  直接文件模式下忽略 includes 过滤`);
      }
    } else if (includes && includes.length > 0) {
      const beforeFiles = changedFiles.length;
      if (shouldLog(verbose, 2)) {
        console.log(
          `[resolveSourceData] filterFilesByIncludes: before=${JSON.stringify(changedFiles.map((f) => ({ filename: f.filename, status: f.status })))}, includes=${JSON.stringify(includes)}`,
        );
      }
      changedFiles = ChangedFileCollection.from(
        filterFilesByIncludes(changedFiles.toArray(), includes),
      );
      if (shouldLog(verbose, 1)) {
        console.log(`   Includes 过滤文件: ${beforeFiles} -> ${changedFiles.length} 个文件`);
      }
      if (shouldLog(verbose, 2)) {
        console.log(
          `[resolveSourceData] filterFilesByIncludes: after=${JSON.stringify(changedFiles.map((f) => f.filename))}`,
        );
      }

      // 按 includes glob 过滤 commits：仅保留涉及匹配文件的 commits
      const globs = extractGlobsFromIncludes(includes);
      const beforeCommits = commits.length;
      const filteredCommits: PullRequestCommit[] = [];
      for (const commit of commits) {
        if (!commit.sha) continue;
        const commitFiles = await this.issueFilter.getFilesForCommit(
          owner,
          repo,
          commit.sha,
          prNumber,
        );
        if (micromatch.some(commitFiles, globs)) {
          filteredCommits.push(commit);
        }
      }
      commits = filteredCommits;
      if (shouldLog(verbose, 1)) {
        console.log(`   Includes 过滤 Commits: ${beforeCommits} -> ${commits.length} 个`);
      }
    }

    return { commits, changedFiles: changedFiles.toArray() };
  }

  private isMergeCommit(commit: PullRequestCommit): boolean {
    if ((commit.parents?.length ?? 0) > 1) {
      return true;
    }
    const message = commit.commit?.message || "";
    return /^merge\b/i.test(message);
  }

  private async collectCommitFilenames(
    owner: string,
    repo: string,
    commits: PullRequestCommit[],
    prNumber?: number,
  ): Promise<Set<string>> {
    const commitFilenames = new Set<string>();
    for (const commit of commits) {
      if (!commit.sha) continue;
      const commitFiles = await this.issueFilter.getFilesForCommit(
        owner,
        repo,
        commit.sha,
        prNumber,
      );
      commitFiles.forEach((f) => commitFilenames.add(f));
    }
    return commitFilenames;
  }

  // ─── 文件内容 ─────────────────────────────────────────

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
    localMode?: boolean | "uncommitted" | "staged",
    showAll?: boolean,
    verbose?: VerboseLevel,
  ): Promise<FileContentsMap> {
    const contents: FileContentsMap = new Map();
    const latestCommitHash = commits[commits.length - 1]?.sha?.slice(0, 7) || "+local+";
    const validCommitHashes = new Set(commits.map((c) => c.sha?.slice(0, 7)).filter(Boolean));
    const shouldMaskUnknownChangedLines = !showAll && validCommitHashes.size > 0;

    if (shouldLog(verbose, 1)) {
      console.log(`📊 正在构建行号到变更的映射...`);
    }

    for (const file of changedFiles) {
      if (file.filename && file.status !== "deleted") {
        try {
          let rawContent: string;
          if (localMode === "staged") {
            rawContent = this.gitSdk.getStagedFileContent(file.filename);
          } else if (localMode) {
            rawContent = this.gitSdk.getWorkingFileContent(file.filename);
          } else if (prNumber) {
            rawContent = await this.gitProvider.getFileContent(owner, repo, file.filename, ref);
          } else {
            rawContent = await this.gitSdk.getFileContent(ref, file.filename);
          }
          const lines = rawContent.split("\n");

          let changedLines = parseChangedLinesFromPatch(file.patch);

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

          let blameMap: Map<number, string> | undefined;
          if (!localMode) {
            try {
              blameMap = await this.gitSdk.getFileBlame(ref, file.filename);
            } catch {
              // blame 失败时按未知来源处理；showAll=false 时不能把未知行归到本 PR。
            }
          }

          if (shouldLog(verbose, 3)) {
            console.log(`   📄 ${file.filename}: ${lines.length} 行, ${changedLines.size} 行变更`);
            console.log(
              `      blame: ${blameMap ? `${blameMap.size} 行` : `不可用，回退到 ${latestCommitHash}`}`,
            );
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
            if (!changedLines.has(lineNum)) {
              return ["-------", line];
            }
            const blameHash = blameMap?.get(lineNum);
            if (shouldMaskUnknownChangedLines && !localMode && !blameHash) {
              if (shouldLog(verbose, 3)) {
                console.log(
                  `      行 ${lineNum}: blame 不可用或缺失，按非本次 PR 变更处理`,
                );
              }
              return ["-------", line];
            }
            const hash = blameHash ?? latestCommitHash;
            if (shouldMaskUnknownChangedLines && !validCommitHashes.has(hash)) {
              return ["-------", line];
            }
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

  // ─── 重复 workflow 检查 ──────────────────────────────────

  /**
   * 检查是否有其他同名 review workflow 正在运行中。
   * 根据 duplicateWorkflowResolved 配置决定是跳过还是删除旧评论。
   */
  private async checkDuplicateWorkflow(
    prModel: PullRequestModel,
    headSha: string,
    mode: "skip" | "delete",
    verbose?: VerboseLevel,
  ): Promise<ReviewResult | null> {
    const ref = process.env.GITHUB_REF || process.env.GITEA_REF || "";
    const prMatch = ref.match(/refs\/pull\/(\d+)/);
    const currentPrNumber = prMatch ? parseInt(prMatch[1], 10) : prModel.number;

    try {
      const runningWorkflows = await prModel.listWorkflowRuns({
        status: "in_progress",
      });
      const currentWorkflowName = process.env.GITHUB_WORKFLOW || process.env.GITEA_WORKFLOW;
      const currentRunId = process.env.GITHUB_RUN_ID || process.env.GITEA_RUN_ID;
      const duplicateReviewRuns = runningWorkflows.filter(
        (w) =>
          w.sha === headSha &&
          w.name === currentWorkflowName &&
          (!currentRunId || String(w.id) !== currentRunId),
      );
      if (duplicateReviewRuns.length > 0) {
        if (mode === "delete") {
          // 删除模式：清理旧的 AI Review 评论和 PR Review
          if (shouldLog(verbose, 1)) {
            console.log(
              `🗑️ 检测到 ${duplicateReviewRuns.length} 个同名 workflow，清理旧的 AI Review 评论...`,
            );
          }
          await this.cleanupDuplicateAiReviews(prModel, verbose);
          // 清理后继续执行当前审查
          return null;
        }

        // 跳过模式（默认）
        if (shouldLog(verbose, 1)) {
          console.log(
            `⏭️ 跳过审查: 当前 PR #${currentPrNumber} 有 ${duplicateReviewRuns.length} 个同名 workflow 正在运行中`,
          );
        }
        return {
          success: true,
          description: `跳过审查: PR #${currentPrNumber} 有 ${duplicateReviewRuns.length} 个同名 workflow 正在运行中，等待完成后重新审查`,
          issues: [],
          summary: [],
          round: 1,
        };
      }
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn(
          `⚠️ 无法检查重复 workflow（可能缺少 repo owner 权限），跳过此检查:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    return null;
  }

  /**
   * 清理重复的 AI Review 评论（Issue Comments 和 PR Reviews）
   */
  private async cleanupDuplicateAiReviews(
    prModel: PullRequestModel,
    verbose?: VerboseLevel,
  ): Promise<void> {
    try {
      // 删除 Issue Comments（主评论）
      const comments = await prModel.getComments();
      const aiComments = comments.filter((c) => c.body?.includes(REVIEW_COMMENT_MARKER));
      let deletedComments = 0;
      for (const comment of aiComments) {
        if (comment.id) {
          try {
            await prModel.deleteComment(comment.id);
            deletedComments++;
          } catch {
            // 忽略删除失败
          }
        }
      }
      if (deletedComments > 0 && shouldLog(verbose, 1)) {
        console.log(`   已删除 ${deletedComments} 个重复的 AI Review 主评论`);
      }

      // 删除 PR Reviews（行级评论）
      const reviews = await prModel.getReviews();
      const aiReviews = reviews.filter((r) => r.body?.includes(REVIEW_LINE_COMMENTS_MARKER));
      let deletedReviews = 0;
      for (const review of aiReviews) {
        if (review.id) {
          try {
            await prModel.deleteReview(review.id);
            deletedReviews++;
          } catch {
            // 已提交的 review 无法删除，忽略
          }
        }
      }
      if (deletedReviews > 0 && shouldLog(verbose, 1)) {
        console.log(`   已删除 ${deletedReviews} 个重复的 AI Review PR Review`);
      }
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.warn(`⚠️ 清理旧评论失败:`, error instanceof Error ? error.message : error);
      }
    }
  }
}
