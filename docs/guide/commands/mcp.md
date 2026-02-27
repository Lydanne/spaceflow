# mcp — MCP 服务

启动 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，聚合所有已安装 Extension 提供的 MCP 工具。

## 基本用法

```bash
# 启动 MCP Server
spaceflow mcp

# 启动 MCP Inspector（调试模式）
spaceflow mcp --inspector
```

## 工作原理

1. **扫描 Extension** — 加载所有已安装的 Extension
2. **收集工具** — 查找 `ExtensionDefinition` 中的 `mcp` 字段，提取 MCP 工具定义
3. **启动服务** — 通过 stdio 传输协议启动 MCP Server
4. **注册工具** — 将所有工具注册到 MCP Server，支持 Zod Schema 参数校验

## MCP Inspector

使用 `--inspector` 启动 MCP Inspector，提供 Web UI 调试界面：

```bash
spaceflow mcp --inspector
```

Inspector 会自动下载并启动 `@modelcontextprotocol/inspector`，提供：

- 工具列表查看
- 工具调用测试
- 请求/响应日志

## 工作目录

MCP Server 需要知道项目的工作目录，以便找到 `.spaceflowrc` 配置和已安装的扩展。

通过环境变量 `SPACEFLOW_CWD` 指定工作区路径：

```json
{
  "env": {
    "SPACEFLOW_CWD": "/path/to/your/project"
  }
}
```

> **注意**: 当 MCP 客户端（如 Windsurf、Cursor）启动 MCP Server 时，`process.cwd()` 可能不是你的项目目录。建议始终配置 `SPACEFLOW_CWD` 以确保 MCP Server 能正确加载扩展。

## 在编辑器中配置

### Windsurf

在 `~/.codeium/windsurf/mcp_config.json` 中添加：

```json
{
  "mcpServers": {
    "spaceflow": {
      "command": "npx",
      "args": ["@spaceflow/cli", "mcp"],
      "env": {
        "SPACEFLOW_CWD": "/path/to/your/project"
      }
    }
  }
}
```

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "spaceflow": {
      "command": "npx",
      "args": ["@spaceflow/cli", "mcp"],
      "env": {
        "SPACEFLOW_CWD": "/path/to/your/project"
      }
    }
  }
}
```

### Cursor

在 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "spaceflow": {
      "command": "npx",
      "args": ["@spaceflow/cli", "mcp"],
      "env": {
        "SPACEFLOW_CWD": "/path/to/your/project"
      }
    }
  }
}
```

## 开发 MCP 工具

Extension 通过 `defineExtension` 的 `mcp` 字段声明 MCP 工具：

```typescript
import { defineExtension, z } from "@spaceflow/core";

export default defineExtension({
  name: "my-tools",
  commands: [],
  mcp: {
    name: "my-tools",
    version: "1.0.0",
    description: "我的工具集",
    tools: [
      {
        name: "hello",
        description: "打招呼",
        inputSchema: z.object({
          name: z.string().describe("名字"),
        }),
        handler: async (input, ctx) => {
          const { name } = input as { name: string };
          return { content: [{ type: "text", text: `Hello, ${name}!` }] };
        },
      },
    ],
  },
});
```

## 环境变量

| 变量            | 说明                                   |
| --------------- | -------------------------------------- |
| `SPACEFLOW_CWD` | 指定工作区路径，优先于 `process.cwd()` |

## 命令行选项

| 选项          | 简写 | 说明                                           |
| ------------- | ---- | ---------------------------------------------- |
| `--inspector` | `-i` | 启动 MCP Inspector 调试模式                    |
| `--verbose`   | `-v` | 详细日志（`-v` 基本，`-vv` 详细，`-vvv` 调试） |
