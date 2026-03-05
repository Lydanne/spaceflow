# Teax 设计文档

> Gitea 功能扩展平台 + 飞书控制与消息交互

## 概述

Teax 是 **Gitea 的功能扩展平台**，通过 Web UI 为 Gitea 提供增强能力，并通过 **飞书** 实现控制指令和消息交互。

### 核心定位

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

### 平台依赖

| 平台 | 角色 | 用途 |
| ---- | ---- | ---- |
| **Gitea** | 核心 | Git 仓库托管、代码版本管理、Webhook 触发、扩展功能宿主 |
| **飞书** | 交互（可选） | 消息通知、机器人控制、审批流程、团队协作 |

### 用户体系

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

#### 管理员体系

系统内置两种权限级别：

| 角色 | 获取方式 | 能力 |
| ---- | -------- | ---- |
| **系统管理员** | 首次注册用户自动获得，或由已有管理员手动授权 | 访问 `/admin` 后台、管理所有用户、手动同步组织/团队、设置其他用户为管理员、管理所有组织的权限组 |
| **普通用户** | 通过 Gitea OAuth 或飞书 OAuth 注册 | 访问自己所属组织的项目和功能，权限由所在团队的权限组决定 |

> **首次登录规则**：当 `users` 表为空时，第一个通过 Gitea OAuth 登录的用户自动成为系统管理员（`is_admin = true`），不受 Gitea 账号权限影响。

#### 权限管理访问控制

权限组的管理（创建/编辑/删除权限组、为团队分配/移除权限组）仅限以下角色操作：

| 角色 | 权限管理范围 | 说明 |
| ---- | ------------ | ---- |
| **系统管理员** | 所有组织的所有权限组 | `is_admin = true` 的用户可管理任意组织的权限配置 |
| **团队 Owner** | 所属团队的权限组分配 | `team_members.role = 'owner'` 的用户可管理自己所属团队的权限组绑定 |

```text
权限管理判定流程：

请求到达 → 是系统管理员？ ──是──→ 允许
                │
               否
                │
                ▼
         是团队 Owner？ ──是──→ 允许（仅限所属团队）
                │
               否
                │
                ▼
             拒绝 403
```

> **注意**：权限组本身属于组织级别，由管理员创建。团队 Owner 只能将已有的权限组**分配给**自己所在的团队，不能创建/编辑/删除权限组定义。

#### 账号与团队管理

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
| **权限组** | 创建权限组，分配功能权限（如发布、审批等）。**仅管理员可创建/编辑/删除** |
| **团队权限** | 将权限组分配给 Gitea Team，团队成员自动继承。**管理员或团队 Owner 可操作** |

#### 登录方式

| 方式 | 说明 |
| ---- | ---- |
| **Gitea OAuth** | 使用 Gitea 账号登录（主要方式） |
| **飞书 OAuth** | 使用飞书账号登录，首次登录需关联 Gitea 账号 |

> 无论使用哪种方式登录，最终都需要关联到 Gitea 账号，因为系统核心功能依赖 Gitea。

## 核心功能模块

### 1. 项目管理

#### 1.1 创建项目

- **关联 Gitea 仓库**：绑定 Gitea 平台的 Git 仓库
- **仓库地址输入**：格式如 `org/repo`（例：`xg/nodecloud`）
- **创建确认**：验证仓库可访问性后创建项目

#### 1.2 分支选择

- **分支列表**：拉取远程仓库的分支列表
- **默认分支**：默认选择 `master` 或 `main`
- **拉取操作**：将选定分支代码同步到本地

### 2. 项目工作台

项目创建后进入工作台视图，包含以下 Tab 页：

| Tab | 功能描述 |
|-----|---------|
| **Actions** | 展示 Gitea Actions workflow runs（CI/CD 由 Gitea 原生驱动），含 workflow 信息卡片、状态美化、定时调度可读化 |
| **Agents** | Agent 实例管理，Session 运行状态监控 |
| **Pages** | 静态页面托管配置 |
| **设置** | 通知配置、危险操作（删除项目） |

> **Actions Tab 说明**：CI/CD 完全由 Gitea Actions（`.gitea/workflows/*.yml`）驱动。Teax 通过 Gitea API 代理展示 workflow runs 列表，提供飞书通知等增值功能。不再维护独立的 PublishTask 发布系统。

### 3. CI/CD 集成（Gitea Actions）

#### 3.1 架构

```text
代码提交 → Gitea Actions 自动触发 → workflow 执行 → Teax Webhook 接收通知 → 飞书推送
```

- **CI/CD 执行**：由 Gitea Actions 原生处理，Teax 不参与构建部署过程
- **数据展示**：Teax 通过 `/repos/{owner}/{repo}/actions/runs` API 获取 workflow runs
- **Workflow 解析**：Teax 通过 `/repos/{owner}/{repo}/contents/{path}` API 获取 workflow YAML 并解析
- **通知增值**：Gitea Webhook 推送事件到 Teax，Teax 根据项目通知设置发送飞书通知

#### 3.2 Workflow 信息卡片

选中具体 workflow 时，在 runs 列表上方展示信息卡片：

| 信息项 | 数据来源 | 说明 |
| ------ | -------- | ---- |
| **触发方式** | YAML `on` 字段 | 蓝色圆角 badge（push / schedule / workflow_dispatch 等） |
| **输入参数数量** | YAML `on.workflow_dispatch.inputs` | 如 "3 个参数"（有参数时才显示） |
| **定时调度** | YAML `on.schedule[].cron` | 使用 `cronstrue` 库转为中文可读文本（如 "在 02:00, 仅在 星期一"），hover 显示原始 cron |
| **文件路径** | workflow `.path` 字段 | 等宽字体显示 `.gitea/workflows/xxx.yaml` |
| **描述** | YAML `x-description` 自定义扩展字段 | 可折叠显示，默认收起，点击"详情"展开 |

> **自定义扩展字段约定**：所有 Teax 自定义的 YAML 顶级字段使用 `x-` 前缀（如 `x-description`），以避免与标准 GitHub Actions / Gitea Actions 字段冲突。

#### 3.3 Workflow Run 卡片

每个 run 卡片包含以下信息：

```text
┌──────────────────────────────────────────────────────────────┐
│  ✓  ci: 添加工作流描述信息  #508  [成功]                    ↗  │
│  🔀 develop  9bcc505  [推送]  👤 liuhuan  🕐 5 分钟前  ⏱ 2m 36s │
└──────────────────────────────────────────────────────────────┘
```

