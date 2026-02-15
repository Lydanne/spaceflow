# @spaceflow/cli

[![npm version](https://img.shields.io/npm/v/@spaceflow/cli?color=blue)](https://www.npmjs.com/package/@spaceflow/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow CLI 工具，提供 `spaceflow` / `space` 命令，是所有 Spaceflow 功能的统一入口。

## 安装

```bash
pnpm add -D @spaceflow/cli
```

## 使用

```bash
# 使用 spaceflow 或 space 命令
spaceflow <command> [options]
space <command> [options]
```

## 内置命令

| 命令         | 说明                 |
| ------------ | -------------------- |
| `install`    | 安装扩展             |
| `uninstall`  | 卸载扩展             |
| `build`      | 构建扩展             |
| `dev`        | 开发模式运行         |
| `create`     | 创建新扩展           |
| `list`       | 列出已安装扩展       |
| `clear`      | 清理缓存             |
| `runx` / `x` | 执行扩展命令         |
| `schema`     | 生成配置 JSON Schema |
| `commit`     | AI 智能提交          |
| `setup`      | 初始化项目配置       |
| `mcp`        | 启动 MCP Server      |

## 扩展开发

```bash
# 创建扩展
spaceflow create my-extension
```

### 扩展结构

```typescript
import { Command, CommandRunner, Module } from "@spaceflow/core";

@Command({ name: "my-command", description: "My command description" })
class MyCommand extends CommandRunner {
  async run(): Promise<void> {
    console.log("Hello from my command!");
  }
}

@Module({ providers: [MyCommand] })
export class MyModule {}
```

## 编辑器集成

通过 `spaceflow.json` 中的 `support` 字段，`spaceflow install` 会自动将扩展关联到对应编辑器目录：

| 编辑器      | 配置目录     |
| ----------- | ------------ |
| Claude Code | `.claude/`   |
| Windsurf    | `.windsurf/` |
| Cursor      | `.cursor/`   |
| OpenCode    | `.opencode/` |

## 许可证

[MIT](../../LICENSE)
