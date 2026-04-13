import {
  GitProviderService,
  type IConfigReader,
  type BranchProtection,
  type CiConfig,
} from "@spaceflow/core";
import { type PublishConfig } from "./publish.config";
import { MonorepoService, type PackageInfo } from "./monorepo.service";
import type { Config } from "release-it";
import { join } from "path";
import { execSync } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const releaseItModule = require("release-it") as
  | { default: (opts: Config & Record<string, unknown>) => Promise<void> }
  | ((opts: Config & Record<string, unknown>) => Promise<void>);

const releaseIt = typeof releaseItModule === "function" ? releaseItModule : releaseItModule.default;

export interface PublishOptions {
  dryRun: boolean;
  ci: boolean;
  prerelease?: string;
  /** 预演模式：执行 hooks 但不修改文件/git */
  rehearsal: boolean;
}

export interface PublishContext extends PublishOptions {
  owner: string;
  repo: string;
  branch: string;
}

export interface PublishResult {
  success: boolean;
  message: string;
  protection?: BranchProtection | null;
}

interface ReleaseItConfigOptions {
  dryRun: boolean;
  prerelease?: string;
  ci: boolean;
  /** 预演模式：执行 hooks 但不修改文件/git */
  rehearsal: boolean;
  /** 包目录（monorepo 模式）或 "."（单包模式） */
  pkgDir: string;
  /** 包名称（monorepo 模式）或 undefined（单包模式） */
  pkgName?: string;
  /** package.json 所在目录的名称，只有最后一节 */
  pkgBase: string;
  publishConf: PublishConfig;
}

