# Teax 架构概览

> Gitea 功能扩展平台 + 飞书控制与消息交互

## 系统定位

Teax 是 **Gitea 的功能扩展平台**，通过 Web UI 为 Gitea 提供增强能力，并通过 **飞书** 实现控制指令和消息交互。

### 核心架构

```text
┌─────────────────────────────────────────────────────────┐
│                        Teax                             │
│  ┌─────────────────┐           ┌─────────────────────┐  │
│  │     Gitea       │◀─────────▶│       飞书          │  │
│  │   功能扩展       │           │   控制 & 消息交互   │  │
│  └─────────────────┘           └─────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Gitea 侧**：扩展 CI/CD、Pages 托管、小程序管理、Agent 运行时等功能
- **飞书侧**：消息通知、机器人指令、审批流程、状态查询

## 平台依赖

| 平台 | 角色 | 用途 |
| ---- | ---- | ---- |
| **Gitea** | 核心 | Git 仓库托管、代码版本管理、Webhook 触发、扩展功能宿主 |
| **飞书** | 交互（可选） | 消息通知、机器人控制、审批流程、团队协作 |

## 用户体系

系统以 **Gitea 用户** 为核心，飞书绑定为可选：

```text
┌──────────────────────────────────────┐
│            Teax 用户                 │
│  ┌────────────────────────────────┐  │
│  │     Gitea 账号 (必需)          │  │
│  │     ─────────────────          │  │
│  │     用户名、邮箱、权限          │  │
│  └────────────────────────────────┘  │
│                 │                    │
│                 ▼ 可选绑定           │
│  ┌────────────────────────────────┐  │
│  │     飞书账号 (可选)            │  │
│  │     ─────────────────          │  │
│  │     接收通知、机器人交互        │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- **Gitea 账号**：必需，作为系统主账号，用于仓库访问和权限控制
- **飞书绑定**：可选，绑定后可接收消息通知、使用飞书机器人交互

### 登录方式

| 方式 | 说明 |
| ---- | ---- |
| **Gitea OAuth** | 使用 Gitea 账号登录（主要方式） |
| **飞书 OAuth** | 使用飞书账号登录，首次登录需关联 Gitea 账号 |

> 无论使用哪种方式登录，最终都需要关联到 Gitea 账号，因为系统核心功能依赖 Gitea。

## 账号与团队管理

团队数据从 **Gitea 同步**，权限通过 **权限组** 分配：

```text
┌─────────────────────────────────────────────────────┐
│                    Gitea                            │
│  ┌───────────────┐    ┌───────────────┐            │
│  │  Organization │    │     Team      │            │
│  └───────┬───────┘    └───────┬───────┘            │
└──────────┼────────────────────┼─────────────────────┘
           │ 同步               │ 同步
           ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                    Teax                             │
│  ┌───────────────┐    ┌───────────────┐            │
│  │  Organization │    │     Team      │            │
│  └───────┬───────┘    └───────┬───────┘            │
│          │                    │                    │
│          └────────┬───────────┘                    │
│                   ▼                                │
│          ┌───────────────┐                         │
│          │   权限组       │                         │
│          │ Permission    │                         │
│          │   Group       │                         │
│          └───────────────┘                         │
└─────────────────────────────────────────────────────┘
```

| 功能 | 说明 |
| ---- | ---- |
| **团队同步** | 从 Gitea 同步 Organization 和 Team 结构 |
| **账号管理** | 用户账号与 Gitea 账号关联，支持飞书绑定 |
| **权限组** | 创建权限组，分配功能权限（如发布、审批等）。**管理员或组织 Owner/Admin 可创建/编辑/删除** |
| **团队权限** | 将权限组分配给 Gitea Team，团队成员自动继承。**管理员或团队 Owner 可操作** |

## 核心功能模块

### 1. 项目管理

- **关联 Gitea 仓库**：绑定 Gitea 平台的 Git 仓库
- **项目工作台**：包含 Actions、Agents、Pages、Workspaces、设置等 Tab
- **分支管理**：拉取远程仓库的分支列表，选择工作分支

