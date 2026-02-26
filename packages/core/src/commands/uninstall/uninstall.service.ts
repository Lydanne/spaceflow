import { execSync } from "child_process";
import { readFile, rm } from "fs/promises";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { shouldLog, type VerboseLevel, t } from "@spaceflow/core";
import { getEditorDirName } from "@spaceflow/core";
import { detectPackageManager } from "@spaceflow/core";
import { getSpaceflowDir } from "@spaceflow/core";
import { getConfigPath, getSupportedEditors, removeDependency } from "@spaceflow/core";

export class UninstallService {
  /**
   * 从 .spaceflow/node_modules/ 目录卸载 Extension
   * 所有类型的 Extension 都通过 pnpm remove 卸载
   */
  private async uninstallExtension(
    name: string,
    isGlobal: boolean = false,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const spaceflowDir = getSpaceflowDir(isGlobal);

    if (shouldLog(verbose, 1)) {
      console.log(t("uninstall:uninstallingExtension", { name }));
      console.log(t("uninstall:targetDir", { dir: spaceflowDir }));
    }

    const pm = detectPackageManager(spaceflowDir);
    let cmd: string;
    if (pm === "pnpm") {
      cmd = `pnpm remove --prefix "${spaceflowDir}" ${name}`;
    } else {
      cmd = `npm uninstall --prefix "${spaceflowDir}" ${name}`;
    }

    try {
      execSync(cmd, {
        cwd: process.cwd(),
        stdio: verbose ? "inherit" : "pipe",
      });
    } catch {
      if (shouldLog(verbose, 1)) console.warn(t("uninstall:extensionUninstallFailed", { name }));
    }
  }

  /**
   * 执行卸载
   */
  async execute(name: string, isGlobal = false, verbose: VerboseLevel = 1): Promise<void> {
    if (shouldLog(verbose, 1)) {
      if (isGlobal) {
        console.log(t("uninstall:uninstallingGlobal", { name }));
      } else {
        console.log(t("uninstall:uninstalling", { name }));
      }
    }

    const cwd = process.cwd();
    const configPath = getConfigPath(cwd);

    // 1. 读取配置获取 source
    const dependencies = await this.parseSkillsFromConfig(configPath);
    let actualName = name;
    let config = dependencies[name];

    // 如果通过 name 找不到，尝试通过 source 值查找（支持 @spaceflow/review 这样的 npm 包名）
    if (!config) {
      for (const [key, value] of Object.entries(dependencies)) {
        if (value === name) {
          actualName = key;
          config = value;
          if (shouldLog(verbose, 1)) console.log(t("uninstall:foundDependency", { key, value }));
          break;
        }
      }
    }

    if (!config && !isGlobal) {
      throw new Error(t("uninstall:notRegistered", { name }));
    }

    // 使用实际的 name 进行后续操作
    name = actualName;

    // 2. 从 .spaceflow/node_modules/ 卸载 Extension
    await this.uninstallExtension(name, isGlobal, verbose);

    // 3. 删除各个编辑器 commands/skills 中的复制文件
    const editors = getSupportedEditors(cwd);
    const home = process.env.HOME || process.env.USERPROFILE || "~";

    for (const editor of editors) {
      const editorDirName = getEditorDirName(editor);
      const installRoot = isGlobal ? join(home, editorDirName) : join(cwd, editorDirName);
      await this.removeEditorFiles(installRoot, name, verbose);
    }

    // 4. 从配置文件中移除（仅本地安装）
    if (!isGlobal && config) {
      this.removeFromConfig(name, cwd, verbose);
    }

    if (shouldLog(verbose, 1)) console.log(t("uninstall:uninstallDone"));
  }

  /**
   * 删除编辑器目录中的 commands/skills 文件
   * install 现在是复制文件到编辑器目录，所以卸载时需要删除这些复制的文件/目录
   */
  private async removeEditorFiles(
    installRoot: string,
    name: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    // 删除 skills 目录中的文件
    const skillsDir = join(installRoot, "skills");
    if (existsSync(skillsDir)) {
      const entries = readdirSync(skillsDir);
      for (const entry of entries) {
        // 匹配 name 或 name-xxx 格式
        if (entry === name || entry.startsWith(`${name}-`)) {
          const targetPath = join(skillsDir, entry);
          if (shouldLog(verbose, 1)) console.log(t("uninstall:deletingSkill", { entry }));
          await rm(targetPath, { recursive: true, force: true });
        }
      }
    }

    // 删除 commands 目录中的 .md 文件
    const commandsDir = join(installRoot, "commands");
    if (existsSync(commandsDir)) {
      const entries = readdirSync(commandsDir);
      for (const entry of entries) {
        // 匹配 name.md 或 name-xxx.md 格式
        if (entry === `${name}.md` || entry.startsWith(`${name}-`)) {
          const targetPath = join(commandsDir, entry);
          if (shouldLog(verbose, 1)) console.log(t("uninstall:deletingCommand", { entry }));
          await rm(targetPath, { force: true });
        }
      }
    }
  }

  /**
   * 从配置文件解析 dependencies
   */
  private async parseSkillsFromConfig(configPath: string): Promise<Record<string, unknown>> {
    try {
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      return config.dependencies || {};
    } catch {
      return {};
    }
  }

  /**
   * 从配置文件中移除依赖
   */
  private removeFromConfig(name: string, cwd: string, verbose: VerboseLevel = 1): void {
    const removed = removeDependency(name, cwd);
    if (removed && shouldLog(verbose, 1)) {
      console.log(t("uninstall:configUpdated", { path: getConfigPath(cwd) }));
    }
  }
}
