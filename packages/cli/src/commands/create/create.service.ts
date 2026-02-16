import { mkdir, writeFile, readFile, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { homedir } from "os";
import { shouldLog, type VerboseLevel, t } from "@spaceflow/core";

export interface CreateOptions {
  directory?: string;
  from?: string;
  ref?: string;
}

interface TemplateContext {
  name: string;
  pascalName: string;
  camelName: string;
  kebabName: string;
}

/**
 * 创建插件服务
 */
export class CreateService {
  // 缓存当前使用的远程模板目录
  private remoteTemplatesDir: string | null = null;

  /**
   * 获取缓存目录路径
   */
  protected getCacheDir(): string {
    return join(homedir(), ".cache", "spaceflow", "templates");
  }

  /**
   * 计算仓库 URL 的哈希值（用于缓存目录名）
   */
  protected getRepoHash(repoUrl: string): string {
    return createHash("md5").update(repoUrl).digest("hex").slice(0, 12);
  }

  /**
   * 从仓库 URL 提取名称
   */
  protected getRepoName(repoUrl: string): string {
    // 处理 git@host:org/repo.git 或 https://host/org/repo.git
    const match = repoUrl.match(/[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1].replace("/", "-");
    }
    return this.getRepoHash(repoUrl);
  }

  /**
   * 确保远程模板仓库已克隆/更新
   */
  async ensureRemoteTemplates(
    repoUrl: string,
    ref?: string,
    verbose: VerboseLevel = 1,
  ): Promise<string> {
    const cacheDir = this.getCacheDir();
    const repoName = this.getRepoName(repoUrl);
    const repoHash = this.getRepoHash(repoUrl);
    const targetDir = join(cacheDir, `${repoName}-${repoHash}`);

    // 确保缓存目录存在
    await mkdir(cacheDir, { recursive: true });

    if (existsSync(targetDir)) {
      // 已存在，更新仓库
      if (shouldLog(verbose, 1)) console.log(t("create:updatingRepo", { url: repoUrl }));
      try {
        execSync("git fetch --all", { cwd: targetDir, stdio: "pipe" });
        if (ref) {
          execSync(`git checkout ${ref}`, { cwd: targetDir, stdio: "pipe" });
          // 如果是分支，尝试 pull
          try {
            execSync(`git pull origin ${ref}`, { cwd: targetDir, stdio: "pipe" });
          } catch {
            // 可能是 tag，忽略 pull 错误
          }
        } else {
          execSync("git pull", { cwd: targetDir, stdio: "pipe" });
        }
      } catch (error) {
        if (shouldLog(verbose, 1)) console.warn(t("create:updateFailed"));
      }
    } else {
      // 不存在，克隆仓库
      if (shouldLog(verbose, 1)) console.log(t("create:cloningRepo", { url: repoUrl }));
      try {
        execSync(`git clone ${repoUrl} ${targetDir}`, { stdio: "pipe" });
        if (ref) {
          execSync(`git checkout ${ref}`, { cwd: targetDir, stdio: "pipe" });
        }
      } catch (error) {
        throw new Error(
          t("create:cloneFailed", { error: error instanceof Error ? error.message : error }),
        );
      }
    }

    // 设置当前使用的远程模板目录
    this.remoteTemplatesDir = targetDir;
    if (shouldLog(verbose, 1)) console.log(t("create:repoReady", { dir: targetDir }));
    return targetDir;
  }

  /**
   * 获取模板目录路径
   */
  protected getTemplatesDir(options?: CreateOptions): string {
    // 如果有远程模板目录，优先使用
    if (options?.from && this.remoteTemplatesDir) {
      return this.remoteTemplatesDir;
    }
    // 尝试从项目根目录查找 templates
    const cwd = process.cwd();
    const templatesInCwd = join(cwd, "templates");
    if (existsSync(templatesInCwd)) {
      return templatesInCwd;
    }

    // 尝试从父目录查找（在 core 子目录运行时）
    const templatesInParent = join(cwd, "..", "templates");
    if (existsSync(templatesInParent)) {
      return resolve(templatesInParent);
    }

    // 尝试从 spaceflow 包目录查找
    const spaceflowRoot = join(cwd, "node_modules", "spaceflow", "templates");
    if (existsSync(spaceflowRoot)) {
      return spaceflowRoot;
    }

    // 回退到相对于当前文件的路径（开发模式）
    // 从 core/dist/commands/create 回溯到项目根目录
    const devPath = resolve(__dirname, "..", "..", "..", "..", "templates");
    if (existsSync(devPath)) {
      return devPath;
    }

    throw new Error(t("create:templatesDirNotFound"));
  }

  /**
   * 获取可用的模板列表
   */
  async getAvailableTemplates(options?: CreateOptions): Promise<string[]> {
    try {
      const templatesDir = this.getTemplatesDir(options);
      const entries = await readdir(templatesDir);
      const templates: string[] = [];

      for (const entry of entries) {
        // 跳过隐藏目录
        if (entry.startsWith(".")) {
          continue;
        }
        const entryPath = join(templatesDir, entry);
        const entryStat = await stat(entryPath);
        if (entryStat.isDirectory()) {
          templates.push(entry);
        }
      }

      return templates;
    } catch {
      return [];
    }
  }

  /**
   * 基于模板创建插件
   */
  async createFromTemplate(
    template: string,
    name: string,
    options: CreateOptions,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const cwd = process.cwd();
    // 默认目录为 <template>/<name>
    const targetDir = options.directory || join(template, name);
    const fullPath = join(cwd, targetDir);

    if (shouldLog(verbose, 1)) {
      console.log(t("create:creatingPlugin", { template, name }));
      console.log(t("create:targetDir", { dir: targetDir }));
    }

    // 检查目录是否已存在
    if (existsSync(fullPath)) {
      throw new Error(t("create:dirExists", { dir: targetDir }));
    }

    // 从模板生成文件
    const templatesDir = this.getTemplatesDir(options);
    const templateDir = join(templatesDir, template);

    if (!existsSync(templateDir)) {
      const available = await this.getAvailableTemplates(options);
      throw new Error(
        t("create:templateNotFound", {
          template,
          available: available.join(", ") || t("create:noTemplatesAvailable"),
        }),
      );
    }

    const context = this.createContext(name);
    await this.copyTemplateDir(templateDir, fullPath, context, verbose);

    if (shouldLog(verbose, 1)) {
      console.log(t("create:pluginCreated", { template, name }));
      console.log("");
      console.log(t("create:nextSteps"));
      console.log(`  cd ${targetDir}`);
    }
  }

  /**
   * 创建模板上下文
   */
  protected createContext(name: string): TemplateContext {
    return {
      name,
      pascalName: this.toPascalCase(name),
      camelName: this.toCamelCase(name),
      kebabName: this.toKebabCase(name),
    };
  }

  /**
   * 递归复制模板目录
   */
  protected async copyTemplateDir(
    templateDir: string,
    targetDir: string,
    context: TemplateContext,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    // 确保目标目录存在
    await mkdir(targetDir, { recursive: true });

    const entries = await readdir(templateDir);

    for (const entry of entries) {
      const templatePath = join(templateDir, entry);
      const entryStat = await stat(templatePath);

      if (entryStat.isDirectory()) {
        // 递归处理子目录
        const targetSubDir = join(targetDir, entry);
        await this.copyTemplateDir(templatePath, targetSubDir, context, verbose);
      } else if (entry.endsWith(".hbs")) {
        // 处理模板文件
        const content = await readFile(templatePath, "utf-8");
        const rendered = this.renderTemplate(content, context);

        // 计算目标文件名（移除 .hbs 后缀，替换 __name__ 占位符）
        let targetFileName = entry.slice(0, -4); // 移除 .hbs
        targetFileName = targetFileName.replace(/__name__/g, context.kebabName);

        const targetPath = join(targetDir, targetFileName);
        await writeFile(targetPath, rendered);
        if (shouldLog(verbose, 1)) console.log(t("create:fileCreated", { file: targetFileName }));
      } else {
        // 直接复制非模板文件
        const content = await readFile(templatePath);
        const targetPath = join(targetDir, entry);
        await writeFile(targetPath, content);
        if (shouldLog(verbose, 1)) console.log(t("create:fileCopied", { file: entry }));
      }
    }
  }

  /**
   * 渲染模板（简单的 Handlebars 风格替换）
   */
  protected renderTemplate(template: string, context: TemplateContext): string {
    return template
      .replace(/\{\{name\}\}/g, context.name)
      .replace(/\{\{pascalName\}\}/g, context.pascalName)
      .replace(/\{\{camelName\}\}/g, context.camelName)
      .replace(/\{\{kebabName\}\}/g, context.kebabName);
  }

  /**
   * 转换为 PascalCase
   */
  protected toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }

  /**
   * 转换为 camelCase
   */
  protected toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  /**
   * 转换为 kebab-case
   */
  protected toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[_\s]+/g, "-")
      .toLowerCase();
  }
}
