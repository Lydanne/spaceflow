import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";
import { createRequire } from "module";
import { homedir } from "os";
import type {
  LoadedExtension,
  ExtensionModuleType,
  SpaceflowExtension,
  ExtensionDependencies,
} from "@spaceflow/core";
import {
  registerPluginConfig,
  registerPluginSchema,
  t,
  SPACEFLOW_DIR,
  PACKAGE_JSON,
} from "@spaceflow/core";

@Injectable()
export class ExtensionLoaderService {
  private loadedExtensions: Map<string, LoadedExtension> = new Map();

  /**
   * 注册内部 Extension（用于内置命令）
   * 与外部 Extension 使用相同的接口，但不需要从文件系统加载
   */
  registerInternalExtension(extension: SpaceflowExtension): LoadedExtension {
    const metadata = extension.getMetadata();

    // 注册 Extension 配置到全局注册表
    if (metadata.configKey) {
      registerPluginConfig({
        name: metadata.name,
        configKey: metadata.configKey,
        configDependencies: metadata.configDependencies,
        configSchema: metadata.configSchema,
      });

      // 注册 schema（如果有）
      if (metadata.configSchema) {
        registerPluginSchema({
          configKey: metadata.configKey,
          schemaFactory: metadata.configSchema as () => any,
          description: metadata.description,
        });
      }
    }

    const loadedExtension: LoadedExtension = {
      name: metadata.name,
      source: "internal",
      module: extension.getModule(),
      commands: metadata.commands,
      configKey: metadata.configKey,
      configDependencies: metadata.configDependencies,
      configSchema: metadata.configSchema,
      version: metadata.version,
      description: metadata.description,
    };

    this.loadedExtensions.set(metadata.name, loadedExtension);
    return loadedExtension;
  }

  /**
   * 批量注册内部 Extension
   */
  registerInternalExtensions(extensions: SpaceflowExtension[]): LoadedExtension[] {
    return extensions.map((ext) => this.registerInternalExtension(ext));
  }