- **左侧状态图标**：根据状态显示不同颜色图标（蓝色时钟=排队中、琥珀色旋转=运行中、绿色勾=成功、红色叉=失败、灰色禁止=已取消）
- **状态 badge**：中文标签（排队中/等待中/运行中/成功/失败/已取消/已跳过）
- **元信息行**：带图标装饰（git-branch 分支、user 用户、clock 相对时间、timer 耗时）
- **事件 badge**：中文化（push→推送、workflow_dispatch→手动触发、schedule→定时、pull_request→PR）
- **相对时间**：刚刚 / N 分钟前 / N 小时前 / N 天前（超 7 天显示日期）
- **耗时**：空值自动隐藏（不显示无意义的 "-"）
- 点击整个卡片跳转到 Gitea Actions 查看详细日志

#### 3.4 触发 Workflow 弹窗

- Workflow 下拉选项显示 `名称 — 描述`（有 `x-description` 时追加描述文案）
- 选中 workflow 后显示 `x-description` 描述信息
- 分支选择器 + 动态输入参数表单（根据 `workflow_dispatch.inputs` 生成）

#### 3.5 Workflow Run 状态映射

| Gitea status | Gitea conclusion | 中文标签 | 颜色 | 图标 |
| ------------ | ---------------- | -------- | ---- | ---- |
| `queued` | - | 排队中 | info(蓝) | clock |
| `waiting` | - | 等待中 | info(蓝) | clock |
| `running` / `in_progress` | - | 运行中 | warning(琥珀) | loader(旋转) |
| - | `success` | 成功 | success(绿) | check-circle |
| - | `failure` | 失败 | error(红) | x-circle |
| - | `cancelled` | 已取消 | neutral(灰) | ban |
| - | `skipped` | 已跳过 | - | skip-forward |

#### 3.6 Workflows API

`GET /api/orgs/{orgId}/projects/{projectId}/workflows`

返回字段：

```typescript
interface WorkflowItem {
  id: string;
  name: string;
  path: string;
  state: string;
  description: string;    // 来自 YAML x-description 字段
  triggers: string[];     // 来自 YAML on 字段（push / schedule / workflow_dispatch 等）
  schedules: string[];    // 来自 YAML on.schedule[].cron（cron 表达式列表）
  inputs: Record<string, WorkflowInput>;  // 来自 YAML on.workflow_dispatch.inputs
}
```

后端解析逻辑：
- `extractTriggers(doc)` — 从 `on` 字段提取触发方式列表（支持 string / array / object keys 三种格式）
- `extractSchedules(doc)` — 从 `on.schedule[].cron` 提取 cron 表达式列表
- `extractInputs(doc)` — 从 `on.workflow_dispatch.inputs` 提取输入参数定义

### 4. Agent Session 管理

#### 4.1 Session 概念

每个 Agent 运行实例对应一个 Session，由 **`@opencode-ai/sdk`** 驱动执行。Session 包含运行状态、open-code 步骤追踪、token 消耗和实时日志流。

#### 4.2 Session 状态

- **运行中**：open-code 正在处理 prompt，执行工具调用
- **已完成**：open-code session 正常结束，产物（PR 等）已创建
- **已停止**：手动停止，open-code server 已关闭
- **失败**：LLM 调用错误、工具执行异常或超时

---

### 5. Agent 执行架构（open-code 集成）

#### 5.1 整体执行流程

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
         │        └─ step_finish → 累加 tokensUsed / cost
         │
         ├─ 8. [可选] git add . && git commit && Gitea API 创建 PR
         │        └─ 写入 AgentSession.prUrl
         └─ 9. 清理：client.session.delete + cleanup opencode server + 删除工作区
```

#### 5.2 open-code 配置构建

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

#### 5.3 支持的 LLM 供应商

| 供应商 | providerID | baseUrl |
| ------ | ---------- | ------- |
| OpenAI | `openai` | 默认（无需配置） |
| Azure OpenAI | `azure-openai` | `https://{resource}.openai.azure.com/` |
| 私有 vLLM | `custom-vllm` | `http://内网:8000/v1` |
| 火山引擎方舟 | `volc-ark` | `https://ark.cn-beijing.volces.com/api/v3` |
| Anthropic（兼容层） | `anthropic-compat` | `https://api.anthropic.com/v1` |

#### 5.4 日志流映射

open-code 流式事件 → `session_logs` 类型映射：

| open-code 事件 | session_logs.type | content 说明 |
| ------------- | ----------------- | ------------ |
| `text` | `stdout` | Agent 输出的文本 |
| `tool_use` | `tool` | JSON：`{ tool, input, output, status }` |
| `reasoning` | `reasoning` | 思维链（前端可折叠展示） |
| `step_start` | `system` | `"[Step N] 开始"` |
| `step_finish` | `system` | `"[Step N] 完成，tokens: xxx, cost: $xxx"` |
| `error` | `stderr` | 错误信息 |

#### 5.5 工具执行隔离

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

## 页面设计

### 路由结构

```text
/                                    # 首页/仪表盘（组织列表 + 统计卡片）
├── /auth
│   ├── /login                       # 登录页
│   └── /callback                    # OAuth 回调
│       ├── /gitea                   # Gitea OAuth 回调
│       └── /feishu                  # 飞书 OAuth 回调
│
├── /orgs                            # 组织列表（首页已整合）
│   └── /:orgId
│       ├── /projects                # 项目列表
│       │   ├── /new                 # 创建项目（仓库搜索选择）
│       │   └── /:projectId          # 项目工作台（Tab 页面）
│       │       # Tab: Actions（Gitea workflow runs）| Agents（Phase 3）| Pages（Phase 3）| 设置
│       │       # 设置 Tab: 基本信息 + 通知设置 + 删除项目
│       │
│       └── /settings                # 组织设置（Tab 页面，requireOrgOwnerOrAdmin）
│           # Tab: 团队管理（含同步/成员/权限分配）| 权限组管理（CRUD + 权限勾选）
│
├── /account                         # 个人账号（待实现）
│   ├── /profile                     # 个人信息
│   ├── /feishu                      # 飞书绑定
│   └── /notifications               # 通知设置
│
└── /admin                           # 系统管理（仅管理员可访问）
    ├── /users                       # 用户管理（列表/切换管理员）
    ├── /orgs                        # 组织管理（列表/同步状态/详情）
    │   └── /:orgId                  # 组织详情（团队+成员 + 跳转组织设置页）
    ├── /audit-logs                  # 审计日志（操作记录查看）
    └── /settings                    # 系统设置（待实现）
```

---

### 页面布局

#### 整体布局

