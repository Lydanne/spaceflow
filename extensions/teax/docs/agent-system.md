# OpenCode 集成文档

> 工作区的 AI 辅助编辑功能 - 基于 @opencode-ai/sdk

## 概述

OpenCode 是工作区的 **AI 辅助编辑功能**，作为 Web VSCode 的补充编辑方式。每个工作区容器内同时运行 Web VSCode 和 OpenCode 服务，用户可以选择：

- **手动编辑**：通过 Web VSCode 直接编辑代码
- **AI 辅助编辑**：通过 OpenCode 让 AI Agent 自动编辑代码

## Agent Session 概念

每个 OpenCode 运行实例对应一个 Session，由 **`@opencode-ai/sdk`** 驱动执行。Session 包含运行状态、步骤追踪、token 消耗和实时日志流。

### Session 状态

- **运行中**：open-code 正在处理 prompt，执行工具调用
- **已完成**：open-code session 正常结束，产物（PR 等）已创建
- **已停止**：手动停止，open-code server 已关闭
- **失败**：LLM 调用错误、工具执行异常或超时

## 整体执行流程

```text
触发（手动 / Webhook / 飞书）
         │
         ▼
  AgentService.startSession()
         │
         ├─ 1. 克隆/更新项目仓库到隔离工作区
         ├─ 2. 从 agent_secrets 读取 API Key（AES-256-GCM 解密）
         ├─ 3. createOpencode({ port, config: buildOpenCodeConfig(llmConfig) })
         ├─ 4. client.auth.set({ type: "api", key: decryptedApiKey })
         ├─ 5. client.session.create({ title: "teax-{sessionId}" })
         ├─ 6. client.session.prompt({ noReply:true, parts:[systemPrompt] })
         ├─ 7. client.session.prompt({ model, parts:[userPrompt] })  ← 流式消费
         │        │
         │        ├─ text        → session_logs(stdout)  + WebSocket push
         │        ├─ tool_use    → session_logs(tool)    + WebSocket push
         │        ├─ reasoning   → session_logs(reasoning)
         │        ├─ step_start  → session_logs(system) + 更新 AgentSession.steps
         │        └─ step_finish → 累加 tokens_used / cost
         │
         ├─ 8. [可选] git add . && git commit && Gitea API 创建 PR
         │        └─ 写入 AgentSession.pr_url
         └─ 9. 清理：client.session.delete + cleanup opencode server + 删除工作区
```

## open-code 配置构建

对应 `OpenCodeAdapter.buildOpenCodeConfig()`，Teax 动态生成 open-code 配置：

```typescript
function buildOpenCodeConfig(llmConfig: AgentLlmConfig): Record<string, any> {
  const { providerID, model, baseUrl } = llmConfig;
  return {
    model: `${providerID}/${model}`,
    provider: {
      [providerID]: {
        npm: "@ai-sdk/openai-compatible",
        name: providerID,
        options: baseUrl ? { baseURL: baseUrl } : undefined,
        models: {
          [model]: {
            tool_call: true,
            context: 128000,
            output: 16000,
          },
        },
      },
    },
  };
}
```

## 支持的 LLM 供应商

| 供应商 | providerID | baseUrl |
| ------ | ---------- | ------- |
| OpenAI | `openai` | 默认（无需配置） |
| Azure OpenAI | `azure-openai` | `https://{resource}.openai.azure.com/` |
| 私有 vLLM | `custom-vllm` | `http://内网:8000/v1` |
| 火山引擎方舟 | `volc-ark` | `https://ark.cn-beijing.volces.com/api/v3` |
| Anthropic（兼容层） | `anthropic-compat` | `https://api.anthropic.com/v1` |

## 日志流映射

open-code 流式事件 → `session_logs` 类型映射：

