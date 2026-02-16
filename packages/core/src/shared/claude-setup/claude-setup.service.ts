import { readFile, writeFile, mkdir, copyFile, unlink } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { LlmConfig } from "../../config";
import { shouldLog, type VerboseLevel } from "../verbose";

export class ClaudeSetupService {
  constructor(protected readonly llmConfig?: LlmConfig) {}

  private getPaths() {
    const claudeDir = join(homedir(), ".claude");
    return {
      claudeDir,
      settingsPath: join(claudeDir, "settings.json"),
      settingsBackupPath: join(claudeDir, "settings.json.bak"),
      claudeJsonPath: join(homedir(), ".claude.json"),
      claudeJsonBackupPath: join(homedir(), ".claude.json.bak"),
    };
  }

  async backup(): Promise<void> {
    const paths = this.getPaths();
    try {
      await copyFile(paths.settingsPath, paths.settingsBackupPath);
    } catch (e) {
      // 忽略文件不存在的情况
    }
    try {
      await copyFile(paths.claudeJsonPath, paths.claudeJsonBackupPath);
    } catch (e) {
      // 忽略文件不存在的情况
    }
  }

  async restore(): Promise<void> {
    const paths = this.getPaths();
    try {
      await copyFile(paths.settingsBackupPath, paths.settingsPath);
      await unlink(paths.settingsBackupPath);
    } catch (e) {
      // 忽略备份文件不存在的情况
    }
    try {
      await copyFile(paths.claudeJsonBackupPath, paths.claudeJsonPath);
      await unlink(paths.claudeJsonBackupPath);
    } catch (e) {
      // 忽略备份文件不存在的情况
    }
  }

  /**
   * 使用临时配置执行操作
   * 自动备份现有配置，执行完成后恢复
   */
  async withTemporaryConfig<T>(fn: () => Promise<T>, verbose?: VerboseLevel): Promise<T> {
    await this.backup();
    try {
      await this.configure(verbose);
      return await fn();
    } finally {
      await this.restore();
    }
  }

  async configure(verbose?: VerboseLevel): Promise<void> {
    const { claudeDir, settingsPath, claudeJsonPath } = this.getPaths();

    const claudeCode = this.llmConfig?.claudeCode;

    if (!claudeCode) {
      if (shouldLog(verbose, 1)) {
        console.log("未配置 claude 设置，跳过");
      }
      return;
    }

    try {
      await mkdir(claudeDir, { recursive: true });
    } catch {
      // ignore if exists
    }

    let existingSettings = {};
    try {
      const content = await readFile(settingsPath, "utf-8");
      existingSettings = JSON.parse(content);
    } catch {
      // file doesn't exist or invalid JSON
    }

    const existing = existingSettings as Record<string, Record<string, unknown>>;
    const env: Record<string, string> = { ...(existing.env as Record<string, string>) };
    if (claudeCode.baseUrl) env.ANTHROPIC_BASE_URL = claudeCode.baseUrl;
    if (claudeCode.authToken) {
      env.ANTHROPIC_AUTH_TOKEN = claudeCode.authToken;
    } else {
      throw new Error("未配置 claudeCode.authToken 设置");
    }
    if (claudeCode.model) env.ANTHROPIC_MODEL = claudeCode.model;

    const mergedSettings = {
      ...existingSettings,
      env,
    };

    await writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2), "utf-8");
    if (shouldLog(verbose, 1)) {
      console.log(`✅ 已写入 ${settingsPath}`);
    }

    if (claudeCode.hasCompletedOnboarding !== undefined) {
      let claudeJson: Record<string, unknown> = {};
      try {
        const content = await readFile(claudeJsonPath, "utf-8");
        claudeJson = JSON.parse(content);
      } catch {
        // file doesn't exist or invalid JSON
      }
      claudeJson.hasCompletedOnboarding = claudeCode.hasCompletedOnboarding;
      await writeFile(claudeJsonPath, JSON.stringify(claudeJson, null, 2), "utf-8");
      if (shouldLog(verbose, 1)) {
        console.log(`✅ 已写入 ${claudeJsonPath}`);
      }
    }
  }
}