```text
┌─────────────────────────────────────────────────────────────┐
│  Header                                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Logo    OrgSwitcher    Search         User  Notify  ◐  ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────────────────────────────────────┐  │
│  │         │  │                                         │  │
│  │ Sidebar │  │              Main Content               │  │
│  │         │  │                                         │  │
│  │ - 项目   │  │                                         │  │
│  │ - 团队   │  │                                         │  │
│  │ - 权限   │  │                                         │  │
│  │ - 设置   │  │                                         │  │
│  │         │  │                                         │  │
│  └─────────┘  └─────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Footer                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

### 核心页面设计

#### 1. 登录页 `/auth/login`

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        ┌─────────────┐                      │
│                        │    Logo     │                      │
│                        │    Teax     │                      │
│                        └─────────────┘                      │
│                                                             │
│                   ┌─────────────────────┐                   │
│                   │                     │                   │
│                   │  ┌───────────────┐  │                   │
│                   │  │ 使用 Gitea 登录 │  │                   │
│                   │  └───────────────┘  │                   │
│                   │                     │                   │
│                   │  ┌───────────────┐  │                   │
│                   │  │ 使用飞书登录   │  │                   │
│                   │  └───────────────┘  │                   │
│                   │                     │                   │
│                   └─────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. 首页/仪表盘 `/`

```text
┌─────────────────────────────────────────────────────────────┐
│  欢迎回来, username                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 项目总数     │  │ 运行中任务   │  │ 今日发布     │         │
│  │    12       │  │     3       │  │     5       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  最近项目                                        [查看全部]  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ xg/nodecloud     master    ● 运行中    2分钟前       │   │
│  │ xg/webapp        main      ✓ 成功      1小时前       │   │
│  │ xg/api-server    develop   ✗ 失败      3小时前       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  最近活动                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🚀 张三 发布了 xg/nodecloud v1.2.0                   │   │
│  │ ✅ 李四 审批通过了 xg/webapp 的发布请求               │   │
│  │ 🤖 Agent "code-review" 完成了 xg/api-server 的审查   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3. 创建项目 `/orgs/:orgId/projects/new`

```text
┌─────────────────────────────────────────────────────────────┐
│  创建项目                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  关联 Gitea 仓库                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 搜索仓库...                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  或直接输入仓库地址                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ org/repo                                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  可用仓库                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ xg/nodecloud      Node.js 云服务项目               │   │
│  │ ○ xg/webapp         前端 Web 应用                    │   │
│  │ ○ xg/api-server     API 服务端                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                          [取消]  [创建]     │
└─────────────────────────────────────────────────────────────┘
```

#### 4. 项目工作台 `/orgs/:orgId/projects/:projectId`

```text
┌─────────────────────────────────────────────────────────────┐
│  xg/nodecloud                                    [设置] ⚙   │
│  Node.js 云服务项目                                          │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┬────────┬────────┬──────────────┬────────┐      │
│  │Actions │ Agents │ Pages  │ 小程序管理    │ 设置   │      │
│  └────────┴────────┴────────┴──────────────┴────────┘      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  发布                                            [新建发布]  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ┌──────────────────────────────────────────────┐    │   │
│  │ │  #42  v1.2.0                          ● 运行中 │    │   │
│  │ │  master  abc1234  "feat: add new feature"     │    │   │
│  │ │  张三 · 2分钟前                      [查看日志] │    │   │
│  │ └──────────────────────────────────────────────┘    │   │
│  │                                                     │   │
│  │ ┌──────────────────────────────────────────────┐    │   │
│  │ │  #41  v1.1.9                          ✓ 成功  │    │   │
│  │ │  master  def5678  "fix: bug fix"              │    │   │
│  │ │  李四 · 1小时前                               │    │   │
│  │ └──────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5. Agents Tab

```text
┌─────────────────────────────────────────────────────────────┐
│  Agents                                        [启动 Agent]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  运行中的 Session                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ┌──────────────────────────────────────────────┐    │   │
│  │ │  code-review                          ● 运行中 │    │   │
│  │ │  Session #s-001                               │    │   │
│  │ │  已运行 5分钟                        [停止] [日志]│    │   │
│  │ └──────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  历史 Session                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Session ID    Agent        状态    耗时    时间     │   │
│  │  s-001         code-review  运行中  5m      刚刚     │   │
│  │  s-000         deploy-bot   完成    2m      1小时前  │   │
│  │  s-999         test-runner  失败    10s     昨天     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 6. 团队管理 `/orgs/:orgId/teams`

```text
┌─────────────────────────────────────────────────────────────┐
│  团队管理                                        [同步团队]  │
│  从 Gitea 同步的团队列表                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  团队名称          成员数    权限组        操作      │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Owners            3        管理员        [编辑]    │   │
│  │  Developers        8        开发者        [编辑]    │   │
│  │  QA                4        测试人员      [编辑]    │   │
│  │  Viewers           12       只读          [编辑]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  最后同步: 2026-03-04 15:30:00                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 7. 权限组管理 `/orgs/:orgId/permissions`

```text
┌─────────────────────────────────────────────────────────────┐
│  权限组管理                                      [新建权限组] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  管理员                                       │   │   │
│  │  │  拥有所有权限                                  │   │   │
│  │  │  权限: project:* publish:* agent:* ...       │   │   │
│  │  │                                    [编辑]     │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  开发者                                       │   │   │
│  │  │  可以触发发布和启动 Agent                      │   │   │
│  │  │  权限: publish:trigger agent:start agent:stop │   │   │
│  │  │                                    [编辑]     │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  只读                                         │   │   │
│  │  │  只能查看项目和日志                            │   │   │
│  │  │  权限: (无)                                   │   │   │
│  │  │                                    [编辑]     │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 8. 个人账号 - 飞书绑定 `/account/feishu`

```text
┌─────────────────────────────────────────────────────────────┐
│  飞书账号绑定                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  当前状态: ✓ 已绑定                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  飞书账号信息                                        │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  显示名: 张三                                        │   │
│  │  Open ID: ou_xxxxxxxxxxxx                           │   │
│  │  绑定时间: 2026-03-01 10:00:00                       │   │
│  │                                                     │   │
│  │                                        [解除绑定]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  通知设置                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ☑ 接收发布通知                                      │   │
│  │  ☑ 接收审批请求                                      │   │
│  │  ☑ 接收 Agent 运行结果                               │   │
│  │  ☐ 接收系统通知                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 9. 后台管理 - 用户管理 `/admin/users`

```text
┌─────────────────────────────────────────────────────────────┐
│  用户管理                                            [+手动导入]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  用户名          邮箱           角色      操作      │   │
│  │  ───────────────────────────────────────────────────────  │   │
│  │  admin           admin@x.com    ★管理员    [禁用]       │   │
│  │  zhangsan         z@x.com        普通用户  [设为管理员]  │   │
│  │  lisi             l@x.com        普通用户  [设为管理员]  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 10. 后台管理 - 组织管理 `/admin/orgs`

```text
┌─────────────────────────────────────────────────────────────┐
│  组织管理                                          [全量同步]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  组织名称   团队数  成员数   最后同步时间     操作      │   │
│  │  ───────────────────────────────────────────────────────  │   │
│  │  xg-org       4      23     2026-03-05 11:30  [同步][详情] │   │
│  │  bj-org       2      10     2026-03-05 09:00  [同步][详情] │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 11. 后台管理 - 团队成员管理 `/admin/orgs/:orgId/teams`

```text
┌─────────────────────────────────────────────────────────────┐
│  xg-org / 团队管理                              [同步团队]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Owners 团队                                     3 人成员  │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  用户名          Gitea ID    团队角色    操作        │   │
│  │  ───────────────────────────────────────────────────────  │   │
│  │  admin           #1          owner       [移除]         │   │
│  │  zhangsan         #42         member      [设为Owner][移除]│   │
│  │  lisi             #87         member      [设为Owner][移除]│   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  Developers 团队                                  8 人成员  │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  ...                                                 │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 组件设计

