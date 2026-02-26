import type { ExtensionDefinition, CommandDefinition } from "@spaceflow/core";
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
}
