import { spawn, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { GitCommit, GitChangedFile, GitDiffFile, GitRunOptions } from "./git-sdk.types";
import { mapGitStatus, parseDiffText } from "./git-sdk-diff.utils";

/** 本地代码审查模式 */
export type LocalReviewMode = "uncommitted" | "staged" | false;

export class GitSdkService {
  protected readonly defaultOptions: GitRunOptions = {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024, // 10MB
  };

  runCommand(args: string[], options?: GitRunOptions): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    return new Promise((resolve, reject) => {
      const child = spawn("git", args, {
        cwd: opts.cwd,
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

  runCommandSync(args: string[], options?: GitRunOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    return execSync(`git ${args.join(" ")}`, {
      cwd: opts.cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: opts.maxBuffer,
    });
  }

  getRemoteUrl(options?: GitRunOptions): string | null {
    try {
      return this.runCommandSync(["remote", "get-url", "origin"], options).trim();
    } catch {
      return null;
    }
  }

  getCurrentBranch(options?: GitRunOptions): string | null {
    try {
      return this.runCommandSync(["rev-parse", "--abbrev-ref", "HEAD"], options).trim();
    } catch {
      return null;
    }
  }

  getDefaultBranch(options?: GitRunOptions): string {
    try {
      const result = this.runCommandSync(
        ["symbolic-ref", "refs/remotes/origin/HEAD"],
        options,
      ).trim();
      return result.replace("refs/remotes/origin/", "");
    } catch {
      // 回退到常见默认分支
      for (const branch of ["main", "master"]) {
        try {
          this.runCommandSync(["rev-parse", "--verify", `origin/${branch}`], options);
          return branch;
        } catch {
          continue;
        }
      }
      return "main";
    }
  }

  parseRepositoryFromRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
    const match = remoteUrl.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }

  async getChangedFilesBetweenRefs(
    baseRef: string,
    headRef: string,
    options?: GitRunOptions,
  ): Promise<GitChangedFile[]> {
    const resolvedBase = await this.resolveRef(baseRef, options);
    const resolvedHead = await this.resolveRef(headRef, options);
    const result = await this.runCommand(
      ["diff", "--name-status", `${resolvedBase}..${resolvedHead}`],
      options,
    );

    const files: GitChangedFile[] = [];
    const lines = result.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      const [status, filename] = line.split("\t");
      files.push({
        filename,
        status: mapGitStatus(status),
      });
    }

    return files;
  }

  /**
   * 获取两个 ref 之间的 diff（包含 patch 信息）
   * @param baseRef 基准 ref
   * @param headRef 目标 ref
   * @param options 运行选项
   * @returns 包含 filename 和 patch 的文件列表
   */
  async getDiffBetweenRefs(
    baseRef: string,
    headRef: string,
    options?: GitRunOptions,
  ): Promise<GitDiffFile[]> {
    const resolvedBase = await this.resolveRef(baseRef, options);
    const resolvedHead = await this.resolveRef(headRef, options);
    const result = await this.runCommand(["diff", `${resolvedBase}..${resolvedHead}`], options);

    return parseDiffText(result);
  }

  async getCommitsBetweenRefs(
    baseRef: string,
    headRef: string,
    options?: GitRunOptions,
  ): Promise<GitCommit[]> {
    const resolvedBase = await this.resolveRef(baseRef, options);
    const resolvedHead = await this.resolveRef(headRef, options);
    const result = await this.runCommand(
      ["log", "--format=%H|%s|%an|%ae|%aI", `${resolvedBase}..${resolvedHead}`],
      options,
    );

    const commits: GitCommit[] = [];
    const lines = result.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      const [sha, message, authorName, authorEmail, date] = line.split("|");
      commits.push({
        sha,
        message,
        author: {
          name: authorName,
          email: authorEmail,
          date,
        },
      });
    }

    return commits;
  }

  async getFilesForCommit(sha: string, options?: GitRunOptions): Promise<string[]> {
    const result = await this.runCommand(["show", "--name-only", "--format=", sha], options);
    return result.trim().split("\n").filter(Boolean);
  }

  async getFileContent(ref: string, filename: string, options?: GitRunOptions): Promise<string> {
    return this.runCommand(["show", `${ref}:${filename}`], options);
  }

  /**
   * 获取工作区文件的当前内容（包含未提交的修改）
   * 直接读取文件系统，而不是从 git 获取
   * @throws 如果文件不存在或无法读取
   */
  getWorkingFileContent(filename: string, options?: GitRunOptions): string {
    const cwd = options?.cwd || process.cwd();
    const filepath = path.join(cwd, filename);
    return fs.readFileSync(filepath, "utf-8");
  }

  getCommitDiff(sha: string, options?: GitRunOptions): GitDiffFile[] {
    try {
      const output = this.runCommandSync(["show", "--format=", "--patch", sha], options);
      return parseDiffText(output);
    } catch (error) {
      console.warn(`⚠️ git show 失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 获取暂存区的变更文件列表
   */
  getStagedFiles(options?: GitRunOptions): GitChangedFile[] {
    try {
      const output = this.runCommandSync(["diff", "--cached", "--name-status"], options);
      return this.parseNameStatusOutput(output);
    } catch {
      return [];
    }
  }

  /**
   * 获取暂存区的 diff（包含 patch 信息）
   */
  getStagedDiff(options?: GitRunOptions): GitDiffFile[] {
    try {
      const output = this.runCommandSync(["diff", "--cached"], options);
      return parseDiffText(output);
    } catch {
      return [];
    }
  }

  /**
   * 获取工作区未暂存的变更文件列表
   */
  getUnstagedFiles(options?: GitRunOptions): GitChangedFile[] {
    try {
      const output = this.runCommandSync(["diff", "--name-status"], options);
      return this.parseNameStatusOutput(output);
    } catch {
      return [];
    }
  }

  /**
   * 获取工作区未暂存的 diff（包含 patch 信息）
   */
  getUnstagedDiff(options?: GitRunOptions): GitDiffFile[] {
    try {
      const output = this.runCommandSync(["diff"], options);
      return parseDiffText(output);
    } catch {
      return [];
    }
  }

  /**
   * 获取所有未提交的变更文件（暂存区 + 工作区 + untracked）
   * 注意：staged 状态优先于 unstaged（因为 staged 反映了文件的原始变更类型）
   */
  getUncommittedFiles(options?: GitRunOptions): GitChangedFile[] {
    const staged = this.getStagedFiles(options);
    const unstaged = this.getUnstagedFiles(options);
    const untracked = this.getUntrackedFiles(options);

    // staged 优先：如果文件在 staged 中是 added，即使 unstaged 中是 modified，也应该保持 added
    const fileMap = new Map<string, GitChangedFile>();
    for (const file of [...unstaged, ...staged]) {
      fileMap.set(file.filename, file);
    }
    // 添加 untracked 文件
    for (const filename of untracked) {
      if (!fileMap.has(filename)) {
        fileMap.set(filename, { filename, status: "added" });
      }
    }
    return Array.from(fileMap.values());
  }

  /**
   * 获取未跟踪的文件列表
   */
  getUntrackedFiles(options?: GitRunOptions): string[] {
    try {
      const output = this.runCommandSync(["ls-files", "--others", "--exclude-standard"], options);
      return output.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 获取所有未提交的 diff（暂存区 + 工作区 + untracked）
   * 使用 HEAD 作为基准比较，untracked 文件生成伪 patch
   */
  getUncommittedDiff(options?: GitRunOptions): GitDiffFile[] {
    const diffs: GitDiffFile[] = [];

    // 1. 获取已跟踪文件的 diff（staged + unstaged）
    try {
      const output = this.runCommandSync(["diff", "HEAD"], options);
      diffs.push(...parseDiffText(output));
    } catch {
      // ignore
    }

    // 2. 为 untracked 文件生成伪 patch
    const untrackedFiles = this.getUntrackedFiles(options);
    for (const filename of untrackedFiles) {
      try {
        const content = this.getWorkingFileContent(filename, options);
        const patch = this.generateAddedFilePatch(content);
        diffs.push({ filename, patch });
      } catch {
        // 文件读取失败，跳过
      }
    }

    return diffs;
  }

  /**
   * 为新增文件生成伪 patch（所有行都是新增）
   */
  protected generateAddedFilePatch(content: string): string {
    const lines = content.split("\n");
    const lineCount = lines.length;
    const patchLines = lines.map((line) => `+${line}`);
    return `@@ -0,0 +1,${lineCount} @@\n${patchLines.join("\n")}`;
  }

  /**
   * 解析 git diff --name-status 输出
   */
  protected parseNameStatusOutput(output: string): GitChangedFile[] {
    const files: GitChangedFile[] = [];
    const lines = output.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const [status, filename] = line.split("\t");
      if (filename) {
        files.push({
          filename,
          status: mapGitStatus(status),
        });
      }
    }
    return files;
  }

  /**
   * 解析 ref，支持本地分支、远程分支、commit SHA
   * 优先级：commit SHA > 本地分支 > origin/分支 > fetch后重试 > 原始值
   */
  async resolveRef(ref: string, options?: GitRunOptions): Promise<string> {
    if (!ref) {
      throw new Error(`resolveRef: ref 参数不能为空。调用栈: ${new Error().stack}`);
    }
    if (/^[0-9a-f]{7,40}$/i.test(ref)) {
      return ref;
    }
    if (ref.startsWith("origin/")) {
      return ref;
    }
    try {
      await this.runCommand(["rev-parse", "--verify", ref], options);
      return ref;
    } catch {
      // 本地分支不存在
    }
    try {
      await this.runCommand(["rev-parse", "--verify", `origin/${ref}`], options);
      return `origin/${ref}`;
    } catch {
      // origin/分支也不存在
    }
    try {
      await this.runCommand(
        ["fetch", "origin", `${ref}:refs/remotes/origin/${ref}`, "--depth=1"],
        options,
      );
      return `origin/${ref}`;
    } catch {
      // fetch 失败
    }
    return ref;
  }
}
