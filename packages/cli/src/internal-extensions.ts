/**
 * 内部 Extension 注册
 * 使用与外部 Extension 相同的 SpaceflowExtension 接口
 */
import type { SpaceflowExtension } from "@spaceflow/core";
import { InstallExtension } from "./commands/install";
import { UninstallExtension } from "./commands/uninstall";
import { UpdateExtension } from "./commands/update";
import { BuildExtension } from "./commands/build";
import { DevExtension } from "./commands/dev";
import { CreateExtension } from "./commands/create";
import { ListExtension } from "./commands/list";
import { ClearExtension } from "./commands/clear";
import { RunxExtension } from "./commands/runx";
import { SchemaExtension } from "./commands/schema";
import { CommitExtension } from "./commands/commit";
import { SetupExtension } from "./commands/setup";
import { McpExtension } from "./commands/mcp";

/**
 * 内部 Extension 列表
 * 所有内置命令都在这里统一注册
 */
export const internalExtensions: SpaceflowExtension[] = [
  new InstallExtension(),
  new UninstallExtension(),
  new UpdateExtension(),
  new BuildExtension(),
  new DevExtension(),
  new CreateExtension(),
  new ListExtension(),
  new ClearExtension(),
  new RunxExtension(),
  new SchemaExtension(),
  new CommitExtension(),
  new SetupExtension(),
  new McpExtension(),
];
