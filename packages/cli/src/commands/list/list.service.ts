import { Injectable } from "@nestjs/common";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { ExtensionLoaderService } from "../../extension-loader";
import {
  shouldLog,
  type VerboseLevel,
  getEditorDirName,
  DEFAULT_EDITOR,
  getSourceType,
  normalizeSource,
  t,
} from "@spaceflow/core";

interface ExtensionListInfo {
  name: string;
  source: string;
  type: "npm" | "git" | "local";
  commands: string[];
  installed: boolean;
}

@Injectable()
export class ListService {
  constructor(private readonly extensionLoader: ExtensionLoaderService) {}

  /**
   * 获取支持的编辑器列表
   */
  protected async getSupportedEditors(): Promise<string[]> {
    const configPath = join(process.cwd(), "spaceflow.json");
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
   * 执行列表展示
   */
  async execute(verbose: VerboseLevel = 1): Promise<void> {
    const cwd = process.cwd();
    // 优先检查 .spaceflow/spaceflow.json，回退到 spaceflow.json
    let configPath = join(cwd, ".spaceflow", "spaceflow.json");
    if (!existsSync(configPath)) {
      configPath = join(cwd, "spaceflow.json");
    }

    // 读取配置文件中的 skills
    const skills = await this.parseSkillsFromConfig(configPath);

    if (Object.keys(skills).length === 0) {
      if (shouldLog(verbose, 1)) {
        console.log(t("list:noSkills"));
        console.log("");
        console.log(t("list:installHint"));
        console.log("  spaceflow install <npm-package>");
        console.log("  spaceflow install <git-url> --name <name>");
      }
      return;
    }

    // 获取已加载的 Extension 信息
    const loadedExtensions = this.extensionLoader.getLoadedExtensions();
    const loadedMap = new Map(loadedExtensions.map((e) => [e.name, e]));
    const editors = await this.getSupportedEditors();
    // 收集所有 Extension 信息
    const extensionInfos: ExtensionListInfo[] = [];
    for (const [name, source] of Object.entries(skills)) {
      const type = getSourceType(source);
      const installed = await this.checkInstalled(name, source, type, editors);
      const loadedExt = loadedMap.get(name);
      extensionInfos.push({ name, source, type, installed, commands: loadedExt?.commands ?? [] });
    }
    if (!shouldLog(verbose, 1)) return;
    // 计算最大名称宽度用于对齐
    const maxNameLen = Math.max(...extensionInfos.map((e) => e.name.length), 10);
    const installedCount = extensionInfos.filter((e) => e.installed).length;
    console.log(
      t("list:installedExtensions", { installed: installedCount, total: extensionInfos.length }) + "\n",
    );
    for (const ext of extensionInfos) {
      const icon = ext.installed ? "\x1b[32m✔\x1b[0m" : "\x1b[33m○\x1b[0m";
      const typeLabel =
        ext.type === "local"
          ? "\x1b[36mlocal\x1b[0m"
          : ext.type === "npm"
            ? "\x1b[35mnpm\x1b[0m"
            : "\x1b[33mgit\x1b[0m";
      const displaySource = this.getDisplaySource(ext.source, ext.type);
      console.log(`  ${icon} ${ext.name.padEnd(maxNameLen + 2)} ${typeLabel}  ${displaySource}`);
      // 显示命令列表
      if (ext.commands.length > 0) {
        console.log(
          `    ${"".padEnd(maxNameLen)}  ${t("list:commands", { commands: ext.commands.join(", ") })}`,
        );
      }
    }
    console.log("");
  }

  /**
   * 获取用于展示的 source 字符串
   */
  private getDisplaySource(source: string, type: "npm" | "git" | "local"): string {
    if (type === "local") {
      return normalizeSource(source);
    }
    if (type === "git") {
      // 简化 git URL 展示
      const match = source.match(/[/:](\w+\/[\w.-]+?)(?:\.git)?$/);
      return match ? match[1] : source;
    }
    return source;
  }

  /**
   * 检查是否已安装
   */
  private async checkInstalled(
    name: string,
    source: string,
    type: "npm" | "git" | "local",
    editors: string[],
  ): Promise<boolean> {
    const cwd = process.cwd();
    if (type === "local") {
      const localPath = join(cwd, normalizeSource(source));
      return existsSync(localPath);
    } else if (type === "npm") {
      try {
        require.resolve(source);
        return true;
      } catch {
        return false;
      }
    } else {
      const possiblePaths = [join(cwd, "skills", name)];
      for (const editor of editors) {
        const editorDirName = getEditorDirName(editor);
        possiblePaths.push(join(cwd, editorDirName, "skills", name));
        possiblePaths.push(join(cwd, editorDirName, "commands", name));
      }
      return possiblePaths.some((p) => existsSync(p));
    }
  }

  /**
   * 从配置文件解析 dependencies
   */
  private async parseSkillsFromConfig(configPath: string): Promise<Record<string, string>> {
    try {
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      return config.dependencies || {};
    } catch {
      return {};
    }
  }
}
