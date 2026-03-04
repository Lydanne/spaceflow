import { execSync } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { shouldLog, type VerboseLevel, t } from "@spaceflow/core";
import { getExtensionDependencies } from "@spaceflow/core";
import type { ExtensionConfig } from "../install/install.service";

export interface UpdateOptions {
  name?: string;
  self?: boolean;
  verbose?: VerboseLevel;
}

export class UpdateService {
  protected getPackageManager(): string {
    const cwd = process.cwd();

    if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
      try {
        execSync("pnpm --version", { stdio: "ignore" });
        return "pnpm";
      } catch {
        // pnpm 不可用
      }
    }

    if (existsSync(join(cwd, "yarn.lock"))) {
      try {
        execSync("yarn --version", { stdio: "ignore" });
        return "yarn";
      } catch {
        // yarn 不可用
      }
    }

    return "npm";
  }

  protected isPnpmWorkspace(): boolean {
    return existsSync(join(process.cwd(), "pnpm-workspace.yaml"));
  }

  isGitUrl(source: string): boolean {
    return (
      source.startsWith("git@") ||
      (source.startsWith("https://") && source.endsWith(".git")) ||
      source.endsWith(".git")
    );
  }

  isLocalPath(source: string): boolean {
    return (
      source.startsWith("./") ||
      source.startsWith("../") ||
      source.startsWith("/") ||
      source.startsWith("skills/")
    );
  }

  getSourceType(source: string): "npm" | "git" | "local" {
    if (this.isLocalPath(source)) return "local";
    if (this.isGitUrl(source)) return "git";
    return "npm";
  }

  parseExtensionConfig(config: ExtensionConfig): { source: string; ref?: string } {
    if (typeof config === "string") {
      return { source: config };
    }
    return { source: config.source, ref: config.ref };
  }

  async getLatestNpmVersion(packageName: string): Promise<string | null> {
    try {
      const result = execSync(`npm view ${packageName} version`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return result;
    } catch {
      return null;
    }
  }

  async getCurrentNpmVersion(packageName: string): Promise<string | null> {
    const packageJsonPath = join(process.cwd(), "package.json");

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const content = await readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      const version = pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName];
      if (version) {
        return version.replace(/^[\^~>=<]+/, "");
      }
      return null;
    } catch {
      return null;
    }
  }

  async updateNpmPackage(packageName: string, verbose: VerboseLevel = 1): Promise<boolean> {
    const pm = this.getPackageManager();
    const latestVersion = await this.getLatestNpmVersion(packageName);
    const currentVersion = await this.getCurrentNpmVersion(packageName);

    if (!latestVersion) {
      if (shouldLog(verbose, 1)) console.log(t("update:cannotGetLatest", { package: packageName }));
      return false;
    }

    if (currentVersion === latestVersion) {
      if (shouldLog(verbose, 1))
        console.log(t("update:alreadyLatest", { package: packageName, version: currentVersion }));
      return true;
    }

    if (shouldLog(verbose, 1)) {
      console.log(
        t("update:versionChange", {
          package: packageName,
          current: currentVersion || t("update:unknown"),
          latest: latestVersion,
        }),
      );
    }

    let cmd: string;
    if (pm === "pnpm") {
      cmd = this.isPnpmWorkspace()
        ? `pnpm add -wD ${packageName}@latest`
        : `pnpm add -D ${packageName}@latest`;
    } else if (pm === "yarn") {
      cmd = `yarn add -D ${packageName}@latest`;
    } else {
      cmd = `npm install -D ${packageName}@latest`;
    }

    try {
      execSync(cmd, {
        cwd: process.cwd(),
        stdio: verbose ? "inherit" : "pipe",
      });
      return true;
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.error(
          t("update:npmUpdateFailed", { package: packageName }),
          error instanceof Error ? error.message : error,
        );
      }
      return false;
    }
  }

  async updateGitRepo(depPath: string, name: string, verbose: VerboseLevel = 1): Promise<boolean> {
    const gitDir = join(depPath, ".git");

    if (!existsSync(gitDir)) {
      if (shouldLog(verbose, 1)) {
        console.log(t("update:notGitRepo", { name }));
        console.log(t("update:reinstallHint"));
      }
      return false;
    }

    try {
      if (shouldLog(verbose, 1)) console.log(t("update:pullingLatest"));
      execSync("git pull", {
        cwd: depPath,
        stdio: verbose ? "inherit" : "pipe",
      });
      return true;
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.error(
          t("update:gitUpdateFailed", { name }),
          error instanceof Error ? error.message : error,
        );
      }
      return false;
    }
  }

  /**
   * 检测 CLI 的安装方式
   * 返回: { isGlobal: boolean, pm: 'pnpm' | 'npm' | 'yarn', cwd?: string }
   */
  protected detectCliInstallation(): { isGlobal: boolean; pm: string; cwd?: string } {
    try {
      // 获取当前执行的 CLI 路径
      const cliPath = process.argv[1];

      // 检查是否在 node_modules 中（本地安装）
      if (cliPath.includes("node_modules")) {
        // 提取项目根目录（node_modules 的父目录）
        const nodeModulesIndex = cliPath.indexOf("node_modules");
        const projectRoot = cliPath.substring(0, nodeModulesIndex - 1);

        // 检测项目使用的包管理器
        let pm = "npm";
        if (existsSync(join(projectRoot, "pnpm-lock.yaml"))) {
          pm = "pnpm";
        } else if (existsSync(join(projectRoot, "yarn.lock"))) {
          pm = "yarn";
        }

        return { isGlobal: false, pm, cwd: projectRoot };
      }

      // 检查是否是全局安装
      // 尝试检测 pnpm 全局
      try {
        const pnpmGlobalDir = execSync("pnpm root -g", {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (cliPath.startsWith(pnpmGlobalDir) || cliPath.includes(".pnpm")) {
          return { isGlobal: true, pm: "pnpm" };
        }
      } catch {
        // pnpm 不可用
      }

      // 尝试检测 npm 全局
      try {
        const npmGlobalDir = execSync("npm root -g", {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (cliPath.startsWith(npmGlobalDir)) {
          return { isGlobal: true, pm: "npm" };
        }
      } catch {
        // npm 不可用
      }

      // 默认认为是全局安装
      return { isGlobal: true, pm: "npm" };
    } catch {
      return { isGlobal: true, pm: "npm" };
    }
  }

  async updateSelf(verbose: VerboseLevel = 1): Promise<boolean> {
    if (shouldLog(verbose, 1)) console.log(t("update:updatingCli"));

    const cliPackageName = "@spaceflow/cli";
    const installation = this.detectCliInstallation();

    if (shouldLog(verbose, 1)) {
      console.log(
        t("update:installMethod", {
          method: installation.isGlobal ? t("update:installGlobal") : t("update:installLocal"),
          pm: installation.pm,
        }),
      );
    }

    try {
      if (installation.isGlobal) {
        // 全局安装：使用对应包管理器的全局更新命令
        const cmd =
          installation.pm === "pnpm"
            ? `pnpm update -g ${cliPackageName}`
            : installation.pm === "yarn"
              ? `yarn global upgrade ${cliPackageName}`
              : `npm update -g ${cliPackageName}`;

        if (shouldLog(verbose, 1)) console.log(t("update:executing", { cmd }));
        execSync(cmd, { stdio: verbose ? "inherit" : "pipe" });
      } else {
        // 本地安装：在项目目录中更新
        const cwd = installation.cwd || process.cwd();
        let cmd: string;

        if (installation.pm === "pnpm") {
          const isPnpmWorkspace = existsSync(join(cwd, "pnpm-workspace.yaml"));
          cmd = isPnpmWorkspace
            ? `pnpm add -wD ${cliPackageName}@latest`
            : `pnpm add -D ${cliPackageName}@latest`;
        } else if (installation.pm === "yarn") {
          cmd = `yarn add -D ${cliPackageName}@latest`;
        } else {
          cmd = `npm install -D ${cliPackageName}@latest`;
        }

        if (shouldLog(verbose, 1)) console.log(t("update:executing", { cmd }));
        execSync(cmd, { cwd, stdio: verbose ? "inherit" : "pipe" });
      }

      if (shouldLog(verbose, 1)) console.log(t("update:cliUpdateDone"));
      return true;
    } catch (error) {
      if (shouldLog(verbose, 1)) {
        console.error(t("update:cliUpdateFailed"), error instanceof Error ? error.message : error);
      }
      return false;
    }
  }

  async updateDependency(name: string, verbose: VerboseLevel = 1): Promise<boolean> {
    const cwd = process.cwd();
    const dependencies = getExtensionDependencies(cwd);

    if (!dependencies[name]) {
      if (shouldLog(verbose, 1)) console.log(t("update:depNotFound", { name }));
      return false;
    }

    const { source } = this.parseExtensionConfig(dependencies[name] as ExtensionConfig);
    const sourceType = this.getSourceType(source);

    if (shouldLog(verbose, 1)) console.log(t("update:updating", { name }));

    if (sourceType === "npm") {
      return this.updateNpmPackage(source, verbose);
    } else if (sourceType === "git") {
      const depPath = join(cwd, ".spaceflow", "deps", name);
      return this.updateGitRepo(depPath, name, verbose);
    } else {
      if (shouldLog(verbose, 1)) console.log(t("update:localNoUpdate"));
      return true;
    }
  }

  async updateAll(verbose: VerboseLevel = 1): Promise<void> {
    const cwd = process.cwd();
    const dependencies = getExtensionDependencies(cwd);

    if (Object.keys(dependencies).length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("update:noDeps"));
      return;
    }

    if (shouldLog(verbose, 1)) {
      console.log(t("update:updatingAll", { count: Object.keys(dependencies).length }));
    }

    let successCount = 0;
    let failCount = 0;

    for (const [name, config] of Object.entries(dependencies) as [string, ExtensionConfig][]) {
      const { source } = this.parseExtensionConfig(config);
      const sourceType = this.getSourceType(source);

      console.log(`\n📦 ${name}`);

      let success = false;
      if (sourceType === "npm") {
        success = await this.updateNpmPackage(source, verbose);
      } else if (sourceType === "git") {
        const depPath = join(cwd, ".spaceflow", "deps", name);
        success = await this.updateGitRepo(depPath, name, verbose);
      } else {
        if (shouldLog(verbose, 1)) console.log(t("update:localNoUpdate"));
        success = true;
      }

      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log("\n" + t("update:updateComplete", { success: successCount, fail: failCount }));
  }
}
