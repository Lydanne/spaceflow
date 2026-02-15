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

在 `spaceflow.json` 中通过 `support` 字段指定需要关联的编辑器：

```json
{
  "support": ["claudeCode", "windsurf", "cursor"]
}
```

默认值为 `["claudeCode"]`。

## Extension 的四种导出类型

Extension 在 `package.json` 的 `exports` 中声明导出类型，Spaceflow 根据类型执行不同的关联操作：

| 类型       | 说明                     | 关联行为                                           |
| ---------- | ------------------------ | -------------------------------------------------- |
| `flows`    | CLI 子命令               | 不关联到编辑器目录，仅注册为 `spaceflow <command>` |
| `skills`   | 技能文件（`.md` 规范等） | **复制**到编辑器的 `skills/` 目录                  |
| `commands` | 编辑器命令               | 生成 `.md` 文件到编辑器的 `commands/` 目录         |
| `mcps`     | MCP Server               | 注册到编辑器的 `mcp.json` 配置                     |

## 自动关联逻辑

当你运行 `spaceflow install` 时，系统会：

1. 通过 `pnpm add` 将 Extension 安装到 `.spaceflow/node_modules/`
2. 读取 Extension 的 `package.json` 中的导出配置
3. 根据 `support` 配置，将资源关联到对应编辑器目录：
   - **skills** — 将文件**复制**到 `.claude/skills/`、`.windsurf/skills/` 等目录
   - **commands** — 生成 `.md` 命令文件到 `.claude/commands/` 等目录
   - **mcps** — 将 MCP Server 配置写入 `.claude/mcp.json` 等文件
4. 自动更新编辑器目录的 `.gitignore`，避免生成文件被提交

全局安装（`-g`）时，关联到家目录下的对应编辑器目录（如 `~/.claude/`）。

## 目录结构示例

配置 `support: ["claudeCode", "windsurf"]` 后，安装一个包含 skills 和 mcps 的 Extension 会生成如下结构：

```text
project/
├── .claude/
│   ├── skills/
│   │   └── review-spec/          # 从 .spaceflow/node_modules/ 复制
│   │       ├── js&ts.nest.md
│   │       └── vue.base.md
│   └── mcp.json                  # 自动注册 MCP Server
├── .windsurf/
│   ├── skills/
│   │   └── review-spec/          # 从 .spaceflow/node_modules/ 复制
│   │       ├── js&ts.nest.md
│   │       └── vue.base.md
│   └── mcp.json
└── .spaceflow/
    ├── node_modules/              # 所有 Extension 的安装位置
    │   └── @spaceflow/review/
    ├── package.json
    └── spaceflow.json
```

## MCP Server 注册

当 Extension 声明了 `mcps` 导出时，`spaceflow install` 会自动将其注册到编辑器的 `mcp.json`：

```json
{
  "mcpServers": {
    "my-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/.spaceflow/node_modules/my-mcp/dist/index.js"]
    }
  }
}
```

如果 Extension 声明了需要的环境变量，会在 `env` 中生成占位符供用户填写。

## 清理与卸载

- `spaceflow uninstall <name>` — 删除编辑器目录中对应的 skills/commands 文件
- `spaceflow clear` — 清理所有编辑器目录中的 skills 和 commands
