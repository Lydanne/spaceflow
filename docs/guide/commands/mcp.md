# mcp — MCP 服务

启动 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，聚合所有已安装 Extension 提供的 MCP 工具。

## 基本用法

```bash
# 启动 MCP Server（Meta-tool 代理模式）
spaceflow mcp

# 启动 MCP Inspector（调试模式）
spaceflow mcp --inspector
```

## 工作原理

Spaceflow MCP 采用 **Meta-tool 代理架构**，一次配置即可服务所有项目，无需为每个项目单独设置 `SPACEFLOW_CWD` 环境变量。

### Meta-tool 模式（默认）

运行 `spaceflow mcp` 时，CLI 启动一个 Meta-tool MCP Server，注册以下四个元工具：

| 元工具           | 说明                              |
| ---------------- | --------------------------------- |
| `list_tools`     | 列出指定项目目录下可用的 MCP 工具 |
| `call_tool`      | 调用指定项目目录下的 MCP 工具     |
| `list_resources` | 列出指定项目目录下可用的 MCP 资源 |
| `read_resource`  | 读取指定项目目录下的 MCP 资源内容 |

每个元工具都接收 `cwd`（项目根目录绝对路径）参数，由 AI 编程助手在调用时自动传入当前工作区路径。

**执行流程**：

1. MCP 客户端（编辑器）调用元工具，传入 `cwd`
2. Meta Server 按需 spawn 子进程，连接到项目级 MCP Server
3. 子进程走完整的 CLI 流程：初始化 `.spaceflow` → 加载 Extension → 启动 MCP Server
4. Meta Server 通过 MCP Client SDK 转发请求/响应
5. 连接按 `cwd` 缓存，同一项目复用已有连接

### 直连模式（--inspector）

运行 `spaceflow mcp --inspector` 时，走正常命令调用流程，直接启动项目级 MCP Server 和 Inspector 调试界面。此模式下需要通过 `SPACEFLOW_CWD` 指定工作目录。

## MCP Inspector

使用 `--inspector` 启动 MCP Inspector，提供 Web UI 调试界面：

```bash
spaceflow mcp --inspector
```

Inspector 会自动下载并启动 `@modelcontextprotocol/inspector`，提供：

- 工具列表查看
- 工具调用测试
- 请求/响应日志

## 在编辑器中配置

得益于 Meta-tool 架构，MCP 配置**无需指定项目路径**，一次配置全局生效。

### Windsurf

在 `~/.codeium/windsurf/mcp_config.json` 中添加：

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

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

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

### Cursor

在项目根目录 `.cursor/mcp.json` 或全局配置中添加：

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

::: tip 配置说明
`-y` 参数让 `npx` 自动确认安装，避免首次使用时的交互提示。如果已全局安装 `@spaceflow/cli`，可以直接使用 `"command": "spaceflow", "args": ["mcp"]`。
:::

## 开发 MCP 工具

Extension 通过 `defineExtension` 的 `tools` 字段声明 MCP 工具：

```typescript
import { defineExtension, z } from "@spaceflow/core";

export default defineExtension({
  name: "my-tools",
  commands: [],
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
});
```

## 环境变量

| 变量                  | 说明                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `SPACEFLOW_CWD`       | 指定工作区路径，优先于 `process.cwd()`。Meta-tool 模式下无需手动设置 |
| `SPACEFLOW_MCP_PROXY` | 内部标记，防止 Meta-tool 子进程递归进入代理模式                      |

## 命令行选项

| 选项          | 简写 | 说明                                           |
| ------------- | ---- | ---------------------------------------------- |
| `--inspector` | `-i` | 启动 MCP Inspector 调试模式                    |
| `--verbose`   | `-v` | 详细日志（`-v` 基本，`-vv` 详细，`-vvv` 调试） |