export class PublishService {
  private cleanupOnExit: (() => void) | null = null;
  private uncaughtExceptionHandler: ((err: Error) => void) | null = null;
  private branchUnlocked = false;

  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
    protected readonly monorepoService: MonorepoService,
  ) {}

  getContextFromEnv(options: PublishOptions): PublishContext {
    this.gitProvider.validateConfig();

    const ciConf = this.config.get<CiConfig>("ci");
    const repository = ciConf?.repository;
    const branch = ciConf?.refName;

    if (!repository) {
      throw new Error("缺少配置 ci.repository (环境变量 GITHUB_REPOSITORY / GITEA_REPOSITORY)");
    }

    if (!branch) {
      throw new Error("缺少配置 ci.refName (环境变量 GITHUB_REF_NAME / GITEA_REF_NAME)");
    }

    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      throw new Error(`ci.repository 格式不正确，期望 "owner/repo"，实际: "${repository}"`);
    }

    return {
      owner,
      repo,
      branch,
      dryRun: options.dryRun ?? false,
      prerelease: options.prerelease,
      ci: options.ci,
      rehearsal: options.rehearsal ?? false,
    };
  }

  async execute(context: PublishContext): Promise<PublishResult> {
    const publishConf = this.config.getPluginConfig<PublishConfig>("publish");
    const monorepoConf = publishConf.monorepo;

    // CI 环境下自动 fetch tags，确保 release-it 能正确计算版本
    if (context.ci) {
      await this.ensureTagsFetched();
    }

    // 检查是否启用 monorepo 模式
    if (monorepoConf?.enabled) {
      return this.executeMonorepo(context, publishConf);
    }

    // 单包发布模式
    return this.executeSinglePackage(context, publishConf);
  }

  /**
   * Monorepo 发布模式：扫描变更包，按依赖顺序发布
   */
  private async executeMonorepo(
    context: PublishContext,
    publishConf: PublishConfig,
  ): Promise<PublishResult> {
    const { dryRun } = context;

    console.log("\n📦 Monorepo 发布模式");
    console.log("=".repeat(50));

    const propagateDeps = publishConf.monorepo?.propagateDeps ?? true;

    // 分析变更包
    const analysis = await this.monorepoService.analyze(dryRun, propagateDeps);

    if (analysis.packagesToPublish.length === 0) {
      console.log("\n✅ 没有需要发布的包");
      return { success: true, message: "没有需要发布的包" };
    }

    console.log(`\n🚀 将发布 ${analysis.packagesToPublish.length} 个包`);

    await this.handleBegin(context, publishConf);

    try {
      // 按顺序发布每个包
      for (let i = 0; i < analysis.packagesToPublish.length; i++) {
        const pkg = analysis.packagesToPublish[i];
        console.log(`\n[${i + 1}/${analysis.packagesToPublish.length}] 发布 ${pkg.name}`);
        console.log("-".repeat(40));

        await this.executePackageRelease(context, publishConf, pkg);
      }

      await this.handleEnd(context, publishConf);
      return {
        success: true,
        message: `成功发布 ${analysis.packagesToPublish.length} 个包`,
      };
    } catch (error) {
      console.error("\n❌ Monorepo 发布失败:", error instanceof Error ? error.message : error);
      try {
        await this.handleEnd(context, publishConf);
      } catch (unlockError) {
        console.error(
          "⚠️ 解锁分支失败:",
          unlockError instanceof Error ? unlockError.message : unlockError,
        );
      }
      return { success: false, message: "Monorepo 发布失败" };
    }
  }

  /**
   * 发布单个包（monorepo 模式）
   */
  private async executePackageRelease(
    context: PublishContext,
    publishConf: PublishConfig,
    pkg: PackageInfo,
  ): Promise<void> {
    const { dryRun, prerelease, ci, rehearsal } = context;

    if (rehearsal) {
      console.log(`🎭 [REHEARSAL] 将发布包: ${pkg.name} (${pkg.dir})`);
    } else if (dryRun) {
      console.log(`🔍 [DRY-RUN] 将发布包: ${pkg.name} (${pkg.dir})`);
    }

    const pkgDir = join(process.cwd(), pkg.dir);
    const originalCwd = process.cwd();

    const config = this.buildReleaseItConfig({
      dryRun,
      prerelease,
      ci,
      rehearsal,
      pkgDir,
      pkgName: pkg.name,
      pkgBase: pkg.dir.split("/").pop() || pkg.dir,
      publishConf,
    });

    // 切换到包目录运行 release-it，确保读取正确的 package.json
    process.chdir(pkgDir);
    try {
      await releaseIt(config);
      console.log(`✅ ${pkg.name} 发布完成`);
    } finally {
      // 恢复原工作目录
      process.chdir(originalCwd);
    }
  }

  /**
   * 单包发布模式
   */
  private async executeSinglePackage(
    context: PublishContext,
    publishConf: PublishConfig,
  ): Promise<PublishResult> {
    const { dryRun, prerelease, ci, rehearsal } = context;

    await this.handleBegin(context, publishConf);

    try {
      const config = this.buildReleaseItConfig({
        dryRun,
        prerelease,
        ci,
        rehearsal,
        pkgDir: process.cwd(),
        pkgBase: process.cwd().split("/").pop() || ".",
        publishConf,
      });

      await releaseIt(config);
    } catch (error) {
      console.error("执行失败:", error instanceof Error ? error.message : error);
      try {
        await this.handleEnd(context, publishConf);
      } catch (unlockError) {
        console.error(
          "⚠️ 解锁分支失败:",
          unlockError instanceof Error ? unlockError.message : unlockError,
        );
      }
      return { success: false, message: "执行失败" };
    }

    await this.handleEnd(context, publishConf);
    return { success: true, message: "执行完成", protection: null };
  }

  /**
   * 构建 release-it 配置（公共方法）
   */
  private buildReleaseItConfig(opts: ReleaseItConfigOptions): Config & Record<string, unknown> {
    const { dryRun, prerelease, ci, rehearsal, pkgName, pkgBase, publishConf } = opts;
    const changelogConf = publishConf.changelog;
    const releaseConf = publishConf.release;
    const npmConf = publishConf.npm;
    const gitConf = publishConf.git;

    // 预演模式：设置环境变量，hooks 可以通过它判断当前模式
    if (rehearsal) {
      process.env.PUBLISH_REHEARSAL = "true";
    }

    const isMonorepo = !!pkgName;
    const tagMatchOpts = !prerelease ? { tagExclude: `*[-]*` } : {};

    // monorepo: @scope/pkg@1.0.0, 单包: v1.0.0
    const tagPrefix = isMonorepo ? `${pkgName}@` : "v";
    const tagName = isMonorepo ? `${pkgName}@\${version}` : "v${version}";
    const releaseName = isMonorepo ? `${pkgName}@\${version}` : "v${version}";
    const releaseTitle = isMonorepo ? `🎉 ${pkgName}@\${version}` : "🎉 v${version}";
    // monorepo 模式下在包目录运行，git commitsPath 为 "."
    const commitsPath = ".";
    const commitMessage = isMonorepo
      ? `chore(${pkgBase}): released version \${version} [no ci]`
      : "chore: released version v${version} [no ci]";

    // 预演模式：禁用文件/git 修改，但保留 hooks
    // dryRun 模式：完全跳过所有操作（包括 hooks）
    const skipWrite = dryRun || rehearsal;

    return {
      "dry-run": dryRun,
      d: dryRun,
      ci: ci || dryRun, // dry-run 模式也启用 ci 模式，避免交互式提示
      plugins: {
        // 预演模式下禁用 changelog 写入
        ...(!skipWrite && changelogConf
          ? {
              "@release-it/conventional-changelog": {
                // 现在在包目录下运行，使用相对路径
                infile: join(
                  changelogConf.infileDir || ".",
                  `CHANGELOG${!prerelease ? "" : "-" + prerelease.toUpperCase()}.md`,
                ),
                preset: {
                  name: changelogConf.preset?.name || "conventionalcommits",
                  types: changelogConf.preset?.type || [],
                },
                // 传入 tagOpts 让 Bumper 能正确匹配 monorepo 格式的 tag（如 @scope/pkg@1.0.0）
                // 否则 Bumper 的 getSemverTags() 不带 prefix，无法识别 @scope/pkg@version 格式
                // 导致 getLastSemverTag() 返回 null，从仓库开头分析所有 commit，触发错误的 major bump
                tagOpts: {
                  prefix: tagPrefix,
                  skipUnstable: !prerelease,
                },
                // 传入 commitsOpts 限制只分析当前包目录的 commit
                // 否则 Bumper 会分析 tag..HEAD 之间所有 commit（包括其他包的 BREAKING CHANGE）
                // 导致其他包的 feat!:/BREAKING CHANGE 被误判为当前包的 major bump
                commitsOpts: {
                  path: ".",
                },
              },
            }
          : {}),
        // 预演模式下禁用 release 创建
        ...(!skipWrite && releaseConf
          ? {
              "release-it-gitea": {
                releaseTitle,
                releaseNotes: this.formatReleaseNotes,
                assets: this.buildReleaseAssets(releaseConf),
              },
            }
          : {}),
      },
      git: {
        // 预演模式：禁用 push/commit/tag
        push: !skipWrite,
        commit: !skipWrite,
        tag: !skipWrite,
        tagName,
        commitsPath,
        commitMessage,
        requireCommits: false,
        requireCommitsFail: false,
        getLatestTagFromAllRefs: true,
        requireBranch: (gitConf?.requireBranch ?? ["main", "dev", "develop"]) as any,
        requireCleanWorkingDir: !skipWrite,
        ...(isMonorepo ? { tagMatch: `${tagPrefix}*` } : {}),
        ...tagMatchOpts,
      },
      // 预演模式：禁用 npm
      // 如果使用 pnpm，禁用内置 npm 发布，但保留版本更新功能
      npm: skipWrite
        ? (false as any)
        : {
            // pnpm 模式：禁用 publish（通过 hooks 实现），但保留版本更新
            publish: npmConf?.packageManager === "pnpm" ? false : (npmConf?.publish ?? false),
            ignoreVersion: npmConf?.ignoreVersion ?? true,
            tag: prerelease || npmConf?.tag || "latest",
            versionArgs: npmConf?.versionArgs ?? ["--workspaces false"],
            publishArgs: npmConf?.publishArgs ?? [],
            ...(npmConf?.registry ? { publishConfig: { registry: npmConf.registry } } : {}),
          },
      github: {
        release: false,
        releaseName: `Release ${releaseName}`,
        autoGenerate: true,
        skipChecks: true,
        host: releaseConf?.host || "localhost",
      },
      // 合并用户 hooks 和内部 pnpm 发布 hook
      hooks: this.buildHooks({
        userHooks: publishConf.hooks,
        npmConf,
        prerelease,
        skipWrite,
        dryRun,
        rehearsal,
      }),
    };
  }

  /**
   * 格式化 release notes
   */
  private formatReleaseNotes(t: { changelog: string }): string {
    const lines = t.changelog.split("\n");
    const cateLines = lines.filter(
      (line: string) => line.startsWith("###") || line.startsWith("* "),
    );

    const cateMap: Record<string, string[]> = {};
    let currentCate = "";

    cateLines.forEach((line: string) => {
      if (line.startsWith("###")) {
        currentCate = line;
        cateMap[currentCate] = cateMap[currentCate] || [];
      } else {
        cateMap[currentCate].push(line);
      }
    });

    return Object.entries(cateMap)
      .map(([cate, catLines]) => `${cate}\n\n${catLines.join("\n")}\n`)
      .join("\n");
  }

  /**
   * 构建 release assets 配置
   */
  private buildReleaseAssets(releaseConf: NonNullable<PublishConfig["release"]>) {
    const assets = releaseConf.assetSourcemap
      ? [
          {
            path: releaseConf.assetSourcemap.path,
            name: releaseConf.assetSourcemap.name,
            type: "zip",
          },
        ]
      : [];
    return assets.concat(releaseConf.assets || []);
  }

  /**
   * 构建 hooks 配置，合并用户 hooks 和内部 pnpm 发布逻辑
   */
  private buildHooks(opts: {
    userHooks?: Record<string, string | string[]>;
    npmConf?: PublishConfig["npm"];
    prerelease?: string;
    skipWrite: boolean;
    dryRun: boolean;
    rehearsal: boolean;
  }): Record<string, string | string[]> | undefined {
    const { userHooks, npmConf, prerelease, skipWrite, dryRun, rehearsal } = opts;

    // dryRun 模式下不执行任何 hooks
    if (dryRun && !rehearsal) {
      return undefined;
    }

    // 复制用户 hooks
    let hooks: Record<string, string | string[]> = { ...userHooks };

    // rehearsal 模式下过滤 after 前缀的 hooks（不执行实际的发布后操作）
    if (rehearsal) {
      hooks = Object.fromEntries(
        Object.entries(hooks).filter(([key]) => !key.startsWith("after:")),
      );
      // rehearsal 模式下也不添加 pnpm publish
      return Object.keys(hooks).length > 0 ? hooks : undefined;
    }

    // after:bump 阶段：先重新构建（确保 DefinePlugin 注入新版本号），再发布
    if (!skipWrite) {
      const afterBumpCmds: string[] = [];

      // 1. 重新构建：版本号已更新到 package.json，重新构建使产物包含新版本
      afterBumpCmds.push("pnpm run build");

      // 2. 如果使用 pnpm 且需要发布
      if (npmConf?.packageManager === "pnpm" && npmConf?.publish) {
        const tag = prerelease || npmConf.tag || "latest";
        const publishArgs = npmConf.publishArgs ?? [];
        const registry = npmConf.registry;

        // 构建 pnpm publish 命令
        // monorepo 模式下已切换到包目录，不需要 -C 参数
        let publishCmd = `pnpm publish --tag ${tag} --no-git-checks`;
        if (registry) {
          publishCmd += ` --registry ${registry}`;
        }
        if (publishArgs.length > 0) {
          publishCmd += ` ${publishArgs.join(" ")}`;
        }
        afterBumpCmds.push(publishCmd);
      }

      // 合并到 after:bump hook
      const existingAfterBump = hooks["after:bump"];
      if (existingAfterBump) {
        const existing = Array.isArray(existingAfterBump) ? existingAfterBump : [existingAfterBump];
        hooks["after:bump"] = [...existing, ...afterBumpCmds];
      } else {
        hooks["after:bump"] = afterBumpCmds.length === 1 ? afterBumpCmds[0] : afterBumpCmds;
      }
    }

    return Object.keys(hooks).length > 0 ? hooks : undefined;
  }

  protected async handleBegin(
    context: PublishContext,
    publishConf: PublishConfig,
  ): Promise<PublishResult> {
    const { owner, repo, branch, dryRun } = context;
    const shouldLockBranch = publishConf.git?.lockBranch ?? true;

    if (!shouldLockBranch) {
      console.log(`⏭️ 跳过分支锁定（已禁用）`);
      return { success: true, message: "分支锁定已禁用", protection: null };
    }

    const pushWhitelistUsernames = [...(publishConf.git?.pushWhitelistUsernames ?? [])];

    if (dryRun) {
      console.log(`🔍 [DRY-RUN] 将锁定分支: ${owner}/${repo}#${branch}`);
      return { success: true, message: "DRY-RUN: 分支锁定已跳过", protection: null };
    }

    console.log(`🔒 正在锁定分支: ${owner}/${repo}#${branch}`);
    const protection = await this.gitProvider.lockBranch(owner, repo, branch, {
      pushWhitelistUsernames,
    });
    console.log(`✅ 分支已锁定`);
    console.log(`   规则名称: ${protection.rule_name || protection.branch_name}`);
    if (pushWhitelistUsernames?.length) {
      console.log(`   允许推送用户: ${pushWhitelistUsernames.join(", ")}`);
    } else {
      console.log(`   允许推送: ${protection.enable_push ? "是" : "否"}`);
    }

    // 注册进程退出时的清理函数，确保即使 release-it 调用 process.exit() 也能解锁分支
    this.branchUnlocked = false;
    this.cleanupOnExit = () => {
      if (this.branchUnlocked) return;
      this.branchUnlocked = true;
      console.log("\n🔓 进程退出，正在同步解锁分支...");
      try {
        this.unlockBranchSync(context, publishConf);
      } catch (e) {
        console.error("⚠️ 同步解锁分支失败:", e instanceof Error ? e.message : e);
      }
    };
    this.uncaughtExceptionHandler = (err: Error) => {
      console.error("\n❌ 未捕获的异常:", err.message);
      if (this.cleanupOnExit) this.cleanupOnExit();
      process.exit(1);
    };
    process.on("exit", this.cleanupOnExit);
    process.on("SIGINT", this.cleanupOnExit);
    process.on("SIGTERM", this.cleanupOnExit);
    process.on("uncaughtException", this.uncaughtExceptionHandler);

    return { success: true, message: "分支锁定完成", protection };
  }

  protected async handleEnd(
    context: PublishContext,
    publishConf: PublishConfig,
  ): Promise<PublishResult> {
    const { owner, repo, branch, dryRun } = context;
    const shouldLockBranch = publishConf.git?.lockBranch ?? true;

    if (!shouldLockBranch) {
      return { success: true, message: "分支锁定已禁用，无需解锁", protection: null };
    }

    if (dryRun) {
      console.log(`🔍 [DRY-RUN] 将解锁分支: ${owner}/${repo}#${branch}`);
      return { success: true, message: "DRY-RUN: 分支解锁已跳过", protection: null };
    }

    console.log(`🔓 正在解锁分支: ${owner}/${repo}#${branch}`);
    const protection = await this.gitProvider.unlockBranch(owner, repo, branch);

    // 标记已解锁，防止清理函数重复执行
    this.branchUnlocked = true;

    // 移除事件监听器
    if (this.cleanupOnExit) {
      process.removeListener("exit", this.cleanupOnExit);
      process.removeListener("SIGINT", this.cleanupOnExit);
      process.removeListener("SIGTERM", this.cleanupOnExit);
      this.cleanupOnExit = null;
    }
    if (this.uncaughtExceptionHandler) {
      process.removeListener("uncaughtException", this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = null;
    }

    if (protection) {
      console.log(`✅ 分支已解锁`);
      console.log(`   规则名称: ${protection.rule_name || protection.branch_name}`);
      console.log(`   允许推送: ${protection.enable_push ? "是" : "否"}`);
      return { success: true, message: "分支解锁完成", protection };
    } else {
      console.log(`✅ 分支本身没有保护规则，无需解锁`);
      return { success: true, message: "分支本身没有保护规则，无需解锁", protection: null };
    }
  }

  /**
   * 同步解锁分支（用于进程退出时的清理）
   */
  private unlockBranchSync(context: PublishContext, publishConf: PublishConfig): void {
    const { owner, repo, branch, dryRun } = context;
    const shouldLockBranch = publishConf.git?.lockBranch ?? true;

    if (!shouldLockBranch || dryRun) {
      return;
    }

    this.gitProvider.unlockBranchSync(owner, repo, branch);
  }

  /**
   * 确保 git tags 已获取（CI 环境中 shallow clone 可能缺失 tags）
   * 这对于 release-it 正确计算版本号至关重要
   */
  private async ensureTagsFetched(): Promise<void> {
    try {
      // 检查是否有 tags
      const existingTags = execSync("git tag --list 2>/dev/null || echo ''", {
        encoding: "utf-8",
      }).trim();

      if (!existingTags) {
        console.log("🏷️  正在获取 git tags...");
        execSync("git fetch --tags --force", { stdio: "inherit" });
        console.log("✅ Git tags 已获取");
      }
    } catch (error) {
      console.warn("⚠️ 获取 git tags 失败:", error instanceof Error ? error.message : error);
      console.warn(
        "   版本计算可能不准确，建议在 CI checkout 时添加 fetch-depth: 0 和 fetch-tags: true",
      );
    }
  }
}
