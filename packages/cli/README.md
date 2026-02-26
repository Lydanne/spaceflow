# @spaceflow/cli

[![npm version](https://img.shields.io/npm/v/@spaceflow/cli?color=blue)](https://www.npmjs.com/package/@spaceflow/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow CLI 壳子入口，提供 `spaceflow` / `space` 命令。负责引导 `.spaceflow/` 工作目录并启动 `@spaceflow/core` 运行时。

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

## 工作原理

CLI 本身不包含任何命令实现，职责仅限于：

1. 读取 `.spaceflow/package.json` 确定依赖
2. 生成 `.spaceflow/bin/index.js` 入口文件
3. 通过 `execSync` 启动子进程执行 `@spaceflow/core` 的 `exec()` 函数

所有命令（内置 13 个 + 外部扩展）均由 `@spaceflow/core` 提供。

## 内置命令

| 命令         | 说明                 |
| ------------ | -------------------- |
| `install`    | 安装扩展             |
| `uninstall`  | 卸载扩展             |
| `build`      | 构建扩展             |
| `dev`        | 开发模式运行         |
| `create`     | 创建新扩展           |
| `update`     | 更新扩展             |
| `list`       | 列出已安装扩展       |
| `clear`      | 清理缓存             |
| `runx` / `x` | 执行扩展命令         |
| `schema`     | 生成配置 JSON Schema |
| `commit`     | AI 智能提交          |
| `setup`      | 初始化项目配置       |
| `mcp`        | 启动 MCP Server      |

## 扩展开发

```bash
# 创建命令型扩展
spaceflow create command my-extension

# 创建 MCP 服务扩展
spaceflow create mcp my-mcp
```

### 扩展结构

```typescript
import { defineExtension } from "@spaceflow/core";

export default defineExtension({
  name: "my-extension",
  commands: [
    {
      name: "my-command",
      description: "My command description",
      run: async (args, options, ctx) => {
        ctx.output.info("Hello from my command!");
      },
    },
  ],
});
```

## 编辑器集成

通过配置文件中的 `support` 字段，`spaceflow install` 会自动将扩展关联到对应编辑器目录：

| 编辑器      | 配置目录     |
| ----------- | ------------ |
| Claude Code | `.claude/`   |
| Windsurf    | `.windsurf/` |
| Cursor      | `.cursor/`   |
| OpenCode    | `.opencode/` |

## 许可证

[MIT](../../LICENSE)
