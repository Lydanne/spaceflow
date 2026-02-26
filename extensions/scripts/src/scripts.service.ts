import { GitProviderService, type BranchProtection, type CiConfig } from "@spaceflow/core";
import type { IConfigReader } from "@spaceflow/core";

export interface ScriptsOptions {
  dryRun: boolean;
}

// 定义常量表示进程退出码
const PROCESS_EXIT_CODE_ERROR = 1;
export interface ScriptsContext extends ScriptsOptions {
  owner: string;
  repo: string;
  branch: string;
}

export interface ScriptsResult {
  success: boolean;
  message: string;
  protection?: BranchProtection | null;
}

export class ScriptsService {
  constructor(
    protected readonly gitProvider: GitProviderService,
    protected readonly config: IConfigReader,
  ) {}

  getContextFromEnv(options: ScriptsOptions): ScriptsContext {
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

  async execute(context: ScriptsContext, script: string): Promise<void> {
    try {
      // 1. 锁定分支
      await this.handleBegin(context);

      try {
        // 2. 执行脚本
        console.log(`🏃 正在执行脚本...`);
        console.log(`> ${script}`);

        // 包装在 async IIFE 中以支持 await
        const asyncScript = `(async () => { ${script} })()`;

        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
        const result = eval(asyncScript);

        if (result instanceof Promise) {
          await result;
        }

        console.log("✅ 脚本执行成功");
      } catch (error) {
        console.error("❌ 脚本执行失败:", error);
        // 出错时也要尝试解锁
        await this.handleEnd(context);
        process.exit(PROCESS_EXIT_CODE_ERROR);
      }

      // 3. 解锁分支
      await this.handleEnd(context);
    } catch (error) {
      console.error("执行失败:", error instanceof Error ? error.message : error);
      process.exit(PROCESS_EXIT_CODE_ERROR);
    }
  }

  protected async handleBegin(context: ScriptsContext): Promise<ScriptsResult> {
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

  protected async handleEnd(context: ScriptsContext): Promise<ScriptsResult> {
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