#### 通用组件

| 组件 | 说明 |
| ---- | ---- |
| `AppHeader` | 顶部导航栏，包含 Logo、组织切换、搜索、用户菜单 |
| `AppSidebar` | 侧边栏导航，根据当前组织显示菜单 |
| `OrgSwitcher` | 组织切换下拉框 |
| `UserMenu` | 用户头像下拉菜单 |
| `NotificationBell` | 通知铃铛，显示未读通知数 |

#### 业务组件

| 组件 | 说明 |
| ---- | ---- |
| `ProjectCard` | 项目卡片，显示项目名称、状态、最近活动 |
| `PublishTaskCard` | 发布任务卡片，显示状态、分支、提交信息 |
| `SessionCard` | Agent Session 卡片，显示运行状态、耗时 |
| `TeamTable` | 团队列表表格 |
| `PermissionGroupCard` | 权限组卡片 |
| `LogViewer` | 日志查看器，支持实时日志流 |
| `StatusBadge` | 状态徽章（运行中/成功/失败等） |
| `BranchSelector` | 分支选择器 |
| `RepoSearch` | 仓库搜索组件 |

## 数据模型

### 实体关系图

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│  UserFeishu │     │PermissionGrp│
└──────┬──────┘     └─────────────┘     └──────┬──────┘
       │                                       │
       │ belongs_to                            │ has_many
       ▼                                       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│Organization │────▶│    Team     │────▶│TeamPermission│
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ has_many
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Project   │────▶│ PublishTask │     │   Action    │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ has_many
       ▼
┌─────────────┐     ┌─────────────┐
│AgentSession │     │    Page     │
└─────────────┘     └─────────────┘
```

---

### 用户与权限

#### User（用户）

```typescript
interface User {
  id: string;
  giteaId: number;              // Gitea 用户 ID
  giteaUsername: string;        // Gitea 用户名
  email: string;
  avatarUrl?: string;
  isAdmin: boolean;             // 系统管理员
  createdAt: Date;
  updatedAt: Date;
}
```

#### UserFeishu（飞书绑定）

```typescript
interface UserFeishu {
  id: string;
  userId: string;               // 关联 User.id
  feishuOpenId: string;         // 飞书 open_id
  feishuUnionId?: string;       // 飞书 union_id
  feishuName: string;           // 飞书显示名
  feishuAvatar?: string;
  accessToken?: string;         // 飞书 access_token（加密存储）
  tokenExpiresAt?: Date;        // token 过期时间
  notifyPublish: boolean;       // 接收发布通知（默认 true）
  notifyApproval: boolean;      // 接收审批请求（默认 true）
  notifyAgent: boolean;         // 接收 Agent 运行结果（默认 true）
  notifySystem: boolean;        // 接收系统通知（默认 false）
  createdAt: Date;
}
```

#### Organization（组织）

```typescript
interface Organization {
  id: string;
  giteaOrgId: number;           // Gitea Organization ID
  name: string;                 // 组织名称
  displayName?: string;
  avatarUrl?: string;
  syncedAt: Date;               // 最后同步时间
  createdAt: Date;
}
```

#### Team（团队）

```typescript
interface Team {
  id: string;
  organizationId: string;       // 关联 Organization.id
  giteaTeamId: number;          // Gitea Team ID
  name: string;
  description?: string;
  syncedAt: Date;
  createdAt: Date;
}
```

#### TeamMember（团队成员）

```typescript
interface TeamMember {
  id: string;
  teamId: string;               // 关联 Team.id
  userId: string;               // 关联 User.id
  role: 'owner' | 'member';     // 团队角色
  joinedAt: Date;
}
```

#### PermissionGroup（权限组）

```typescript
interface PermissionGroup {
  id: string;
  organizationId: string;       // 所属组织
  name: string;                 // 权限组名称
  description?: string;
  permissions: Permission[];    // 权限列表
  createdAt: Date;
}

type Permission =
  | 'project:create'
  | 'project:delete'
  | 'project:settings'
  | 'publish:trigger'
  | 'publish:approve'
  | 'publish:rollback'
  | 'agent:start'
  | 'agent:stop'
  | 'page:deploy'
  | 'miniapp:manage'
  | 'team:manage'
  | 'settings:manage';
