# Teax 落地计划

> Gitea 功能扩展平台 + 飞书控制与消息交互

## 项目概览

| 项目 | 说明 |
| ---- | ---- |
| **目标** | 为 Gitea 提供 CI/CD、Pages、小程序管理、Agent 运行时、工作区（容器化开发环境）等扩展功能 |
| **核心依赖** | Gitea（必需）、飞书（可选） |
| **技术栈** | Nuxt 4 + Drizzle ORM + PostgreSQL + Redis |
| **预计周期** | 11-13 周 |

---

## 里程碑规划

```text
Phase 1 (Week 1-2)     Phase 2 (Week 3-4)     Phase 3 (Week 5-6)
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   基础架构       │───▶│   核心功能       │───▶│   飞书集成       │
│   + 认证系统     │    │   + 项目管理     │    │   + 通知        │
│   ✅            │    │   + CI/CD 集成  │    │   + 审批        │
│                 │    │   ✅            │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
Phase 4 (Week 7-8)     Phase 5 (Week 9-10)    Phase 6 (Week 11-13)
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   扩展功能       │───▶│   优化上线       │───▶│   工作区        │
│   + Agent       │    │   + 监控        │    │   + 容器管理    │
│   + Pages       │    │   + 文档        │    │   + Web IDE     │
│                 │    │   ⚡ 部分完成    │    │   + 网关代理    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Phase 1: 基础架构 + 认证系统（Week 1-2）✅

### 目标

搭建项目基础架构，完成用户认证和组织同步功能。

### 任务清单

#### Week 1: 项目初始化

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 初始化 Nuxt 4 项目结构 | P0 | 2h | ✅ |
| 配置 Drizzle ORM + PostgreSQL | P0 | 4h | ✅ |
| 配置 Redis 连接 | P0 | 2h | ✅ |
| 创建数据库 Schema（users, organizations, teams） | P0 | 4h | ✅ |
| 配置 Docker Compose 开发环境 | P0 | 2h | ✅ |
| 配置 ESLint + TypeScript | P1 | 2h | ✅ |

#### Week 2: 认证系统

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 实现 Gitea OAuth 登录 | P0 | 8h | ✅ |
| 实现飞书 OAuth 登录 | P1 | 6h | ✅ |
| 用户信息同步（Gitea → Teax） | P0 | 4h | ✅ |
| 组织/团队同步（Gitea → Teax） | P0 | 6h | ✅ |
| Session 管理（Redis） | P0 | 4h | ✅ |
| 登录页面 UI | P0 | 4h | ✅ |

### 交付物

- [x] 可运行的 Nuxt 4 项目
- [x] Gitea OAuth 登录功能
- [x] 飞书 OAuth 登录功能（需关联 Gitea 账号）
- [x] 用户/组织/团队数据同步
- [x] 基础数据库表结构（7 张表）
- [x] Redis Session 管理（服务端追踪 + 踢人）
- [x] 首次登录用户自动成为管理员

### 验收标准

1. 用户可通过 Gitea 账号登录系统
2. 登录后自动同步用户所属组织和团队
3. 支持飞书账号登录（需关联 Gitea 账号）

---

## Phase 2: 核心功能 - 管理系统 + 项目管理 + CI/CD 集成（Week 3-4）✅

### 目标

实现后台管理系统（用户/组/成员管理）、项目创建、Webhook 集成和 Gitea Actions CI/CD 集成。

### 任务清单

#### Week 3: 管理系统 + 项目管理

##### 后台管理

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 首次登录用户自动成为管理员 | P0 | 1h | ✅ |
| 管理员权限中间件（requireAdmin） | P0 | 2h | ✅ |
| 后台管理布局（/admin 路由组 + 侧边栏导航） | P0 | 3h | ✅ |
| 用户管理页面（列表/设置管理员/禁用） | P0 | 4h | ✅ |
| 组织管理页面（列表/同步状态/详情） | P0 | 4h | ✅ |
| 团队管理页面（列表/成员/角色分配） | P0 | 4h | ✅ |
| 成员管理 API（添加/移除/角色变更） | P0 | 3h | ✅ |
| 手动触发组织/团队同步 API | P1 | 2h | ✅ |

##### 项目管理

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 项目列表页面 | P0 | 4h | ✅ |
| 创建项目（关联 Gitea 仓库） | P0 | 6h | ✅ |
| Gitea Webhook 注册 | P0 | 4h | ✅ |
| Webhook 接收处理（含 HMAC-SHA256 签名验证） | P0 | 6h | ✅ |
| 项目详情页面框架（Tab 布局） | P0 | 4h | ✅ |
| 分支选择器组件 | P1 | 3h | ✅ |

#### Week 4: CI/CD 集成 + 项目完善

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| CI/CD 改为 Gitea Actions 原生驱动（移除 PublishTask 发布系统） | P0 | 6h | ✅ |
| Actions Tab 展示 Gitea Workflow Runs（代理 API） | P0 | 4h | ✅ |
| 手动触发 Workflow（workflow_dispatch） | P0 | 4h | ✅ |
| Webhook 接收处理（保留签名验证 + 飞书通知占位） | P0 | 3h | ✅ |
| 项目设置 Tab（通知配置 + 危险操作） | P0 | 4h | ✅ |
| 项目删除 API（含 Gitea Webhook 清理） | P0 | 3h | ✅ |
| 首页统计（今日构建 API） | P1 | 2h | ✅ |
| 审计日志系统（writeAuditLog + 管理页面） | P1 | 4h | ✅ |
| 权限校验中间件（基础版：认证 + 组织访问控制） | P0 | 4h | ✅ |

#### Week 4+: Actions Run 详情 + 日志查看

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 代理 API：Run 详情（`GET /api/repos/:owner/:repo/actions/runs/:runId`） | P2 | 1h | ✅ |
| 代理 API：Run 下 Jobs 列表（`GET /api/repos/:owner/:repo/actions/runs/:runId/jobs`） | P2 | 1h | ✅ |
| 代理 API：Job 日志下载（`GET /api/repos/:owner/:repo/actions/jobs/:jobId/logs`） | P2 | 1h | ✅ |
| Run 详情页面布局（`/:owner/:repo/actions/runs/:runId`，左侧 Jobs 列表 + 右侧日志面板） | P2 | 4h | ✅ |
| Job 日志组件（ANSI 颜色渲染 + 从日志文本解析 Step 折叠展开） | P2 | 4h | ✅ |
| Actions Tab 列表项点击跳转到 Run 详情页 | P2 | 2h | ✅ |

> **Gitea API 依赖**：基于 Gitea 1.25.4 Actions API。注意：Jobs API 返回 `steps: null`（不提供 step 数据），因此 Step 折叠从日志文本中解析 `⭐ Run Main/Post/Pre` 标记实现。日志为纯文本格式（含 ANSI 转义码），前端用 `ansi-to-html` 渲染。URL 格式对齐 Gitea（`/actions/runs/:runId`）。

#### Week 4+: 权限组管理（从 Week 9 提前）

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 权限组 CRUD API（创建/列表/更新/删除，仅管理员） | P0 | 4h | ✅ |
| 团队权限分配 API（分配/移除权限组，管理员或团队 Owner） | P0 | 3h | ✅ |
| requireTeamOwnerOrAdmin 工具函数 | P0 | 2h | ✅ |
| 权限组管理前端页面（`/orgs/:orgId/permissions`） | P0 | 4h | ✅ |
| 团队权限分配前端 UI（组织详情页团队列表中集成） | P0 | 3h | ✅ |
| requirePermission 中间件（细粒度权限校验） | P1 | 3h | ✅ |

> **访问控制规则**：权限组的创建/编辑/删除允许**系统管理员**和**组织 Owner/Admin** 操作；团队权限分配（将权限组绑定到团队）允许**管理员**或该**团队的 Owner** 操作。

### 交付物

- [x] 后台管理系统（用户/组织/团队/成员管理）
- [x] 项目 CRUD 功能（创建/详情/设置/删除）
- [x] Gitea Webhook 集成（含 HMAC-SHA256 签名验证）
- [x] CI/CD 集成（Gitea Actions 原生驱动，Actions Tab 展示 Workflow Runs）
- [x] 手动触发 Workflow（workflow_dispatch）
- [x] 审计日志系统（writeAuditLog + 管理页面）
- [x] 基础权限中间件（requireAuth / requireAdmin / requireOrgAccess）
- [x] 权限组管理（CRUD + 团队分配 + 细粒度校验）
- [x] 首页统计卡片（我的组织/项目总数/仓库总数/今日构建）
- [x] Actions Run 详情 + Job 日志查看（P2 补充）

### 验收标准

1. 首次登录用户自动成为管理员
2. 管理员可在后台管理用户、查看/管理组织和团队
3. 管理员可添加/移除团队成员、变更角色
4. 可创建项目并关联 Gitea 仓库
5. Gitea Webhook 签名验证正常（伪造请求被拒绝）
6. Actions Tab 正确展示 Gitea Workflow Runs
7. 可手动触发 Workflow 并查看运行结果
8. 非管理员无法访问 /admin 路由，未授权用户访问 API 返回 403
9. 管理员和组织 Owner/Admin 可创建/编辑/删除权限组
10. 团队 Owner 可管理所属团队的权限组绑定
11. 点击 Actions Run 可查看 Run 详情页（Jobs 列表 + 状态）
12. 点击 Job 可展开查看日志（含 ANSI 颜色渲染、Step 折叠）

---

## Phase 3: 飞书集成（Week 5-6）

### 目标

实现飞书消息通知、机器人交互和审批流程。

### 任务清单

#### Week 5: 消息通知

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 飞书应用配置 | P0 | 2h | ⬜ |
| 飞书 API 封装 | P0 | 4h | ⬜ |
| 发布成功/失败通知 | P0 | 4h | ⬜ |
| Agent 运行结果通知 | P1 | 3h | ⬜ |
| 用户飞书绑定页面 | P0 | 4h | ⬜ |
| 通知偏好设置 | P1 | 3h | ⬜ |

#### Week 6: 机器人 + 审批

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 飞书机器人 Webhook | P0 | 4h | ⬜ |
| 机器人指令解析 | P0 | 6h | ⬜ |
| 部署/回滚指令 | P0 | 4h | ⬜ |
| 状态查询指令 | P1 | 3h | ⬜ |
| 飞书审批流程集成 | P1 | 8h | ⬜ |
| 审批状态同步 | P1 | 4h | ⬜ |

### 交付物

- [ ] 飞书消息通知
- [ ] 飞书机器人交互（含操作权限校验）
- [ ] 飞书审批流程（可选）

### 验收标准

1. 发布完成后自动发送飞书通知
2. 可通过飞书机器人触发部署
3. 生产发布需审批通过（可配置）

---

## Phase 4: 扩展功能 - Agent + Pages（Week 7-8）

### 目标

实现 Agent Session 管理和 Pages 静态托管功能。

### 任务清单

#### Week 7: Agent 运行时（open-code 集成）

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| Agent 定义数据模型（systemPrompt + llmConfig + toolConfig） | P0 | 3h | ⬜ |
| AgentSecret 密钒管理（AES-256-GCM 加密存储 LLM API Key） | P0 | 4h | ⬜ |
| Agent Session 数据模型（含 oc_session_id / steps / cost） | P0 | 2h | ⬜ |
| AgentService 集成 @opencode-ai/sdk：createOpencode + session 流程 | P0 | 10h | ⬜ |
| open-code 流式事件映射到 session_logs（text/tool_use/reasoning/step） | P0 | 4h | ⬜ |
| 工具隔离：agent-runner Docker 镜像（限网络 + 非 root） | P0 | 6h | ⬜ |
| Session 实时日志推送（WebSocket） | P0 | 3h | ⬜ |
| 工作区管理：仓库 clone/checkout，完成后可创建 PR | P1 | 4h | ⬜ |
| Agents Tab 页面（含步骤进度、token/cost 展示） | P0 | 6h | ⬜ |
| Session 详情页面（tool 调用、reasoning 可折叠展示） | P1 | 4h | ⬜ |

#### Week 8: Pages 托管

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| Page 数据模型 | P0 | 2h | ⬜ |
| Pages 配置页面 | P0 | 4h | ⬜ |
| 静态文件构建任务 | P0 | 6h | ⬜ |
| 静态文件上传（MinIO） | P0 | 4h | ⬜ |
| Pages 访问代理 | P0 | 6h | ⬜ |
| 自定义域名支持 | P2 | 4h | ⬜ |

### 交付物

- [ ] Agent 定义管理（open-code 配置）
- [ ] Agent 密钒管理
- [ ] Agent Session 管理（open-code 隔离执行）
- [ ] Pages 静态托管功能
- [ ] 实时日志系统（含工具调用、reasoning 展示）

### 验收标准

1. 可创建 Agent（配置 systemPrompt + LLM）并手动触发 Session
2. Session 日志实时显示（含 tool_use、reasoning 可折叠）
3. LLM API Key 以密文存储，明文不可通过 API 读取
4. bash 工具在隔离容器中执行，不影响宿主机
5. 可配置 Pages 并自动部署
6. Pages 可通过子域名访问

---

## Phase 5: 优化上线（Week 9-10）

### 目标

代码质量完善、权限系统补全、文档同步、生产部署。

### 任务清单

#### Week 9: 权限完善 + 代码质量 + 文档

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 权限组管理页面（组织 Owner/Admin 也可管理） | P0 | 6h | ✅ |
| 团队权限分配 UI | P0 | 4h | ✅ |
| 细粒度权限校验完善（Project 级别） | P0 | 4h | ✅ |
| 操作审计日志查看页面 | P1 | 4h | ✅ |
| DTO 验证全量迁移（8 个 handler → readValidatedBody + Zod） | P0 | 6h | ✅ |
| 前端路由重构为 Gitea 风格（`[orgName]/[projectName]`） | P0 | 4h | ✅ |
| Service Token 环境变量方案（去除 DB 管理方案） | P0 | 2h | ✅ |
| 组织级别同步 API（从 admin 迁移到 org 级别） | P0 | 2h | ✅ |
| design.md 文档同步（与实际代码对齐） | P1 | 4h | ✅ |
| plan.md 计划文档同步更新 | P1 | 2h | ✅ |
| 小程序开发码管理 | P2 | 8h | ⬜ |
| 小程序二维码生成（调用微信开放平台 API） | P2 | 4h | ⬜ |

#### Week 10: 部署上线

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| Dockerfile 优化 | P0 | 2h | ⬜ |
| Kubernetes 部署配置 | P0 | 6h | ⬜ |
| 健康检查 + 监控 | P0 | 4h | ⬜ |
| Sentry 错误监控 | P1 | 2h | ⬜ |
| 用户文档 | P1 | 4h | ⬜ |
| API 文档 | P2 | 4h | ⬜ |

### 交付物

- [x] 完整的权限系统（基础版 Week 4，完整版 Week 9）
- [x] DTO 验证全量迁移（Zod schema）
- [x] 前端路由重构为 Gitea 风格
- [x] Service Token 纯环境变量方案
- [x] design.md / plan.md 文档同步
- [ ] 生产环境部署
- [ ] 监控告警
- [ ] 用户文档

### 验收标准

1. 权限控制正常工作
2. 生产环境稳定运行
3. 监控告警正常
4. 文档完整可用

---

## Phase 6: 工作区 — 容器化开发环境（Week 11-13）

### 目标

实现工作区功能：创建容器化开发环境，通过 Web VSCode 或 VSCode Remote 进入容器进行代码编辑、提交和测试环境部署。容器生命周期与工作区同步，删除工作区即销毁容器。

### 技术选型

| 技术 | 选择 | 说明 |
| ---- | ---- | ---- |
| **容器运行时** | Docker（dockerode） | 接口层抽象 `ContainerRuntime`，后续可切 K8s |
| **Web IDE** | openvscode-server | Gitpod 维护，功能完整的 Web 端 VSCode |
| **网关代理** | Teax 内置（h3 proxyRequest） | Nitro server route 反向代理，支持 WebSocket |

### 任务清单

#### Week 11: 容器运行时 + 数据库 + 服务层

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| `ContainerRuntime` 接口定义（create/start/stop/remove/inspect/list/logs） | P0 | 3h | ⬜ |
| `DockerRuntime` 实现（基于 dockerode） | P0 | 6h | ⬜ |
| `workspaces` 数据库表 + Drizzle Schema（`server/db/schema/workspace.ts`） | P0 | 3h | ⬜ |
| `workspace.dto.ts` — createWorkspaceBody + select/insert schema | P0 | 2h | ⬜ |
| `WorkspaceService`：createWorkspace（创建容器 + 端口分配 + DB 记录） | P0 | 8h | ⬜ |
| `WorkspaceService`：startWorkspace / stopWorkspace | P0 | 4h | ⬜ |
| `WorkspaceService`：deleteWorkspace（销毁容器 + 清理数据卷 + 释放端口） | P0 | 4h | ⬜ |
| 端口分配策略（IDE: 10000-19999，App: 20000-29999，持久化到 DB） | P0 | 3h | ⬜ |
| 工作区状态机（creating → running → stopping → stopped → starting → deleting） | P0 | 2h | ⬜ |
| 权限 key 定义（`workspace:create`, `workspace:manage`） | P1 | 1h | ⬜ |

#### Week 12: 网关代理 + 容器镜像 + API

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| 工作区容器镜像（`Dockerfile.workspace` + `entrypoint.sh`） | P0 | 6h | ⬜ |
| 镜像内容：openvscode-server + Git + Node.js 20 + SSH Server | P0 | 含上 | ⬜ |
| entrypoint.sh：clone 仓库 → 配置 Git → 启动 openvscode-server | P0 | 含上 | ⬜ |
| 网关代理 server route（`server/routes/workspace/[name]/[...path].ts`） | P0 | 6h | ⬜ |
| 代理路径分流：`/ide/**` → 容器:3000，`/**` → 容器:8080 | P0 | 含上 | ⬜ |
| WebSocket 升级支持（openvscode-server 实时通信） | P0 | 3h | ⬜ |
| 代理层权限校验（session + 工作区归属） | P0 | 3h | ⬜ |
| 项目级工作区 API（6 个 endpoint：list/create/detail/delete/start/stop） | P0 | 8h | ⬜ |
| 管理员工作区 API（全局列表 + 强制删除） | P1 | 3h | ⬜ |
| Git 凭证注入（Gitea PAT → 容器环境变量） | P0 | 2h | ⬜ |

#### Week 13: 前端页面 + 集成 + 测试

| 任务 | 优先级 | 预估 | 状态 |
| ---- | ------ | ---- | ---- |
| `WorkspaceCard.vue` 组件（名称、分支、状态、操作按钮） | P0 | 4h | ⬜ |
| `WorkspaceCreateModal.vue` 组件（名称、分支选择、资源配置） | P0 | 4h | ⬜ |
| Workspaces Tab 页面（`/:orgName/:projectName/workspaces`） | P0 | 6h | ⬜ |
| 管理员全局工作区页面（`/-/admin/workspaces`） | P0 | 4h | ⬜ |
| Admin 侧边栏新增「工作区」导航项 | P0 | 1h | ⬜ |
| 项目工作台 Tab 导航新增 Workspaces | P0 | 1h | ⬜ |
| `workspace:create` / `workspace:manage` 权限集成 | P0 | 3h | ⬜ |
| 审计日志集成（workspace.create / workspace.delete） | P1 | 2h | ⬜ |
| 容器资源限制验证（CPU/内存上限生效） | P0 | 2h | ⬜ |
| 端到端测试（创建 → 打开 IDE → 停止 → 删除完整流程） | P0 | 4h | ⬜ |
| 默认权限组更新（新增 workspace:create 到"开发者"默认权限） | P1 | 1h | ⬜ |

### 交付物

- [ ] 容器运行时抽象层（`ContainerRuntime` 接口 + `DockerRuntime` 实现）
- [ ] 工作区 CRUD + 容器生命周期管理（`WorkspaceService`）
- [ ] 工作区容器镜像（openvscode-server + Git + Node.js）
- [ ] 网关代理（IDE + 测试环境 + WebSocket 支持）
- [ ] 项目级工作区 API（6 个 endpoint）
- [ ] 管理员工作区 API（全局列表 + 强制删除）
- [ ] 前端 Workspaces Tab + 创建弹窗 + Admin 管理页
- [ ] 权限集成（`workspace:create` / `workspace:manage`）
- [ ] 审计日志集成

### 验收标准

1. 可在项目下创建工作区，自动启动容器并 clone 仓库代码
2. 通过 `/workspace/{name}/ide/` 打开 Web VSCode，可正常编辑和保存文件
3. 通过 `/workspace/{name}/` 预览容器内测试环境应用
4. 停止工作区后数据卷保留，重新启动后代码仍在
5. 删除工作区后容器和数据卷被完全清理
6. 宿主端口绑定 127.0.0.1，外部无法直接访问容器端口
7. 未授权用户无法通过网关代理访问他人工作区
8. 容器 CPU/内存限制生效，不超过配置上限
9. 管理员可在全局管理页查看和强制删除任意工作区
10. 审计日志正确记录工作区的创建和删除操作

---

## 技术风险

| 风险 | 影响 | 缓解措施 |
| ---- | ---- | -------- |
| Gitea API 兼容性 | 高 | 提前调研 API 版本，做好适配层 |
| 飞书审批流程复杂 | 中 | 先实现基础通知，审批作为 P1 |
| WebSocket 连接稳定性 | 中 | 实现重连机制，降级为轮询（当前已延期） |
| Agent 任务资源消耗 | 中 | 限制并发数，Docker 隔离执行 |
| 工作区容器逃逸 | 高 | 非 root 用户运行，挂载目录限定为工作区数据卷，宿主端口绑定 127.0.0.1 |
| 工作区端口耗尽 | 中 | 端口范围 10000-29999（可支持约 10000 个工作区），定期清理已删除工作区端口 |
| Docker Socket 安全 | 高 | 限制 Teax 容器内 Docker API 调用范围，后续可迁移到 K8s RBAC |
| openvscode-server 兼容性 | 中 | 锁定版本，预构建镜像测试，提供 SSH 备选方案 |

---

## 依赖项

### 外部依赖

| 依赖 | 用途 | 负责人 | 状态 |
| ---- | ---- | ------ | ---- |
| Gitea 实例 | 仓库托管 | 运维 | ⬜ |
| PostgreSQL 16 | 主数据库 | 运维 | ⬜ |
| Redis 7 | 缓存/队列 | 运维 | ⬜ |
| Docker Engine | Agent 隔离运行环境 + 工作区容器运行时 | 运维 | ⬜ |
| S3 兼容存储 | 对象存储（火山引擎 TOS） | 运维 | ⬜ |
| 飞书应用 | 消息/审批 | 产品 | ⬜ |
| 微信开放平台账号 | 小程序码生成 | 产品 | ⬜ |
| 域名/SSL（含通配符证书） | Pages 子域名托管 | 运维 | ⬜ |

### 内部依赖

| 依赖 | 用途 | 状态 |
| ---- | ---- | ---- |
| Gitea OAuth 应用 | 用户认证 | ⬜ |
| @opencode-ai/sdk | Agent 执行引擎 | ⬜ |
| dockerode | Docker Engine API 客户端（容器运行时） | ⬜ |
| openvscode-server 镜像 | 工作区 Web IDE 基础镜像 | ⬜ |
| 飞书企业应用 | 消息通知 | ⬜ |
| 飞书机器人 | 指令交互 | ⬜ |

---

## 开发规范

### Git 分支策略

```text
main          ─────────────────────────────────────────▶
                    │              │              │
feature/*     ──────┴──────────────┴──────────────┴─────
                    │              │              │
                    ▼              ▼              ▼
                  PR/MR          PR/MR          PR/MR
```

- `main`: 生产分支，保护分支
- `feature/*`: 功能分支，完成后合并到 main
- PR 需要 Code Review

### 代码规范

- TypeScript strict 模式
- ESLint + Prettier
- 组件使用 `<script setup>` 语法
- API 使用 RESTful 风格
- 错误处理统一封装

### 测试策略

| 类型 | 覆盖范围 | 工具 |
| ---- | -------- | ---- |
| 单元测试 | Service 层 | Vitest |
| 组件测试 | 关键组件 | Vue Test Utils |
| E2E 测试 | 核心流程 | Playwright |

---

## 启动检查清单

### 开发环境

- [ ] Node.js 20+ 安装
- [ ] pnpm 安装
- [ ] Docker Desktop 安装（含 Docker Socket 访问权限，工作区容器运行时需要）
- [ ] PostgreSQL 本地实例
- [ ] Redis 本地实例
- [ ] Gitea 测试实例访问权限
- [ ] 飞书开发者账号
- [ ] openvscode-server 镜像预拉取（`docker pull gitpod/openvscode-server:latest`）

### 配置项

- [ ] `.env` 文件配置
- [ ] Gitea OAuth 应用创建
- [ ] 飞书应用创建（可选）
- [ ] 数据库初始化

---

## 下一步行动

1. **已完成**：Phase 1-2 ✅，Phase 5 Week 9 ⚡ 部分完成（权限 + 代码质量 + 文档）
2. **设计完成**：Phase 6 工作区功能设计已写入 design.md（技术选型 + 架构 + 数据模型 + API + 页面）
3. **下一步**（按优先级）：
   - **Phase 3**（Week 5-6）：飞书集成 — 消息通知 + 机器人指令 + 审批流程
   - **Phase 6**（Week 11-13）：工作区 — 容器运行时 + 网关代理 + 前端页面
   - **Phase 4**（Week 7-8）：Agent + Pages — 可根据业务需要穿插
4. **持续**：每周 Review 进度，调整计划
