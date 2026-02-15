# @spaceflow/cli

Spaceflow CLI 工具，提供 `spaceflow` / `space` 命令，是所有 Spaceflow 功能的统一入口。

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

| 命令 | 说明 |
| --- | --- |
| `install` | 安装插件（命令/技能） |
| `uninstall` | 卸载插件 |
| `build` | 构建插件 |
| `dev` | 开发模式运行 |
| `create` | 创建新插件 |
| `list` | 列出已安装插件 |
| `clear` | 清理缓存 |
| `runx` / `x` | 执行插件命令 |
| `schema` | 生成配置 JSON Schema |
| `commit` | AI 智能提交 |
| `setup` | 初始化项目配置 |
| `mcp` | 启动 MCP Server |

## 插件开发

```bash
# 创建命令插件
spaceflow create my-plugin --type command

# 创建技能插件
spaceflow create my-skill --type skill
```

### 插件结构

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

通过 `spaceflow.json` 中的 `support` 字段，`spaceflow install` 会自动将插件关联到对应编辑器目录：

| 编辑器 | 配置目录 |
| --- | --- |
| Claude Code | `.claude/` |
| Windsurf | `.windsurf/` |
| Cursor | `.cursor/` |
| OpenCode | `.opencode/` |

## 许可证

[MIT](../LICENSE)