| open-code 事件 | session_logs.type | content 说明 |
| ------------- | ----------------- | ------------ |
| `text` | `stdout` | Agent 输出的文本 |
| `tool_use` | `tool` | JSON：`{ tool, input, output, status }` |
| `reasoning` | `reasoning` | 思维链（前端可折叠展示） |
| `step_start` | `system` | `"[Step N] 开始"` |
| `step_finish` | `system` | `"[Step N] 完成，tokens: xxx, cost: $xxx"` |
| `error` | `stderr` | 错误信息 |

## 工具执行隔离

open-code 的 `bash` 工具具有执行 shell 命令的能力，必须在隔离容器中运行：

```text
AgentService (宿主)
  └─ docker run (隔离容器)
       ├─ 镜像：teax/agent-runner（内置 Node.js + opencode-ai/sdk）
       ├─ 挂载：项目工作区目录（读写）
       ├─ 网络：仅允许出站到 LLM API + Gitea（其余拒绝）
       ├─ 用户：非 root（uid=1000）
       └─ 资源：CPU/内存按 Agent.resources 配置限制
```

AgentService 通过 Docker SDK（`dockerode`）管理容器生命周期，容器内通过 stdio 与宿主通信传递 open-code 结果。

## OpenCode API（用于 CI/CD）

Teax 提供 OpenCode API 供 Gitea Actions 调用。API 内部通过 **OpenCode 客户端**（`@opencode-ai/sdk`）连接到 CI 工作区容器内运行的 **OpenCode 服务端**。

### 架构说明

```text
Gitea Actions
    ↓ HTTP Request
Teax API (/api/repos/{owner}/{repo}/opencode/sessions)
    ↓ OpenCode Client SDK
CI 工作区容器
    ├── OpenCode 服务端（监听端口 3100）
    ├── 项目代码仓库
    └── 开发工具链
```

### API 端点

```typescript
// 创建 OpenCode Session
POST /api/repos/{owner}/{repo}/opencode/sessions
Body: {
  prompt: string;           // AI 任务描述
  systemPrompt?: string;    // 系统提示词
  model?: string;           // LLM 模型（默认使用项目配置）
  branch?: string;          // 工作分支（默认 main）
}
Response: {
  sessionId: string;
  status: 'running';
  workspaceId: string;      // CI 工作区 ID
}

// 获取 Session 状态
GET /api/repos/{owner}/{repo}/opencode/sessions/{sessionId}
Response: {
  sessionId: string;
  status: 'running' | 'completed' | 'failed';
  steps: number;
  tokensUsed: number;
  cost: number;
  prUrl?: string;           // 创建的 PR 链接
  errorMessage?: string;
}

// 获取 Session 日志（SSE 流式）
GET /api/repos/{owner}/{repo}/opencode/sessions/{sessionId}/logs
Response: Server-Sent Events
  event: log
  data: { type: 'stdout' | 'tool' | 'reasoning', content: string }

// 停止 Session
POST /api/repos/{owner}/{repo}/opencode/sessions/{sessionId}/stop
```

### Gitea Actions 使用示例

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger OpenCode Review
        run: |
          curl -X POST \
            -H "Authorization: token ${{ secrets.TEAX_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "prompt": "Review this PR and suggest improvements",
              "branch": "${{ github.head_ref }}"
            }' \
            https://teax.example.com/api/repos/${{ github.repository }}/opencode/sessions
```

### 权限控制

- **认证**：需要 Gitea Personal Access Token 或 Teax API Token
- **授权**：调用者需要对仓库有写权限
- **限流**：每个项目每小时最多 10 个并发 Session

## 安全考虑

| 风险点 | 防护措施 |
| ------ | -------- |
| **任意代码执行** | 容器隔离，限制网络访问 |
| **资源耗尽** | CPU/内存限制，超时机制 |
| **敏感信息泄露** | API Key 加密存储（AES-256-GCM） |
| **恶意工具调用** | 工具白名单，参数校验 |
| **容器逃逸** | 非 root 用户运行，只读文件系统（除工作区） |

## 相关文档

- [架构概览](./overview.md) - 系统整体架构
- [工作区](./workspace.md) - 容器化开发环境
- [数据库设计](./database-design.md) - Agent 相关表结构