### 2. CI/CD 集成（Gitea Actions）

```text
代码提交 → Gitea Actions 自动触发 → workflow 执行 → Teax Webhook 接收通知 → 飞书推送
```

- **CI/CD 执行**：由 Gitea Actions 原生处理，Teax 不参与构建部署过程
- **数据展示**：Teax 后端通过 Gitea API 获取 workflow runs，前端代理访问
- **Workflow 解析**：解析 workflow YAML 并展示信息卡片
- **通知增值**：Gitea Webhook 推送事件到 Teax，根据项目通知设置发送飞书通知

详见：[CI/CD 集成文档](./cicd-integration.md)

### 3. Agent 系统

每个 Agent 运行实例对应一个 Session，由 **`@opencode-ai/sdk`** 驱动执行。

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
         ├─ 8. [可选] git add . && git commit && Gitea API 创建 PR
         └─ 9. 清理：client.session.delete + cleanup opencode server + 删除工作区
```

详见：[Agent 系统文档](./agent-system.md)

### 4. 工作区（Workspace）

工作区是 **与项目仓库绑定的容器化开发环境**。每个工作区对应一个 Docker 容器，容器内预装 openvscode-server + Git + Node.js 等开发工具链。

```text
创建工作区 → 启动容器（clone 仓库 + openvscode-server）
    │
    ├── Web VSCode：       /workspace/{name}/ide/     → 反向代理到容器内 openvscode-server
    ├── 测试环境预览：     /workspace/{name}/          → 反向代理到容器内应用端口
    ├── VSCode Remote：    SSH 连接容器（端口映射）
    │
    └── 删除工作区 → 容器销毁 + 清理存储卷
```

详见：[工作区文档](./workspace.md)

### 5. 飞书集成

- **消息通知**：Workflow 执行结果、Agent 完成、代码推送等事件通知
- **机器人指令**：通过飞书机器人控制 Teax（/deploy、/status、/rollback 等）
- **审批流程**：发布审批、配置变更审批
- **卡片交互**：交互式卡片表单，支持按钮、输入框、下拉选择等

详见：
- [飞书集成文档](./feishu-integration.md)
- [飞书卡片交互文档](./feishu-card-interaction.md)

## 技术栈

### 前端

- **框架**：Nuxt 4（Vue 3 + TypeScript）
- **UI 组件**：Nuxt UI（基于 Radix Vue + Tailwind CSS）
- **状态管理**：Pinia
- **路由**：Nuxt 文件路由（采用 Gitea 路由规范）

### 后端

- **运行时**：Nitro（Nuxt 4 内置）
- **数据库**：PostgreSQL + Drizzle ORM
- **认证**：Session-based（Nuxt Auth Utils）
- **任务队列**：BullMQ（计划中）
- **容器运行时**：Docker（dockerode）

### 第三方集成

- **Gitea**：OAuth 登录、API 调用、Webhook 接收
- **飞书**：OAuth 登录、消息推送、机器人指令、审批流程
- **LLM**：OpenAI、Azure OpenAI、vLLM、火山引擎方舟等（通过 open-code）

## 相关文档

- [API 规范](./api-specification.md) - 前端路由和后端 API 设计规范
- [权限系统](./permission-system.md) - 管理员体系、权限组、访问控制
- [CI/CD 集成](./cicd-integration.md) - Gitea Actions 集成和 Workflow 管理
- [Agent 系统](./agent-system.md) - AI Agent 执行架构和 open-code 集成
- [工作区](./workspace.md) - 容器化开发环境和 Web IDE
- [数据库设计](./database-design.md) - 完整的数据库 Schema
- [部署配置](./deployment.md) - Docker Compose 和环境变量
- [飞书集成](./feishu-integration.md) - 飞书通知、机器人、审批
- [飞书卡片交互](./feishu-card-interaction.md) - 交互式卡片表单设计
- [开发计划](./plan.md) - 项目开发进度和里程碑