```

#### TeamPermission（团队权限分配）

```typescript
interface TeamPermission {
  id: string;
  teamId: string;               // 关联 Team.id
  permissionGroupId: string;    // 关联 PermissionGroup.id
  createdAt: Date;
}
```

---

### 项目相关

#### Project（项目）

```typescript
interface Project {
  id: string;
  organizationId: string;       // 所属组织
  giteaRepoId: number;          // Gitea 仓库 ID
  name: string;                 // 项目名称 (org/repo)
  fullName: string;             // 完整名称
  description?: string;
  defaultBranch: string;        // 默认分支
  cloneUrl: string;             // Git clone 地址
  webhookId?: number;           // Gitea Webhook ID
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectSettings {
  autoDeploy: boolean;          // 自动部署
  deployBranches: string[];     // 触发部署的分支
  notifyOnSuccess: boolean;     // 成功时通知
  notifyOnFailure: boolean;     // 失败时通知
  approvalRequired: boolean;    // 需要审批
}
```

#### PublishTask（发布任务）

```typescript
interface PublishTask {
  id: string;
  projectId: string;
  branch: string;               // 发布分支
  commitSha: string;            // 提交 SHA
  commitMessage?: string;
  triggeredBy: string;          // 触发者 User.id
  triggerType: 'manual' | 'webhook' | 'feishu';
  status: 'pending' | 'approved' | 'running' | 'success' | 'failed' | 'cancelled';
  approvedBy?: string;          // 审批者 User.id
  approvedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  duration?: number;            // 耗时（秒）
  logUrl?: string;              // 完整日志 S3 URL（任务完成后归档）
  createdAt: Date;
  // 实时日志通过 publish_task_logs 表流式写入，不内联在主实体
}
```

#### Action（CI/CD 流水线）

```typescript
interface Action {
  id: string;
  projectId: string;
  name: string;                 // 流水线名称
  trigger: ActionTrigger;
  steps: ActionStep[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ActionTrigger {
  type: 'push' | 'pull_request' | 'tag' | 'manual';
  branches?: string[];          // 触发分支
  paths?: string[];             // 触发路径
}

interface ActionStep {
  name: string;
  command: string;
  env?: Record<string, string>;
  timeout?: number;             // 超时（秒）
}
```

---

### Agent 相关

#### Agent（Agent 定义）

Agent 由 **`@opencode-ai/sdk`** 驱动执行，通过配置 systemPrompt + LLM 供应商定义一个代码智能体。

```typescript
interface Agent {
  id: string;
  projectId: string;
  name: string;
  description?: string;

  // open-code 核心配置
  systemPrompt: string;          // Agent 任务定义（系统提示词）
  llmConfig: AgentLlmConfig;     // LLM 供应商配置
  toolConfig: AgentToolConfig;   // 工具权限配置

  // 触发配置
  triggerConfig?: {
    onPush?: boolean;            // push 时自动触发
    branches?: string[];         // 触发分支过滤，空则所有分支
    promptTemplate?: string;     // user prompt 模板，支持变量：
                                 // {{branch}} {{commitSha}} {{commitMsg}} {{author}}
  };

  // 工作区配置
  workspaceConfig?: {
    branch?: string;             // 默认签出分支
    createPR?: boolean;          // 执行完成后自动提交变更并创建 PR
    prTitleTemplate?: string;    // PR 标题模板，如 "chore: {{agentName}} auto fix"
  };

  // 资源限制
  resources?: {
    timeout?: number;            // 最大运行时间（秒），默认 3600
    maxSteps?: number;           // open-code 最大步骤数，防止无限循环，默认 50
  };

  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// LLM 供应商配置（对应 open-code 的 provider 配置）
interface AgentLlmConfig {
  providerID: string;            // 如 "openai" / "anthropic" / "custom-openai"
  model: string;                 // 如 "gpt-4o" / "claude-3-5-sonnet-20241022"
  baseUrl?: string;              // 自定义 API 地址（私有部署 LLM）
  apiKeySecretId: string;        // 引用 agent_secrets.id，运行时解密注入
}

// open-code 工具权限配置
type AgentToolName = 'bash' | 'file_read' | 'file_write' | 'web_fetch';
interface AgentToolConfig {
  enabled: AgentToolName[];      // 开启的工具，如 ['bash', 'file_read', 'file_write']
  // 注：bash 在隔离容器中执行，file_read/write 限定于项目工作区目录
}
```

#### AgentSecret（Agent 密钥）

```typescript
interface AgentSecret {
  id: string;
  projectId: string;
  name: string;                  // 密钥名称，如 "OPENAI_API_KEY"
  encryptedValue: string;        // AES-256-GCM 加密后的值
  createdBy: string;             // 创建者 User.id
  createdAt: Date;
  updatedAt: Date;
}
```

#### AgentSession（Agent 会话）

```typescript
interface AgentSession {
  id: string;
  projectId: string;
  agentId: string;              // Agent 定义 ID
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  triggeredBy: string;          // 触发者 User.id
  triggerType: 'manual' | 'webhook' | 'feishu';
  userPrompt?: string;          // 实际发送给 open-code 的 user prompt（模板渲染后）
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;

  // open-code 运行追踪
  ocSessionId?: string;         // open-code 内部 session ID
  steps?: number;               // 已执行步骤数
  tokensUsed?: number;          // 累计消耗 token 数
  cost?: number;                // 推算费用（USD）

  // 产物
  prUrl?: string;               // 若 workspaceConfig.createPR=true，记录创建的 PR 链接
  logUrl?: string;              // 完整日志 S3 URL（完成后归档）
  metadata: Record<string, unknown>;
  createdAt: Date;
  // 实时日志通过 session_logs 表流式写入，不内联在主实体
}
```

---

### Pages 与小程序

#### Page（静态页面）

```typescript
interface Page {
  id: string;
  projectId: string;
  name: string;                 // 页面名称
  domain?: string;              // 自定义域名
  subdomain: string;            // 子域名
  branch: string;               // 部署分支
  buildCommand?: string;        // 构建命令
  outputDir: string;            // 输出目录
  status: 'active' | 'building' | 'failed' | 'disabled';
  lastDeployedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### MiniAppCode（小程序开发码）

```typescript
interface MiniAppCode {
  id: string;
  projectId: string;
  type: 'preview' | 'experience' | 'release';
  version: string;
  qrcodeUrl: string;            // 二维码图片 URL
  expiredAt?: Date;             // 过期时间
  createdBy: string;            // 创建者 User.id
  createdAt: Date;
}
```

---

### 飞书相关

#### FeishuNotification（飞书通知记录）

```typescript
interface FeishuNotification {
  id: string;
  type: 'publish' | 'approval' | 'agent' | 'system';
  targetType: 'user' | 'group';
  targetId: string;             // 飞书 open_id 或 chat_id
  messageId?: string;           // 飞书消息 ID
  content: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  createdAt: Date;
}
```

#### FeishuApproval（飞书审批）

```typescript
interface FeishuApproval {
  id: string;
  publishTaskId: string;        // 关联发布任务
  approvalCode: string;         // 飞书审批定义 code
  instanceCode: string;         // 飞书审批实例 code
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverOpenId?: string;
  approvedAt?: Date;
  comment?: string;
  createdAt: Date;
}
```

#### AuditLog（操作审计）

```typescript
interface AuditLog {
  id: string;
  userId: string;               // 操作者
  organizationId?: string;      // 所属组织
  action: string;               // 操作类型，如 publish.trigger / agent.stop / permission.update
  resourceType?: string;        // project | publish_task | agent_session | permission_group
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  detail: Record<string, unknown>; // 操作内容快照
  createdAt: Date;
}
```

---

## 技术架构

### 安全设计

| 风险点 | 防护措施 |
| -------- | -------- |
| **Webhook 伪造** | 注册 Webhook 时保存 secret，每次请求校验 `X-Gitea-Signature` HMAC-SHA256 签名，失败则返回 401 |
| **越权访问** | 每个 API 路由通过权限中间件，校验用户是否属于该组织且持有对应权限 |
| **构建任务隔离** | 所有构建任务在独立 Docker 容器中执行，不得在 Teax 服务进程内直接 `exec` 命令 |
| **OAuth Token 过期** | Gitea access_token 过期后需重新授权；飞书 token 存储到 `user_feishu.access_token`，访问前检查 `tokenExpiresAt` |
| **飞书机器人越权** | 收到机器人指令时，通过 `feishuOpenId` 查找关联 Teax 用户，校验权限组后才执行操作 |
| **敏感信息过滤** | API 响应不返回密钥、token 字段；日志中过滤 env 中标记为 `SECRET_*` 的字段 |
| **请求限流** | Webhook 接收端点和 API 路由应配置限流（如 10 req/s），利用 Redis 实现滑动窗口计数器 |
| **Session 服务端校验** | Cookie sealed session 内嵌 `sessionId`，每次 API 请求通过 `session-validate` middleware 检查 Redis（`session:{userId}:{sessionId}`）是否仍有效，支持服务端主动踢人 |

---

### 整体架构

```text
┌──────────────────────────────────────────────────────────────────────┐
│                            客户端                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   浏览器     │  │  飞书客户端  │  │  Gitea      │                 │
│  │   (Web UI)  │  │  (机器人)    │  │  (Webhook)  │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Teax Server                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Nuxt 4 (SSR)                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │   Pages     │  │   API       │  │  WebSocket  │          │   │
│  │  │   (Vue 3)   │  │   Routes    │  │   Server    │          │   │
│  │  │             │  │             │  │(+Redis Adpt)│          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Service Layer                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ Auth     │ │ Project  │ │ Publish  │ │ Agent    │        │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ Gitea    │ │ Feishu   │ │ Team     │ │ Page     │        │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          外部服务                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Gitea     │  │   飞书      │  │  PostgreSQL │                 │
│  │   Server    │  │   Open API  │  │   Database  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Redis     │  │ 火山 TOS   │  │   Docker    │                 │
│  │   (Cache)   │  │   (S3)     │  │   (Runner)  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 前端技术栈

| 类别 | 技术 | 版本 | 说明 |
| ---- | ---- | ---- | ---- |
| **框架** | Nuxt | 4.x | Vue 3 全栈框架，支持 SSR/SSG |
| **UI 库** | Nuxt UI | 4.x | 基于 Tailwind 的组件库 |
| **样式** | Tailwind CSS | 4.x | 原子化 CSS 框架 |
| **图标** | Lucide Icons | - | 开源图标库 |
| **状态管理** | Pinia | 2.x | Vue 官方状态管理 |
| **请求** | ofetch | - | Nuxt 内置 HTTP 客户端 |
| **WebSocket** | Socket.io-client | 4.x | 实时通信 |
| **表单验证** | Zod | 3.x | TypeScript 优先的 Schema 验证 |
| **日期处理** | date-fns | 3.x | 轻量日期库 |
| **Cron 可读化** | cronstrue | 3.x | Cron 表达式转人性化中文文本（zh_CN locale） |
| **代码高亮** | Shiki | 1.x | 语法高亮（日志展示） |

#### 前端目录结构

```text
app/
├── assets/                    # 静态资源
│   └── css/
│       └── main.css
├── components/                # 组件
│   ├── app/                   # 应用级组件
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   └── AppFooter.vue
│   ├── project/               # 项目相关组件
│   │   ├── ProjectCard.vue
│   │   ├── ProjectActionsTab.vue    # ✅ Actions Tab（workflow 信息卡片 + runs 列表 + 触发弹窗）
│   │   ├── ProjectSettingsTab.vue   # ✅ 设置 Tab
│   │   └── PublishTaskCard.vue
│   ├── agent/                 # Agent 相关组件
│   │   └── SessionCard.vue
│   └── common/                # 通用组件
│       ├── StatusBadge.vue
│       └── LogViewer.vue
├── composables/               # 组合式函数
│   ├── useAuth.ts
│   ├── useProject.ts
│   └── useWebSocket.ts
├── layouts/                   # 布局
│   ├── default.vue
│   ├── auth.vue
│   └── admin.vue
├── middleware/                # 中间件
│   ├── auth.ts
│   └── permission.ts
├── pages/                     # 页面
│   ├── index.vue
│   ├── auth/
│   │   ├── login.vue
│   │   └── callback/
│   ├── orgs/
│   │   └── [orgId]/
│   ├── account/
│   └── admin/
├── plugins/                   # 插件
│   └── socket.client.ts
├── stores/                    # Pinia stores
│   ├── auth.ts
│   ├── org.ts
│   └── project.ts
├── types/                     # 类型定义
│   ├── user.ts
│   ├── project.ts
│   └── api.ts
└── utils/                     # 工具函数
    ├── format.ts
    └── permission.ts
```

---

### 后端技术栈

| 类别 | 技术 | 版本 | 说明 |
| ---- | ---- | ---- | ---- |
| **运行时** | Nuxt Server (Nitro) | - | 基于 H3 的服务端 |
| **ORM** | Drizzle ORM | 0.30+ | TypeScript ORM，轻量高性能 |
| **数据库** | PostgreSQL | 16.x | 主数据库 |
| **缓存** | Redis | 7.x | Session、缓存、消息队列 |
| **对象存储** | S3 兼容存储 | - | 火山引擎 TOS，日志、构建产物存储 |
| **任务队列** | BullMQ | 5.x | 基于 Redis 的任务队列 |
| **WebSocket** | Socket.io | 4.x | 实时日志推送 |
| **认证** | nuxt-auth-utils | - | OAuth2 认证 |

#### 后端目录结构

```text
server/
├── api/                       # API 路由
│   ├── auth/
│   │   ├── gitea.get.ts           # ✅ Gitea OAuth 重定向
│   │   ├── feishu.get.ts          # ✅ 飞书 OAuth 重定向
│   │   ├── session.get.ts         # ✅ 获取当前 session
│   │   ├── logout.post.ts         # ✅ 登出（清除 Redis session）
│   │   └── callback/
│   │       ├── gitea.get.ts           # ✅ Gitea OAuth 回调
│   │       └── feishu.get.ts          # ✅ 飞书 OAuth 回调
│   ├── orgs/                  # ✅ Phase 2
│   │   └── [orgId]/projects/[projectId]/
│   │       ├── actions.get.ts       # ✅ Gitea workflow runs 代理
│   │       ├── workflows.get.ts     # ✅ Workflow 列表（含 triggers/schedules/inputs/x-description 解析）
│   │       ├── branches.get.ts      # ✅ 分支列表
│   │       ├── settings.patch.ts    # ✅ 项目设置更新
│   │       └── index.delete.ts      # ✅ 删除项目
│   ├── admin/                 # ✅ Phase 2 后台管理
│   └── webhooks/              # ✅ Phase 2
├── middleware/                # 服务端中间件
│   └── session-validate.ts    # ✅ Redis session 有效性校验
├── services/                  # 业务服务
│   ├── auth.service.ts        # ✅ upsertUser（首次登录自动管理员）
│   ├── sync.service.ts        # ✅ syncUserOrgsAndTeams
│   ├── feishu.service.ts      # ✅ findUserByFeishuOpenId + bindFeishuToUser
│   ├── project.service.ts     # ⏳ Phase 2
│   ├── publish.service.ts     # ⏳ Phase 2
│   ├── agent.service.ts       # ⏳ Phase 3
│   ├── team.service.ts        # ⏳ Phase 2
│   └── permission.service.ts  # ⏳ Phase 2
├── db/                        # 数据库
│   ├── schema/                # ✅ Drizzle Schema
│   │   ├── user.ts                # ✅ users + user_feishu
│   │   ├── organization.ts        # ✅ organizations + teams + team_members
│   │   ├── permission.ts          # ✅ permission_groups + team_permissions
│   │   └── index.ts               # ✅ 统一导出
│   └── index.ts               # ✅ useDB() 单例
├── types/
│   └── auth.d.ts              # ✅ #auth-utils 类型扩展
├── jobs/                      # ⏳ Phase 2
└── utils/                     # 工具函数
    ├── gitea.ts               # ✅ GiteaService + exchangeGiteaCode
    ├── feishu.ts              # ✅ 飞书 API 封装
    ├── redis.ts               # ✅ useRedis() 单例
    ├── session.ts             # ✅ Redis session 追踪
    ├── webhook-verify.ts      # ⏳ Phase 2 Webhook HMAC-SHA256 签名验证
    └── logger.ts              # ⏳ Phase 2
```

> **BullMQ 失败处理**：所有任务需要配置 `attempts`（建议 3 次）和 `backoff`（指数退避）。失败超次数后进入死信队列（`dead`），并更新对应任务状态为 `failed`。最终失败部署应触发飞书告警通知。

---

### 数据库设计

#### PostgreSQL 表结构

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gitea_id INTEGER UNIQUE NOT NULL,
  gitea_username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 飞书绑定表
CREATE TABLE user_feishu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feishu_open_id VARCHAR(255) UNIQUE NOT NULL,
  feishu_union_id VARCHAR(255),
  feishu_name VARCHAR(255) NOT NULL,
  feishu_avatar TEXT,
  access_token TEXT,                          -- 加密存储
  token_expires_at TIMESTAMPTZ,
  notify_publish BOOLEAN DEFAULT TRUE,
  notify_approval BOOLEAN DEFAULT TRUE,
  notify_agent BOOLEAN DEFAULT TRUE,
  notify_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 组织表
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gitea_org_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 团队表
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gitea_team_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, gitea_team_id)
);

-- 权限组表
CREATE TABLE permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gitea_repo_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  default_branch VARCHAR(255) DEFAULT 'main',
  clone_url TEXT NOT NULL,
  webhook_id INTEGER,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, gitea_repo_id)
);

-- 团队成员表
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',  -- owner | member
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 团队权限分配表
CREATE TABLE team_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  permission_group_id UUID REFERENCES permission_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, permission_group_id)
);

-- 发布任务表
CREATE TABLE publish_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  branch VARCHAR(255) NOT NULL,
  commit_sha VARCHAR(40) NOT NULL,
  commit_message TEXT,
  triggered_by UUID REFERENCES users(id),
  trigger_type VARCHAR(50) NOT NULL,  -- manual | webhook | feishu
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration INTEGER,
  log_url TEXT,                       -- 完整日志存储于 S3
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 发布任务日志表（实时追加，独立表避免主表行膝胀）
CREATE TABLE publish_task_logs (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID REFERENCES publish_tasks(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level VARCHAR(10) NOT NULL,         -- info | warn | error
  step VARCHAR(100),
  message TEXT NOT NULL
);

-- Agent 定义表（open-code 驱动）
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,        -- Agent 系统提示词
  llm_config JSONB NOT NULL,          -- AgentLlmConfig: providerID/model/baseUrl/apiKeySecretId
  tool_config JSONB NOT NULL,         -- AgentToolConfig: enabled[]
  trigger_config JSONB DEFAULT '{}',  -- onPush/branches/promptTemplate
  workspace_config JSONB DEFAULT '{}',-- branch/createPR/prTitleTemplate
  resources JSONB DEFAULT '{}',       -- timeout/maxSteps
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent 密钥表（LLM API Key 等，AES-256-GCM 加密存储）
CREATE TABLE agent_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,         -- 如 "OPENAI_API_KEY"
  encrypted_value TEXT NOT NULL,      -- AES-256-GCM 加密后的值
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Agent Session 表
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  agent_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending | running | completed | failed | stopped
  triggered_by UUID REFERENCES users(id),
  trigger_type VARCHAR(50) NOT NULL,  -- manual | webhook | feishu
  user_prompt TEXT,                   -- 渲染后的 user prompt
  oc_session_id VARCHAR(255),         -- open-code 内部 session ID
  steps INTEGER DEFAULT 0,            -- 已执行步骤数
  tokens_used INTEGER,                -- 累计消耗 token 数
  cost DECIMAL(10,6),                 -- 推算费用（USD）
  pr_url TEXT,                        -- 创建的 PR 链接
  log_url TEXT,                       -- 完整日志存储于 S3
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Session 日志表
CREATE TABLE session_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type VARCHAR(20) NOT NULL,          -- stdout | stderr | system | tool | reasoning
  content TEXT NOT NULL
);

-- 操作审计日志表
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action VARCHAR(100) NOT NULL,       -- 如 publish.trigger, agent.stop, permission.update
  resource_type VARCHAR(50),          -- project | publish_task | agent_session | permission_group
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_publish_tasks_project ON publish_tasks(project_id);
CREATE INDEX idx_publish_tasks_status ON publish_tasks(status);
CREATE INDEX idx_publish_task_logs_task ON publish_task_logs(task_id);
CREATE INDEX idx_agent_sessions_project ON agent_sessions(project_id);
CREATE INDEX idx_session_logs_session ON session_logs(session_id);
CREATE INDEX idx_agent_secrets_project ON agent_secrets(project_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

---

### 第三方 API 集成

#### Gitea API

| API | 用途 |
| --- | ---- |
| `GET /api/v1/user` | 获取当前用户信息 |
| `GET /api/v1/user/orgs` | 获取用户所属组织 |
| `GET /api/v1/orgs/{org}/teams` | 获取组织团队列表 |
| `GET /api/v1/repos/{owner}/{repo}` | 获取仓库信息 |
| `GET /api/v1/repos/{owner}/{repo}/branches` | 获取分支列表 |
| `POST /api/v1/repos/{owner}/{repo}/hooks` | 创建 Webhook |
| `GET /api/v1/repos/{owner}/{repo}/commits` | 获取提交记录 |
| `GET /api/v1/repos/{owner}/{repo}/actions/tasks` | 获取 Gitea Actions 运行记录 |

#### 飞书 Open API

| API | 用途 |
| --- | ---- |
| `POST /open-apis/auth/v3/tenant_access_token/internal` | 获取 tenant_access_token |
| `GET /open-apis/authen/v1/user_info` | 获取用户信息（OAuth） |
| `POST /open-apis/im/v1/messages` | 发送消息 |
| `POST /open-apis/approval/v4/instances` | 创建审批实例 |
| `GET /open-apis/approval/v4/instances/{instance_id}` | 查询审批状态 |
| `POST /open-apis/bot/v2/hook/{hook_id}` | 机器人 Webhook |

---

### 部署架构

#### Docker Compose（开发/小规模）

```yaml
version: '3.8'
services:
  teax:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/teax
      - REDIS_URL=redis://redis:6379
      - GITEA_URL=https://gitea.example.com
      - FEISHU_APP_ID=xxx
      - FEISHU_APP_SECRET=xxx
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=teax
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  # 对象存储使用火山引擎 TOS（S3 兼容），无需本地容器

volumes:
  postgres_data:
  redis_data:
```

#### Pages 子域名路由

Pages 功能需要在基础设施上实现以下：

1. **通配符 DNS**：配置 `*.pages.teax.example.com` 指向 K8s Ingress IP
2. **通配符 SSL 证书**：为 `*.pages.teax.example.com` 申请 TLS 证书（可用 cert-manager + Let's Encrypt）
3. **Ingress 路由规则**：加入通配符 host 规则，将 `{subdomain}.pages.teax.example.com` 指向 Teax 服务
4. **服务内路由**：服务器读取 Host 头提取子域名，查询 `pages` 表，从 S3 返回对应静态文件
5. **自定义域名**（P2）：用户配置 CNAME 指向 Teax，服务器验证占有权后生效

#### Kubernetes（生产环境）

```text
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Ingress (Nginx)                   │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────┼─────────────────────────────┐   │
│  │                       ▼                              │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │           Teax Deployment (3 replicas)       │    │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │    │   │
│  │  │  │  Pod 1  │ │  Pod 2  │ │  Pod 3  │        │    │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘        │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │           Worker Deployment (2 replicas)     │    │   │
│  │  │  ┌─────────┐ ┌─────────┐                    │    │   │
│  │  │  │ Worker1 │ │ Worker2 │  (BullMQ Jobs)     │    │   │
│  │  │  └─────────┘ └─────────┘                    │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │ PostgreSQL  │  │    Redis    │    火山引擎 TOS (外部 S3)    │
│  │ (StatefulSet)│  │(StatefulSet)│                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

---

### API 设计规范

#### 分页

所有列表接口均采用以下统一格式：

```typescript
// 请求参数
interface ListQuery {
  page?: number;     // 页码，默认 1
  limit?: number;    // 每页条数，默认 20，最大 100
  cursor?: string;   // cursor-based 分页（日志类接口）
}

// 响应格式
interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

#### 错误响应

```typescript
interface ApiError {
  code: string;      // 如 PERMISSION_DENIED, NOT_FOUND
  message: string;
  detail?: unknown;
}
```

---

### 环境变量配置

```bash
# 基础配置
NUXT_PUBLIC_APP_NAME=Teax
NUXT_PUBLIC_APP_URL=https://teax.example.com

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/teax

# Redis
REDIS_URL=redis://localhost:6379

# Gitea
GITEA_URL=https://gitea.example.com
GITEA_CLIENT_ID=xxx
GITEA_CLIENT_SECRET=xxx

# 飞书
FEISHU_APP_ID=xxx
FEISHU_APP_SECRET=xxx
FEISHU_ENCRYPT_KEY=xxx
FEISHU_VERIFICATION_TOKEN=xxx

# S3 兼容存储（火山引擎 TOS）
S3_ENDPOINT=tos-cn-beijing.volces.com
S3_REGION=cn-beijing
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=teax

# Session
NUXT_SESSION_PASSWORD=xxx  # 至少 32 字符

# Agent 密钒加密（AES-256-GCM，需 32 字节）
AGENT_SECRET_ENCRYPTION_KEY=xxx

# 可选：Sentry 错误监控
SENTRY_DSN=xxx
```

---

### Gitea 功能扩展

Teax 为 Gitea 提供以下扩展能力：

| 扩展功能 | 说明 |
| -------- | ---- |
| **CI/CD Actions** | 基于 Gitea Webhook 的构建/部署流水线 |
| **Pages 托管** | 静态站点自动部署和托管 |
| **小程序管理** | 预览码、体验码生成和管理 |
| **Agent 运行时** | AI Agent Session 管理和监控 |

### 飞书控制与消息

飞书作为控制面和消息通道：

| 功能 | 说明 |
| ---- | ---- |
| **消息通知** | 发布成功/失败、构建状态推送到群组 |
| **机器人指令** | 通过飞书机器人触发部署、回滚等操作 |
| **审批流程** | 生产环境发布需飞书审批通过 |
| **状态查询** | 在飞书中查询项目/Session 运行状态 |
| **用户同步** | 飞书组织架构同步到权限系统 |

## UI 流程图

```text
┌─────────────────┐     ┌─────────────────┐
│   创建项目       │     │   选择分支       │
│                 │     │                 │
│ 关联Gitea仓库:   │     │ 分支:           │
│ ┌─────────────┐ │     │ ┌─────────────┐ │
│ │xg/nodecloud │ │     │ │   master    │ │
│ └─────────────┘ │     │ └─────────────┘ │
│                 │     │                 │
│    [创建]       │────▶│    [拉取]       │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────┐
│ 项目列表                                            │
│ ┌────────────────────────────────────────────────┐ │
│ │ xg/nodecloud                                   │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────┐
│ xg/nodecloud                                       │
│ ┌────────┬────────┬────────┬──────────────┬───┐   │
│ │Actions │ Agents │ Pages  │小程序开发码管理│...│   │
│ └────────┴────────┴────────┴──────────────┴───┘   │
│ ┌────────────────────────────────────────────────┐ │
│ │ ┌──────────────┐                               │ │
│ │ │   Publish    │ ◉                             │ │
│ │ │ 状态: 运行中  │                               │ │
│ │ └──────────────┘                               │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
                                 │
                                 ▼ (切换到 Agents Tab)
┌────────────────────────────────────────────────────┐
│ xg/nodecloud                                       │
│ ┌────────┬────────┬────────┬──────────────┬───┐   │
│ │Actions │[Agents]│ Pages  │小程序开发码管理│...│   │
│ └────────┴────────┴────────┴──────────────┴───┘   │
│ ┌────────────────────────────────────────────────┐ │
│ │ ┌──────────────┐                               │ │
│ │ │   Session    │ ◉                             │ │
│ │ │ 状态: 运行中  │                               │ │
│ │ └──────────────┘                               │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

## 下一步计划

详细排期参见 [plan.md](./plan.md)，以下为阶段摘要：

1. **Phase 1（Week 1-2）✅ 已完成**：Nuxt 4 项目初始化、数据库 Schema（7 张表）、Gitea OAuth + 飞书 OAuth 登录、组织/团队同步、Redis session 追踪、首次登录用户自动成为管理员
2. **Phase 2（Week 3-4）⏳ 进行中**：后台管理系统（用户/组织/团队/成员管理）、项目管理、Gitea Webhook（含 HMAC 签名验证）、发布流程、基础权限中间件
3. **Phase 3（Week 5-6）**：Agent 定义（open-code 集成）、密钥管理、Session 管理（隔离容器执行）、Pages 静态托管
4. **Phase 4（Week 7-8）**：飞书消息通知、机器人指令（含越权校验）、审批流程
5. **Phase 5（Week 9-10）**：权限组完整 UI、审计日志、小程序码管理、生产环境部署上线
