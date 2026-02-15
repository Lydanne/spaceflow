import { Injectable } from "@nestjs/common";
import { readFile, rm } from "fs/promises";
import { join } from "path";
import { existsSync, readdirSync, lstatSync } from "fs";
import { shouldLog, type VerboseLevel, t } from "@spaceflow/core";
import { getEditorDirName, DEFAULT_EDITOR } from "@spaceflow/core";

@Injectable()
export class ClearService {
  /**
   * 获取支持的编辑器列表
   */
  protected async getSupportedEditors(configPath: string): Promise<string[]> {
    try {
      if (!existsSync(configPath)) return [DEFAULT_EDITOR];
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      return config.support || [DEFAULT_EDITOR];
    } catch {
      return [DEFAULT_EDITOR];
    }
  }

  /**
   * 执行清理
   */
  async execute(isGlobal = false, verbose: VerboseLevel = 1): Promise<void> {
    if (shouldLog(verbose, 1)) {
      if (isGlobal) {
        console.log(t("clear:clearingGlobal"));
      } else {
        console.log(t("clear:clearing"));
      }
    }

    const cwd = process.cwd();
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    const configPath = join(cwd, "spaceflow.json");

    // 1. 清理 .spaceflow/deps 目录
    await this.clearSpaceflowDeps(isGlobal, verbose);

    // 2. 清理各编辑器的 skills 和 commands 目录
    const editors = await this.getSupportedEditors(configPath);

    for (const editor of editors) {
      const editorDirName = getEditorDirName(editor);
      const editorRoot = isGlobal ? join(home, editorDirName) : join(cwd, editorDirName);
      await this.clearEditorDir(editorRoot, editor, verbose);
    }

    if (shouldLog(verbose, 1)) console.log(t("clear:clearDone"));
  }

  /**
   * 清理 .spaceflow 目录内部文件（保留 spaceflow.json）
   */
  private async clearSpaceflowDeps(isGlobal: boolean, verbose: VerboseLevel = 1): Promise<void> {
    const cwd = process.cwd();
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    const spaceflowRoot = isGlobal ? join(home, ".spaceflow") : join(cwd, ".spaceflow");

    if (!existsSync(spaceflowRoot)) {
      if (shouldLog(verbose, 1)) console.log(t("clear:spaceflowNotExist"));
      return;
    }

    // 需要保留的文件
    const preserveFiles = ["spaceflow.json", "package.json"];

    const entries = readdirSync(spaceflowRoot);
    const toDelete = entries.filter((entry) => !preserveFiles.includes(entry));

    if (toDelete.length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("clear:spaceflowNoClean"));
      return;
    }

    if (shouldLog(verbose, 1))
      console.log(t("clear:clearingSpaceflow", { count: toDelete.length }));

    for (const entry of toDelete) {
      const entryPath = join(spaceflowRoot, entry);
      try {
        await rm(entryPath, { recursive: true, force: true });
        if (shouldLog(verbose, 2)) console.log(t("clear:deleted", { entry }));
      } catch (error) {
        if (shouldLog(verbose, 1)) {
          console.warn(
            t("clear:deleteFailed", { entry }),
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  }

  /**
   * 清理编辑器目录下的 skills 和 commands
   */
  private async clearEditorDir(
    editorRoot: string,
    editorName: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    if (!existsSync(editorRoot)) {
      return;
    }

    // 清理 skills 目录
    const skillsDir = join(editorRoot, "skills");
    if (existsSync(skillsDir)) {
      const entries = readdirSync(skillsDir);
      if (entries.length > 0) {
        if (shouldLog(verbose, 1))
          console.log(t("clear:clearingSkills", { editor: editorName, count: entries.length }));
        for (const entry of entries) {
          const entryPath = join(skillsDir, entry);
          try {
            await rm(entryPath, { recursive: true, force: true });
            if (shouldLog(verbose, 2)) console.log(t("clear:deleted", { entry }));
          } catch (error) {
            if (shouldLog(verbose, 1)) {
              console.warn(
                t("clear:deleteFailed", { entry }),
                error instanceof Error ? error.message : error,
              );
            }
          }
        }
      }
    }

    // 清理 commands 目录中的 .md 文件
    const commandsDir = join(editorRoot, "commands");
    if (existsSync(commandsDir)) {
      const entries = readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
      if (entries.length > 0) {
        if (shouldLog(verbose, 1))
          console.log(t("clear:clearingCommands", { editor: editorName, count: entries.length }));
        for (const entry of entries) {
          const entryPath = join(commandsDir, entry);
          try {
            const stats = lstatSync(entryPath);
            if (stats.isFile()) {
              await rm(entryPath);
              if (shouldLog(verbose, 2)) console.log(t("clear:deleted", { entry }));
            }
          } catch (error) {
            if (shouldLog(verbose, 1)) {
              console.warn(
                t("clear:deleteFailed", { entry }),
                error instanceof Error ? error.message : error,
              );
            }
          }
        }
      }
    }
  }
}
