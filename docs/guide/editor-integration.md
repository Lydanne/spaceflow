# 编辑器集成

Spaceflow 支持将 Extension 的资源自动关联到多个 AI 编程工具的配置目录中。

## 支持的编辑器

| 编辑器      | 配置目录     | 配置值       |
| ----------- | ------------ | ------------ |
| Claude Code | `.claude/`   | `claudeCode` |
| Windsurf    | `.windsurf/` | `windsurf`   |
| Cursor      | `.cursor/`   | `cursor`     |
| OpenCode    | `.opencode/` | `opencode`   |

## 配置

在配置文件（`.spaceflowrc` 或 `spaceflow.json`）中通过 `support` 字段指定需要关联的编辑器：

```json
{
  "support": ["claudeCode", "windsurf", "cursor"]
}
```

默认值为 `["claudeCode"]`。

## Extension 的四种导出类型

Extension 在 `package.json` 的 `spaceflow` 字段中声明导出类型，Spaceflow 根据类型执行不同的关联操作：

| 类型        | 说明                     | 关联行为                                           |
| ----------- | ------------------------ | -------------------------------------------------- |
| `flow`      | CLI 子命令（默认）       | 不关联到编辑器目录，仅注册为 `spaceflow <command>` |
| `extension` | 技能文件（`.md` 规范等） | **复制**到编辑器的 `skills/` 目录                  |
| `command`   | 编辑器命令               | **生成** `.md` 文件到编辑器的 `commands/` 目录     |
| `mcp`       | MCP 工具                 | 注册到编辑器的 `mcp.json` 配置                     |

### 在 package.json 中声明

**简化格式** — 单一导出类型：

```json
{
  "spaceflow": {
    "type": "extension",
    "entry": "."
  }
}
```

**完整格式** — 多导出类型（通过 `exports` 对象）：

```json
{
  "spaceflow": {
    "exports": {
      "my-flow": { "type": "flow", "entry": "." },
      "my-skills": { "type": "extension", "entry": "./skills" },
      "my-cmd": { "type": "command", "entry": "./commands" }
    }
  }
}
```

未声明 `spaceflow` 字段时，默认作为 `extension` 类型处理（整个包复制到 `skills/` 目录）。

## 自动关联逻辑

### 安装单个 Extension

运行 `spaceflow install <source>` 时，系统会：

1. 通过包管理器将 Extension 安装到 `.spaceflow/node_modules/`
2. 读取 Extension 的 `package.json` 中的 `spaceflow` 配置
3. 根据 `support` 配置，将资源关联到对应编辑器目录：
   - **extension** — 将文件**复制**到 `.claude/skills/`、`.windsurf/skills/` 等目录
   - **command** — 生成 `.md` 命令文件到 `.claude/commands/` 等目录
   - **mcp** — 将 MCP Server 配置写入 `.claude/mcp.json` 等文件
4. 自动更新编辑器目录的 `.gitignore`，避免生成文件被提交
5. 将依赖记录到配置文件的 `dependencies` 字段
6. 自动重新生成 JSON Schema

### 批量安装

运行 `spaceflow install`（无参数）时，会读取配置文件中 `dependencies` 字段的所有依赖，批量安装并关联到编辑器目录。

### 全局安装

使用 `-g` 参数时，Extension 安装到 `~/.spaceflow/node_modules/`，资源关联到家目录下的编辑器目录（如 `~/.claude/skills/`）。

## 目录结构示例

配置 `support: ["claudeCode", "windsurf"]` 后，安装一个包含 `extension` 和 `command` 导出的 Extension 会生成如下结构：

```text
project/
├── .claude/
│   ├── skills/
│   │   └── review-spec/          # extension 类型：从 .spaceflow/node_modules/ 复制
│   │       ├── js&ts.nest.md
│   │       └── vue.base.md
│   └── commands/
│       └── review.md             # command 类型：自动生成的命令文档
├── .windsurf/
│   ├── skills/
│   │   └── review-spec/
│   │       ├── js&ts.nest.md
│   │       └── vue.base.md
│   └── commands/
│       └── review.md
└── .spaceflow/
    ├── node_modules/              # 所有 Extension 的安装位置
    │   └── @spaceflow/review/
    └── package.json
```

## MCP Server

Spaceflow 采用 [Meta-tool 代理架构](/guide/commands/mcp)，所有 Extension 通过 `defineExtension` 的 `mcp` 字段声明的 MCP 工具，会被 `spaceflow mcp` 统一聚合。编辑器只需配置一次 Spaceflow MCP Server：

```json
{
  "mcpServers": {
    "spaceflow": {
      "command": "npx",
      "args": ["-y", "@spaceflow/cli", "mcp"]
    }
  }
}
```

::: tip
对于声明了 `mcp` 导出类型的 Extension（`package.json` 中 `spaceflow.type: "mcp"`），`spaceflow install` 仍会将其 MCP Server 配置写入编辑器的 `mcp.json`。但推荐使用上述 Meta-tool 统一入口，无需为每个 Extension 单独配置。
:::

各编辑器的详细 MCP 配置方式参见 [MCP 服务](/guide/commands/mcp#在编辑器中配置)。

## 清理与卸载

- **`spaceflow uninstall <name>`** — 从 `.spaceflow/node_modules/` 卸载 Extension，删除各编辑器目录中对应的 `skills/` 和 `commands/` 文件，并从配置文件中移除依赖记录
- **`spaceflow clear`** — 清理 `.spaceflow/` 目录内的缓存文件（保留 `package.json`），并删除各编辑器目录中的所有 `skills/` 和 `commands/` 内容
- **`spaceflow clear -g`** — 清理全局 `~/.spaceflow/` 目录及家目录下编辑器目录中的对应内容
