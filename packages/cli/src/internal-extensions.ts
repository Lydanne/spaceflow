import { buildExtension } from "./commands/build";
import { clearExtension } from "./commands/clear";
import { commitExtension } from "./commands/commit";
import { createExtension } from "./commands/create";
import { devExtension } from "./commands/dev";
import { installExtension } from "./commands/install";
import { listExtension } from "./commands/list";
import { mcpExtension } from "./commands/mcp";
import { runxExtension } from "./commands/runx";
import { schemaExtension } from "./commands/schema";
import { setupExtension } from "./commands/setup";
import { uninstallExtension } from "./commands/uninstall";
import { updateExtension } from "./commands/update";

/**
 * 内部扩展列表
 * 从各命令目录导入 defineExtension 定义
 */
export const internalExtensions = [
  buildExtension,
  clearExtension,
  commitExtension,
  createExtension,
  devExtension,
  installExtension,
  listExtension,
  mcpExtension,
  runxExtension,
  schemaExtension,
  setupExtension,
  uninstallExtension,
  updateExtension,
];
