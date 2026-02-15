import { Injectable } from "@nestjs/common";
import { rspack, type Compiler, type Configuration, type Stats } from "@rspack/core";
import { readdir, stat } from "fs/promises";
import { join, dirname, resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";
import { createPluginConfig, getDependencies } from "@spaceflow/core";
import { shouldLog, type VerboseLevel, t } from "@spaceflow/core";

export interface ExtensionInfo {
  name: string;
  path: string;
  hasPackageJson: boolean;
}

export interface BuildResult {
  extension: string;
  success: boolean;
  duration?: number;
  errors?: string[];
  warnings?: string[];
}

@Injectable()
export class BuildService {
  private readonly projectRoot = this.findProjectRoot();
  private readonly extensionDirs = this.discoverExtensionDirs();
  private readonly coreRoot = this.resolveCoreRoot();
  private watchers: Map<string, Compiler> = new Map();

  /**
   * 查找项目根目录（包含 spaceflow.json 或 .spaceflow/spaceflow.json 的目录）
   */
  private findProjectRoot(): string {
    let dir = process.cwd();
    while (dir !== dirname(dir)) {
      // 检查根目录下的 spaceflow.json
      if (existsSync(join(dir, "spaceflow.json"))) {
        return dir;
      }
      // 检查 .spaceflow/spaceflow.json
      if (existsSync(join(dir, ".spaceflow", "spaceflow.json"))) {
        return dir;
      }
      dir = dirname(dir);
    }
    // 如果找不到，回退到 cwd
    return process.cwd();
  }

  /**
   * 构建插件
   */
  async build(extensionName?: string, verbose: VerboseLevel = 1): Promise<BuildResult[]> {
    const extensions = await this.getExtensionsToBuild(extensionName);

    if (extensions.length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("build:noPlugins"));
      return [];
    }

    if (shouldLog(verbose, 1))
      console.log(t("build:startBuilding", { count: extensions.length }) + "\n");

    const results: BuildResult[] = [];
    for (const ext of extensions) {
      const result = await this.buildExtension(ext, verbose);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (shouldLog(verbose, 1))
      console.log("\n" + t("build:buildComplete", { success: successCount, fail: failCount }));
    return results;
  }

  /**
   * 监听模式构建
   */
  async watch(extensionName?: string, verbose: VerboseLevel = 1): Promise<void> {
    const extensions = await this.getExtensionsToBuild(extensionName);

    if (extensions.length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("build:noPlugins"));
      return;
    }

    if (shouldLog(verbose, 1))
      console.log(t("build:startWatching", { count: extensions.length }) + "\n");

    // 并行启动所有 watcher
    await Promise.all(extensions.map((ext) => this.watchExtension(ext, verbose)));

    // 保持进程运行
    await new Promise(() => {});
  }

  /**
   * 停止所有 watcher
   */
  async stopWatch(verbose: VerboseLevel = 1): Promise<void> {
    for (const [name, compiler] of this.watchers) {
      await new Promise<void>((resolve) => {
        compiler.close(() => {
          if (shouldLog(verbose, 1)) console.log(t("build:stopWatching", { name }));
          resolve();
        });
      });
    }
    this.watchers.clear();
  }

  /**
   * 从 spaceflow.json 的 dependencies 中发现本地 extension 所在的目录
   * 解析所有 link: 路径，收集去重后的父目录
   */
  private discoverExtensionDirs(): string[] {
    const dependencies = getDependencies(this.projectRoot);
    const parentDirs = new Set<string>();
    for (const source of Object.values(dependencies)) {
      if (!source.startsWith("link:")) continue;
      const linkPath = source.slice(5);
      const absolutePath = resolve(this.projectRoot, linkPath);
      parentDirs.add(dirname(absolutePath));
    }
    return Array.from(parentDirs);
  }

  /**
   * 动态解析 @spaceflow/core 的根目录
   * 优先通过 require.resolve 定位，回退到 node_modules
   */
  private resolveCoreRoot(): string {
    try {
      const req = createRequire(join(this.projectRoot, "package.json"));
      const corePkgPath = req.resolve("@spaceflow/core/package.json");
      return dirname(corePkgPath);
    } catch {
      return join(this.projectRoot, "node_modules", "@spaceflow", "core");
    }
  }

  /**
   * 获取需要构建的 Extension 列表
   */
  private async getExtensionsToBuild(extensionName?: string): Promise<ExtensionInfo[]> {
    // 如果没有指定名称，检查是否在 Extension 目录中运行
    if (!extensionName) {
      const current = this.detectCurrentExtension();
      if (current) {
        return [current];
      }
    }
    // 从所有 extension 目录中扫描
    const result: ExtensionInfo[] = [];
    for (const extDir of this.extensionDirs) {
      if (!existsSync(extDir)) continue;
      const entries = await readdir(extDir);
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        const extPath = join(extDir, entry);
        const stats = await stat(extPath);
        if (!stats.isDirectory()) continue;
        if (extensionName && entry !== extensionName) continue;
        const packageJsonPath = join(extPath, "package.json");
        if (existsSync(packageJsonPath)) {
          result.push({ name: entry, path: extPath, hasPackageJson: true });
        }
      }
    }
    return result;
  }

  /**
   * 检测当前目录是否为 spaceflow Extension
   * 通过检查 package.json 中的 spaceflow 配置判断，不依赖固定目录名
   */
  private detectCurrentExtension(): ExtensionInfo | null {
    const cwd = process.cwd();
    const packageJsonPath = join(cwd, "package.json");
    if (!existsSync(packageJsonPath)) {
      return null;
    }
    try {
      const content = readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      if (!pkg.spaceflow) {
        return null;
      }
      const name = cwd.split("/").pop() || "";
      return { name, path: cwd, hasPackageJson: true };
    } catch {
      return null;
    }
  }

  /**
   * 构建单个 Extension
   */
  private async buildExtension(ext: ExtensionInfo, verbose: VerboseLevel = 1): Promise<BuildResult> {
    const startTime = Date.now();
    if (shouldLog(verbose, 1)) console.log(t("build:building", { name: ext.name }));

    try {
      const config = await this.getConfig(ext);
      const compiler = rspack(config);

      const stats = await new Promise<Stats>((resolve, reject) => {
        compiler.run((err, stats) => {
          compiler.close((closeErr) => {
            if (err) return reject(err);
            if (closeErr) return reject(closeErr);
            if (!stats) return reject(new Error("No stats returned"));
            resolve(stats);
          });
        });
      });

      const duration = Date.now() - startTime;
      const info = stats.toJson({ errors: true, warnings: true });

      if (stats.hasErrors()) {
        const errors = info.errors?.map((e) => e.message) || [];
        console.log(t("build:buildFailedWithDuration", { duration }));
        errors.forEach((e) => console.log(`      ${e}`));
        return { extension: ext.name, success: false, duration, errors };
      }

      if (stats.hasWarnings()) {
        const warnings = info.warnings?.map((w) => w.message) || [];
        if (shouldLog(verbose, 1))
          console.log(t("build:buildWarnings", { duration, count: warnings.length }));
        return { extension: ext.name, success: true, duration, warnings };
      }

      if (shouldLog(verbose, 1)) console.log(t("build:buildSuccess", { duration }));
      return { extension: ext.name, success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      console.log(t("build:buildFailedWithMessage", { duration, message }));
      return { extension: ext.name, success: false, duration, errors: [message] };
    }
  }

  /**
   * 监听单个 Extension
   */
  private async watchExtension(ext: ExtensionInfo, verbose: VerboseLevel = 1): Promise<void> {
    if (shouldLog(verbose, 1)) console.log(t("build:watching", { name: ext.name }));

    try {
      const config = await this.getConfig(ext);
      const compiler = rspack(config);

      this.watchers.set(ext.name, compiler);

      compiler.watch({}, (err, stats) => {
        if (err) {
          console.log(t("build:watchError", { name: ext.name, message: err.message }));
          return;
        }

        if (!stats) return;

        const info = stats.toJson({ errors: true, warnings: true });

        if (stats.hasErrors()) {
          console.log(t("build:watchBuildFailed", { name: ext.name }));
          info.errors?.forEach((e) => console.log(`      ${e.message}`));
        } else if (stats.hasWarnings()) {
          if (shouldLog(verbose, 1))
            console.log(
              t("build:watchBuildWarnings", { name: ext.name, count: info.warnings?.length }),
            );
        } else {
          if (shouldLog(verbose, 1))
            console.log(t("build:watchBuildSuccess", { name: ext.name }));
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(t("build:watchInitFailed", { name: ext.name, message }));
    }
  }

  /**
   * 获取 Extension 的 rspack 配置
   */
  private async getConfig(ext: ExtensionInfo): Promise<Configuration> {
    const customConfigPath = join(ext.path, "rspack.config.mjs");
    const customConfigPathJs = join(ext.path, "rspack.config.js");

    if (existsSync(customConfigPath)) {
      const module = await import(customConfigPath);
      return module.default || module;
    }

    if (existsSync(customConfigPathJs)) {
      const module = await import(customConfigPathJs);
      return module.default || module;
    }

    return this.getDefaultConfig(ext);
  }

  /**
   * 生成默认的 rspack 配置
   */
  private getDefaultConfig(ext: ExtensionInfo): Configuration {
    return createPluginConfig(
      {
        name: ext.name,
        path: ext.path,
      },
      {
        coreRoot: this.coreRoot,
      },
    );
  }
}
