import { Injectable } from "@nestjs/common";
import { spawn, execSync } from "child_process";
import type { GitCommit, GitChangedFile, GitDiffFile, GitRunOptions } from "./git-sdk.types";
import { mapGitStatus, parseDiffText } from "./git-sdk-diff.utils";

@Injectable()
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
