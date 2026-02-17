import { GitProviderService, BranchProtection, CiConfig } from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";
import { execSync } from "child_process";

export interface ShellOptions {
  dryRun: boolean;
}

export interface ShellContext extends ShellOptions {
  owner: string;
  repo: string;
  branch: string;
}

export interface ShellResult {
  success: boolean;
  message: string;
  protection?: BranchProtection | null;
}

export class ShellService {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
  ) {}

  getContextFromEnv(options: ShellOptions): ShellContext {
    this.gitProvider.validateConfig();

    const ciConf = this.config.get<CiConfig>("ci");
    const repository = ciConf?.repository;
    const branch = ciConf?.refName;

    if (!repository) {
      throw new Error("缺少配置 ci.repository (环境变量 GITHUB_REPOSITORY)");
    }

    if (!branch) {
      throw new Error("缺少配置 ci.refName (环境变量 GITHUB_REF_NAME)");
    }

    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      throw new Error(`ci.repository 格式不正确，期望 "owner/repo"，实际: "${repository}"`);
    }

    return {
      owner,
      repo,
      branch,
      ...options,
    };
  }

  async execute(context: ShellContext, command: string): Promise<void> {
    try {
      // 1. 锁定分支
      await this.handleBegin(context);

      try {
        // 2. 执行命令
        console.log(`🏃 正在执行命令...`);
        console.log(`> ${command}`);

        if (context.dryRun) {
          console.log(`🔍 [DRY-RUN] 跳过命令执行`);
        } else {
          execSync(command, { stdio: "inherit" });
        }

        console.log("✅ 命令执行成功");
      } catch (error) {
        console.error("❌ 命令执行失败:", error);
        // 出错时也要尝试解锁
        await this.handleEnd(context);
        process.exit(1);
      }

      // 3. 解锁分支
      await this.handleEnd(context);
    } catch (error) {
      console.error("执行失败:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  protected async handleBegin(context: ShellContext): Promise<ShellResult> {
    const { owner, repo, branch, dryRun } = context;

    if (dryRun) {
      console.log(`🔍 [DRY-RUN] 将锁定分支: ${owner}/${repo}#${branch}`);
      return {
        success: true,
        message: "DRY-RUN: 分支锁定已跳过",
        protection: null,
      };
    }

    console.log(`🔒 正在锁定分支: ${owner}/${repo}#${branch}`);

    const protection = await this.gitProvider.lockBranch(owner, repo, branch);

    console.log(`✅ 分支已锁定`);
    console.log(`   规则名称: ${protection.rule_name || protection.branch_name}`);
    console.log(`   允许推送: ${protection.enable_push ? "是" : "否"}`);

    return {
      success: true,
      message: "分支锁定完成",
      protection,
    };
  }

  protected async handleEnd(context: ShellContext): Promise<ShellResult> {
    const { owner, repo, branch, dryRun } = context;

    if (dryRun) {
      console.log(`🔍 [DRY-RUN] 将解锁分支: ${owner}/${repo}#${branch}`);
      return {
        success: true,
        message: "DRY-RUN: 分支解锁已跳过",
        protection: null,
      };
    }

    console.log(`🔓 正在解锁分支: ${owner}/${repo}#${branch}`);

    const protection = await this.gitProvider.unlockBranch(owner, repo, branch);

    if (protection) {
      console.log(`✅ 分支已解锁`);
      console.log(`   规则名称: ${protection.rule_name || protection.branch_name}`);
      console.log(`   允许推送: ${protection.enable_push ? "是" : "否"}`);

      return {
        success: true,
        message: "分支解锁完成",
        protection,
      };
    } else {
      console.log(`✅ 分支本身没有保护规则，无需解锁`);

      return {
        success: true,
        message: "分支本身没有保护规则，无需解锁",
        protection: null,
      };
    }
  }
}
