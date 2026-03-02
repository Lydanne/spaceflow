import { join } from "path";
import { existsSync } from "fs";
import type { ExtensionLoader } from "../../cli-runtime/extension-loader";
import {
  shouldLog,
  type VerboseLevel,
  getEditorDirName,
  getSourceType,
  normalizeSource,
  getDependencies,
  getSupportedEditors,
  t,
} from "@spaceflow/core";

interface ExtensionListInfo {
  name: string;
  source: string;
  type: "npm" | "git" | "local";
  commands: string[];
  installed: boolean;
}

export class ListService {
  constructor(private readonly extensionLoader: ExtensionLoader) {}

  /**
   * 执行列表展示
   */
  async execute(verbose: VerboseLevel = 1): Promise<void> {
    const cwd = process.cwd();

    // 读取合并后的 dependencies（支持 .spaceflowrc、.spaceflow/spaceflow.json 等所有配置源）
    const dependencies = getDependencies(cwd);

    if (Object.keys(dependencies).length === 0) {
      if (shouldLog(verbose, 1)) {
        console.log(t("list:noSkills"));
        console.log("");
        console.log(t("list:installHint"));
        console.log("  spaceflow install <npm-package>");
        console.log("  spaceflow install <git-url> --name <name>");
      }
      return;
    }

    const editors = getSupportedEditors(cwd);
    // 收集所有外部扩展信息
    const extensionInfos: ExtensionListInfo[] = [];
    for (const [name, source] of Object.entries(dependencies) as [string, string][]) {
      const type = getSourceType(source);
      const installed = await this.checkInstalled(name, source, type, editors);
      extensionInfos.push({ name, source, type, installed, commands: [] });
    }
    if (!shouldLog(verbose, 1)) return;
    // 计算最大名称宽度用于对齐
    const maxNameLen = Math.max(...extensionInfos.map((e) => e.name.length), 10);
    const installedCount = extensionInfos.filter((e) => e.installed).length;
    console.log(
      t("list:installedExtensions", { installed: installedCount, total: extensionInfos.length }) +
        "\n",
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
}
