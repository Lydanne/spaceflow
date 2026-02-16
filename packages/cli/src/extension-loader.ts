import * as path from "path";
import * as fs from "fs";
import { createRequire } from "module";
import { homedir } from "os";
import type { ExtensionDefinition, CommandDefinition } from "@spaceflow/core";
import { SPACEFLOW_DIR, PACKAGE_JSON, t } from "@spaceflow/core";
import type { SpaceflowContext } from "@spaceflow/core";

/**
 * 扩展加载器
 * 加载新格式的扩展（使用 defineExtension）
 */
export class ExtensionLoader {
  private extensions = new Map<string, ExtensionDefinition>();
  private commands = new Map<string, CommandDefinition>();

  constructor(private readonly ctx: SpaceflowContext) {}

  /**
   * 注册扩展
   */
  registerExtension(extension: ExtensionDefinition): void {
    this.extensions.set(extension.name, extension);

    // 注册配置 schema
    if (extension.configSchema && extension.configKey) {
      this.ctx.config.registerSchema(extension.configKey, extension.configSchema());
    }

    // 注册命令
    for (const cmd of extension.commands) {
      this.commands.set(cmd.name, cmd);
    }

    // 注册服务
    if (extension.services) {
      for (const svc of extension.services) {
        const instance = svc.factory(this.ctx);
        this.ctx.registerService(svc.key, instance);
      }
    }

    // 调用初始化钩子
    if (extension.onInit) {
      extension.onInit(this.ctx);
    }
  }

  /**
   * 获取所有命令
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * 获取所有扩展
   */
  getExtensions(): ExtensionDefinition[] {
    return Array.from(this.extensions.values());
  }

  /**
   * 获取所有 MCP 服务
   * 返回扩展中定义的 mcp 字段
   */
  getMcpServers(): Array<{ extensionName: string; mcp: NonNullable<ExtensionDefinition["mcp"]> }> {
    const mcpServers: Array<{
      extensionName: string;
      mcp: NonNullable<ExtensionDefinition["mcp"]>;
    }> = [];
    for (const ext of this.extensions.values()) {
      if (ext.mcp) {
        mcpServers.push({ extensionName: ext.name, mcp: ext.mcp });
      }
    }
    return mcpServers;
  }

  /**
   * 发现并加载外部扩展
   */
  async discoverAndLoad(): Promise<void> {
    const spaceflowDirs = this.getSpaceflowDirs();

    // 收集所有 dependencies
    const allDependencies: Record<string, string> = {};
    for (const dir of spaceflowDirs) {
      const deps = this.readDependencies(dir);
      Object.assign(allDependencies, deps);
    }

    // 跳过核心包
    const corePackages = ["@spaceflow/core", "@spaceflow/cli"];

    // 加载所有扩展
    for (const [name, version] of Object.entries(allDependencies)) {
      if (corePackages.includes(name)) {
        continue;
      }

      try {
        await this.loadExtension(name, version);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(t("extensionLoader.loadFailed", { name, error: message }));
      }
    }
  }

  /**
   * 获取 .spaceflow 目录列表
   */
  private getSpaceflowDirs(): string[] {
    const dirs: string[] = [];

    // 全局 ~/.spaceflow/
    const globalDir = path.join(homedir(), SPACEFLOW_DIR);
    if (fs.existsSync(globalDir)) {
      dirs.push(globalDir);
    }

    // 项目 .spaceflow/
    const localDir = path.join(process.cwd(), SPACEFLOW_DIR);
    if (fs.existsSync(localDir)) {
      dirs.push(localDir);
    }

    return dirs;
  }

  /**
   * 读取 dependencies
   */
  private readDependencies(spaceflowDir: string): Record<string, string> {
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
   * 检查是否是有效的扩展
   * 支持两种方式：
   * 1. package.json 中有 spaceflow.extension 配置
   * 2. 模块导出了 defineExtension 定义
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

      // 方式1：检查 spaceflow.extension 配置
      if (pkg.spaceflow?.extension) {
        return true;
      }

      // 方式2：检查是否有 main 入口（可能是 defineExtension 格式）
      // 对于 @spaceflow/* 包，默认认为是有效扩展
      if (name.startsWith("@spaceflow/") && pkg.main) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 加载单个扩展
   */
  private async loadExtension(name: string, _version: string): Promise<void> {
    const localSpaceflowDir = path.join(process.cwd(), SPACEFLOW_DIR);

    if (!this.isValidExtension(name, localSpaceflowDir)) {
      const globalSpaceflowDir = path.join(homedir(), SPACEFLOW_DIR);
      if (!this.isValidExtension(name, globalSpaceflowDir)) {
        return;
      }
    }

    let extensionModule = await this.tryLoadFromDir(name, localSpaceflowDir);
    if (!extensionModule) {
      const globalSpaceflowDir = path.join(homedir(), SPACEFLOW_DIR);
      extensionModule = await this.tryLoadFromDir(name, globalSpaceflowDir);
    }

    if (!extensionModule) {
      console.warn(`⚠️ 扩展 ${name} 未找到`);
      return;
    }

    const extensionDef: ExtensionDefinition =
      extensionModule.default || extensionModule.extension || extensionModule;

    if (!extensionDef) {
      console.warn(`⚠️ 扩展 ${name} 没有导出有效的扩展定义`);
      return;
    }

    this.registerExtension(extensionDef);
  }

  /**
   * 尝试从目录加载扩展
   */
  private async tryLoadFromDir(name: string, spaceflowDir: string): Promise<any> {
    const packageJsonPath = path.join(spaceflowDir, PACKAGE_JSON);
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const localRequire = createRequire(packageJsonPath);
      const resolvedPath = localRequire.resolve(name);
      const dynamicImport = new Function("url", "return import(url)");
      return await dynamicImport(`file://${resolvedPath}`);
    } catch {
      return null;
    }
  }
}