  /**
   * 从 .spaceflow/package.json 发现并加载所有 Extension
   * 优先级：项目 .spaceflow/ > 全局 ~/.spaceflow/
   */
  async discoverAndLoad(): Promise<LoadedExtension[]> {
    const extensions: LoadedExtension[] = [];

    // 获取所有 .spaceflow 目录（按优先级从低到高）
    const spaceflowDirs = this.getSpaceflowDirs();

    // 收集所有 dependencies，后面的覆盖前面的
    const allDependencies: ExtensionDependencies = {};
    for (const dir of spaceflowDirs) {
      const deps = this.readDependencies(dir);
      Object.assign(allDependencies, deps);
    }

    // 需要跳过的核心依赖（不是 Extension）
    const corePackages = ["@spaceflow/core", "@spaceflow/cli"];

    // 加载所有 Extension
    for (const [name, version] of Object.entries(allDependencies)) {
      // 跳过核心包
      if (corePackages.includes(name)) {
        continue;
      }

      try {
        const extension = await this.loadExtension(name, version);
        if (extension) {
          extensions.push(extension);
          this.loadedExtensions.set(name, extension);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(t("extensionLoader.loadFailed", { name, error: message }));
      }
    }

    return extensions;
  }

  /**
   * 获取 .spaceflow 目录列表（按优先级从低到高）
   */
  getSpaceflowDirs(): string[] {
    const dirs: string[] = [];

    // 1. 全局 ~/.spaceflow/
    const globalDir = path.join(homedir(), SPACEFLOW_DIR);
    if (fs.existsSync(globalDir)) {
      dirs.push(globalDir);
    }

    // 2. 项目 .spaceflow/
    const localDir = path.join(process.cwd(), SPACEFLOW_DIR);
    if (fs.existsSync(localDir)) {
      dirs.push(localDir);
    }

    return dirs;
  }

  /**
   * 从 .spaceflow/package.json 读取 dependencies
   */
  readDependencies(spaceflowDir: string): ExtensionDependencies {
    const packageJsonPath = path.join(spaceflowDir, PACKAGE_JSON);

    if (!fs.existsSync(packageJsonPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      return pkg.dependencies || {};
    } catch {
      return {};
    }
  }

  /**
   * 检查包是否是一个有效的 flow 类型 Extension
   * 格式：spaceflow.exports 或 spaceflow.type === "flow"
   */
  private isValidExtension(name: string, spaceflowDir: string): boolean {
    const nodeModulesPath = path.join(spaceflowDir, "node_modules", name);
    const packageJsonPath = path.join(nodeModulesPath, PACKAGE_JSON);

    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      const spaceflowConfig = pkg.spaceflow;

      if (!spaceflowConfig) {
        return false;
      }

      // 完整格式：检查 exports 中是否有 flow 类型
      if (spaceflowConfig.exports) {
        return Object.values(spaceflowConfig.exports).some(
          (exp: any) => !exp.type || exp.type === "flow",
        );
      }

      // 简化格式：检查 type 是否为 flow（默认）
      if (spaceflowConfig.entry) {
        return !spaceflowConfig.type || spaceflowConfig.type === "flow";
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 加载单个 Extension
   */
  async loadExtension(name: string, version: string): Promise<LoadedExtension | null> {
    // 尝试从项目 .spaceflow/node_modules 加载
    const localSpaceflowDir = path.join(process.cwd(), SPACEFLOW_DIR);

    // 先检查是否是有效的 Extension
    if (!this.isValidExtension(name, localSpaceflowDir)) {
      const globalSpaceflowDir = path.join(homedir(), SPACEFLOW_DIR);
      if (!this.isValidExtension(name, globalSpaceflowDir)) {
        // 不是有效的 Extension，静默跳过（可能是 skills 包）
        return null;
      }
    }

    let extensionModule = await this.tryLoadFromDir(name, localSpaceflowDir);

    // 如果本地没有，尝试从全局 ~/.spaceflow/node_modules 加载
    if (!extensionModule) {
      const globalSpaceflowDir = path.join(homedir(), SPACEFLOW_DIR);
      extensionModule = await this.tryLoadFromDir(name, globalSpaceflowDir);
    }

    if (!extensionModule) {
      console.warn(`⚠️ Extension ${name} 未找到`);
      return null;
    }

    try {
      const ExtensionClass =
        extensionModule.default || extensionModule[Object.keys(extensionModule)[0]];

      if (!ExtensionClass) {
        console.warn(`⚠️ Extension ${name} 没有导出有效的 Extension 类`);
        return null;
      }

      const extensionInstance: SpaceflowExtension = new ExtensionClass();
      const metadata = extensionInstance.getMetadata();

      // 注册 Extension 配置到全局注册表
      if (metadata.configKey) {
        registerPluginConfig({
          name: metadata.name,
          configKey: metadata.configKey,
          configDependencies: metadata.configDependencies,
          configSchema: metadata.configSchema,
        });

        // 注册 schema（如果有）
        if (metadata.configSchema) {
          registerPluginSchema({
            configKey: metadata.configKey,
            schemaFactory: metadata.configSchema as () => any,
            description: metadata.description,
          });
        }
      }

      return {
        name,
        source: `${name}@${version}`,
        module: extensionInstance.getModule(),
        exports: extensionModule,
        commands: metadata.commands,
        configKey: metadata.configKey,
        configDependencies: metadata.configDependencies,
        configSchema: metadata.configSchema,
        version: metadata.version,
        description: metadata.description,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`加载 Extension 模块失败: ${message}`);
    }
  }

  /**
   * 尝试从指定的 .spaceflow 目录加载 Extension
   */
  private async tryLoadFromDir(name: string, spaceflowDir: string): Promise<any | null> {
    const packageJsonPath = path.join(spaceflowDir, PACKAGE_JSON);

    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      // 使用 .spaceflow/package.json 作为基础路径创建 require
      const localRequire = createRequire(packageJsonPath);
      const resolvedPath = localRequire.resolve(name);

      // 使用 Function 构造器来避免 rspack 转换这个 import
      const dynamicImport = new Function("url", "return import(url)");
      return await dynamicImport(`file://${resolvedPath}`);
    } catch {
      return null;
    }
  }

  /**
   * 获取已加载的 Extension
   */
  getLoadedExtensions(): LoadedExtension[] {
    return Array.from(this.loadedExtensions.values());
  }

  /**
   * 获取所有可用命令
   */
  getAvailableCommands(): string[] {
    const commands: string[] = [];
    for (const extension of this.loadedExtensions.values()) {
      commands.push(...extension.commands);
    }
    return commands;
  }

  /**
   * 根据命令名查找 Extension
   */
  findExtensionByCommand(command: string): LoadedExtension | undefined {
    for (const extension of this.loadedExtensions.values()) {
      if (extension.commands.includes(command)) {
        return extension;
      }
    }
    return undefined;
  }

  /**
   * 获取所有 Extension 模块（用于动态注入）
   */
  getExtensionModules(): ExtensionModuleType[] {
    return this.getLoadedExtensions().map((e) => e.module);
  }

  /**
   * 清除已加载的 Extension
   */
  clear(): void {
    this.loadedExtensions.clear();
  }
}
