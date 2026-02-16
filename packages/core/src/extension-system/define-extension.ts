import type { ExtensionDefinition, McpServerDefinition } from "./types";

/**
 * 定义扩展
 * 这是一个类型安全的工厂函数，用于创建扩展定义
 * @param definition 扩展定义
 * @returns 扩展定义（原样返回，仅用于类型推断）
 */
export function defineExtension(
  definition: ExtensionDefinition,
): ExtensionDefinition {
  return definition;
}

/**
 * 定义 MCP 服务器
 * 这是一个类型安全的工厂函数，用于创建 MCP 服务器定义
 * @param definition MCP 服务器定义
 * @returns MCP 服务器定义（原样返回，仅用于类型推断）
 */
export function defineMcpServer(
  definition: McpServerDefinition,
): McpServerDefinition {
  return definition;
}
