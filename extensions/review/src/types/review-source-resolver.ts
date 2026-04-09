import type { PullRequestCommit, ChangedFile } from "@spaceflow/core";
import type { PullRequestModel } from "../pull-request-model";
import type { ReviewResult, FileContentsMap } from "../review-spec";
import type { ChangedFileCollection } from "../changed-file-collection";

/**
 * resolve() 的最终返回类型。
 * 包含从各模式（本地/PR/分支比较）解析出的 commits、changedFiles 等源数据。
 */
export interface SourceData {
  prModel?: PullRequestModel;
  commits: PullRequestCommit[];
  changedFiles: ChangedFileCollection;
  headSha: string;
  isLocalMode: boolean;
  isDirectFileMode: boolean;
  fileContents: FileContentsMap;
  earlyReturn?: ReviewResult;
}

/** commits + changedFiles 的基础组合，用于分支比较 / 前置过滤返回 */
export interface CommitsAndFiles {
  commits: PullRequestCommit[];
  changedFiles: ChangedFile[];
}

/**
 * resolveLocalFiles 的返回类型。
 * 本地模式无变更时回退到分支比较，通过 earlyReturn 提前终止。
 */
export interface LocalFilesResult {
  changedFiles: ChangedFile[];
  isLocalMode: boolean;
  effectiveBaseRef?: string;
  effectiveHeadRef?: string;
  earlyReturn?: {
    commits: PullRequestCommit[];
    changedFiles: ChangedFile[];
    headSha: string;
    isLocalMode: boolean;
    earlyReturn: ReviewResult;
  };
}

/**
 * resolvePrData 的返回类型。
 * PR 模式获取到的数据，含可选的 earlyReturn（重复 workflow 检测时触发）。
 */
export interface PrDataResult {
  prModel: PullRequestModel;
  commits: PullRequestCommit[];
  changedFiles: ChangedFile[];
  headSha?: string;
  earlyReturn?: ReviewResult;
}
