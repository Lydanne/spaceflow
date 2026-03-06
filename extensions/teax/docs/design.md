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
| **系统管理员** | 首次注册用户自动获得，或由已有管理员手动授权 | 访问 `/-/admin` 后台、管理所有用户、手动同步组织/团队、设置其他用户为管理员、管理所有组织的权限组和设置 |
| **普通用户** | 通过 Gitea OAuth 或飞书 OAuth 注册 | 访问自己所属组织的项目和功能，权限由所在团队的权限组决定 |

> **首次登录规则**：当 `users` 表为空时，第一个通过 Gitea OAuth 登录的用户自动成为系统管理员（`is_admin = true`），不受 Gitea 账号权限影响。

#### 权限管理访问控制

权限组的管理（创建/编辑/删除权限组、为团队分配/移除权限组）仅限以下角色操作：

| 角色 | 权限管理范围 | 说明 |
| ---- | ------------ | ---- |
| **系统管理员** | 所有组织的所有权限组 | `is_admin = true` 的用户可管理任意组织的权限配置 |
| **组织 Owner/Admin** | 所属组织的所有权限组 | 通过 `requireOrgOwnerOrAdmin` 中间件校验，可创建/编辑/删除权限组 |
| **团队 Owner** | 所属团队的权限组分配 | `team_members.role = 'owner'` 的用户可管理自己所属团队的权限组绑定 |

```text
权限管理判定流程：

请求到达 → 是系统管理员？ ──是──→ 允许
                │
               否
                │
                ▼
      是组织 Owner/Admin？ ──是──→ 允许（权限组 CRUD + 团队分配）
                │
               否
                │
                ▼
         是团队 Owner？ ──是──→ 允许（仅限所属团队的权限组分配）
                │
               否
                │
                ▼
             拒绝 403
```

> **注意**：权限组属于组织级别。系统管理员和组织 Owner/Admin 均可创建/编辑/删除权限组定义。团队 Owner 只能将已有的权限组**分配给**自己所在的团队。

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
| **权限组** | 创建权限组，分配功能权限（如发布、审批等）。**管理员或组织 Owner/Admin 可创建/编辑/删除** |
| **团队权限** | 将权限组分配给 Gitea Team，团队成员自动继承。**管理员或团队 Owner 可操作** |

#### 登录方式

| 方式 | 说明 |
| ---- | ---- |
| **Gitea OAuth** | 使用 Gitea 账号登录（主要方式） |
| **飞书 OAuth** | 使用飞书账号登录，首次登录需关联 Gitea 账号 |

> 无论使用哪种方式登录，最终都需要关联到 Gitea 账号，因为系统核心功能依赖 Gitea。

## 设计规范

> Teax 的前端路由和后端 API **直接采用 Gitea 的规范**。Gitea 未覆盖的功能（Agents、Pages 等）采用 GitHub 的规范。设计新功能前必须先查阅：
>
> - **Gitea**：实例 Swagger 文档 `https://{your-gitea}/-/api/swagger`
> - **GitHub**：[REST API 文档](https://docs.github.com/en/rest)

### 前端路由规范

采用 Gitea 的 Web UI 路由结构。Gitea 的 URL 设计核心是 **name-based 语义化路径**：

```text
Gitea 路由规范：
  /:owner/:repo                    — 仓库首页
  /:owner/:repo/actions            — Actions（CI/CD）
  /:owner/:repo/issues             — Issues
  /:owner/:repo/pulls              — Pull Requests
  /:owner/:repo/settings           — 仓库设置
  /org/:orgname                    — 组织首页（成员 & 仓库）
  /org/:orgname/settings           — 组织设置
  /org/:orgname/members            — 组织成员
  /repo/create                     — 创建仓库（全局入口）
  /user/settings                   — 用户设置
  /explore                         — 探索（仓库/用户/组织）
  /-/admin                         — 系统管理面板（管理员）
  /-/admin/users                   — 用户管理
  /-/admin/orgs                    — 组织管理
  /-/admin/repos                   — 仓库管理
```

**Teax 直接采用上述结构**，仅在 Gitea 未覆盖的 Teax 扩展功能上沿用相同风格。实际文件路由使用 `[orgName]`/`[projectName]` 命名：

```text
Teax 路由结构（= Gitea 路由 + 扩展）：

Gitea 原有路由（直接采用）：
  /:orgName                        — 组织项目列表（文件路由 [orgName]/index.vue）
  /:orgName/:projectName           — 项目首页（README）
  /:orgName/:projectName/actions   — Actions（Gitea Workflow Runs）
  /:orgName/:projectName/settings  — 项目设置
  /org/:orgName/settings           — 组织设置（团队 + 权限组管理）
  /-/admin                         — 系统管理面板
  /-/admin/users                   — 用户管理
  /-/admin/orgs                    — 组织管理
  /-/admin/orgs/:orgId             — 组织详情（团队 + 权限组）

Teax 扩展路由（Gitea 无，采用 GitHub 风格）：
  /:orgName/:projectName/agents    — Agent Session 管理（类似 GitHub Actions 子页面风格）
  /:orgName/:projectName/pages     — Pages 静态托管（类似 GitHub Pages 设置风格）
  /org/:orgName/new                — 创建项目（Gitea 用 /repo/create，Teax 按组织维度）

通用路由：
  /                                — 首页/仪表盘
  /auth/login                      — 登录
  /auth/callback/gitea             — Gitea OAuth 回调
  /auth/callback/feishu            — 飞书 OAuth 回调
  /-/admin/audit-logs              — 审计日志（Teax 扩展）
  /-/admin/settings                — 系统设置（Teax 扩展）
```

**路由冲突处理**（Gitea 约定）：

Gitea 使用固定前缀避免与 `/:owner/:repo` 动态路由冲突，Teax 完全沿用：

| 前缀 | 用途 | Gitea 原有 |
| ---- | ---- | ---------- |
| `/-/` | 系统级功能（admin、API swagger） | ✅ `/-/admin`、`/-/api/swagger` |
| `/org/` | 组织管理页面 | ✅ `/org/:orgname/settings` |
| `/repo/` | 仓库级全局操作 | ✅ `/repo/create` |
| `/user/` | 用户设置 | ✅ `/user/settings` |
| `/auth/` | 认证流程 | Teax 自定义（Gitea 用 `/user/login`） |
| `/explore/` | 探索页面 | ✅ `/explore/repos`、`/explore/users` |

### 后端 API 规范

参考 Gitea API v1 的路径风格，但 **实际实现采用 UUID-based 路径**（`/api/orgs/{orgId}/...`），前端通过 resolve API 将 name 映射为 UUID：

#### 路径设计

```text
Gitea API v1 规范（参考）：
  /api/v1/user                              — 当前用户信息
  /api/v1/user/orgs                         — 当前用户的组织列表
  /api/v1/orgs/{orgname}                    — 组织信息
  /api/v1/orgs/{orgname}/repos              — 组织仓库列表
  /api/v1/orgs/{orgname}/teams              — 组织团队列表
  /api/v1/repos/{owner}/{repo}              — 仓库信息
  /api/v1/repos/{owner}/{repo}/branches     — 分支列表
  /api/v1/repos/{owner}/{repo}/actions/runs — Workflow Runs
  /api/v1/admin/users                       — 管理员：用户列表
  /api/v1/admin/orgs                        — 管理员：组织列表
```

**Teax API 实际路径**（UUID-based + resolve 桥接）：

> **设计决策**：前端路由使用 name-based URL（`/{orgName}/{projectName}`），但后端 API 内部使用 UUID 做数据库查询。前端通过 `/api/resolve/*` 将 orgName/projectName 解析为 UUID 后，再调用 UUID-based 的业务 API。

```text
Teax API 路径（实际实现）：

名称解析（前端路由 → UUID 桥接）：
  GET    /api/resolve/{orgName}                 — 通过组织名查找组织（返回 id, name, displayName, avatarUrl）
  GET    /api/resolve/{orgName}/{projectName}   — 通过 fullName 查找项目（返回完整项目详情含 organizationId）

组织（UUID-based）：
  GET    /api/orgs                              — 当前用户的组织列表（含项目数统计）
  GET    /api/orgs/{orgId}/repos                — 搜索 Gitea 仓库（创建项目时用）
  GET    /api/orgs/{orgId}/role                 — 当前用户在该组织的角色
  GET    /api/orgs/{orgId}/my-permissions       — 当前用户在该组织的权限列表
  POST   /api/orgs/{orgId}/sync                 — 同步组织团队（requireOrgOwnerOrAdmin）
  GET    /api/orgs/{orgId}/teams                — 团队列表
  GET    /api/orgs/{orgId}/teams/{teamId}/members           — 团队成员列表
  GET    /api/orgs/{orgId}/teams/{teamId}/assigned-permissions — 团队已分配的权限组
  POST   /api/orgs/{orgId}/teams/{teamId}/assigned-permissions — 为团队分配权限组
  DELETE /api/orgs/{orgId}/teams/{teamId}/assigned-permissions/{assignmentId} — 移除团队权限组
  GET    /api/orgs/{orgId}/permissions          — 权限组列表
  POST   /api/orgs/{orgId}/permissions          — 创建权限组（requireOrgOwnerOrAdmin）
  PUT    /api/orgs/{orgId}/permissions/{groupId}    — 更新权限组（requireOrgOwnerOrAdmin）
  DELETE /api/orgs/{orgId}/permissions/{groupId}    — 删除权限组（requireOrgOwnerOrAdmin）

项目（UUID-based，嵌套在组织下）：
  GET    /api/orgs/{orgId}/projects             — 项目列表
  POST   /api/orgs/{orgId}/projects             — 创建项目（+ 注册 Gitea Webhook）
  GET    /api/orgs/{orgId}/projects/{projectId}           — 项目详情
  DELETE /api/orgs/{orgId}/projects/{projectId}           — 删除项目（+ 清理 Webhook）
  PATCH  /api/orgs/{orgId}/projects/{projectId}/settings  — 更新项目设置
  GET    /api/orgs/{orgId}/projects/{projectId}/branches  — 分支列表
  GET    /api/orgs/{orgId}/projects/{projectId}/readme    — 项目 README 内容
  GET    /api/orgs/{orgId}/projects/{projectId}/actions   — Workflow Runs 列表
  POST   /api/orgs/{orgId}/projects/{projectId}/actions   — 触发 Workflow
  GET    /api/orgs/{orgId}/projects/{projectId}/workflows — Workflow 定义列表

权限定义：
  GET    /api/permissions/definitions           — 全局权限 key 定义列表

统计：
  GET    /api/stats/today-publishes             — 今日构建数量
  GET    /api/stats/repo-count                  — 用户可见仓库总数
  GET    /api/stats/recent-commits              — 最近提交记录

管理员（UUID-based）：
  GET    /api/admin/users                       — 用户列表
  POST   /api/admin/users/{userId}/toggle-admin — 切换管理员身份
  GET    /api/admin/orgs                        — 组织列表（含统计）
  GET    /api/admin/orgs/{orgId}                — 组织详情
  POST   /api/admin/orgs/{orgId}/sync           — 同步组织
  GET    /api/admin/orgs/{orgId}/teams          — 团队列表
  GET    /api/admin/orgs/{orgId}/teams/{teamId}/members          — 成员列表
  POST   /api/admin/orgs/{orgId}/teams/{teamId}/members          — 添加成员
  PATCH  /api/admin/orgs/{orgId}/teams/{teamId}/members/{memberId} — 更新成员角色
  DELETE /api/admin/orgs/{orgId}/teams/{teamId}/members/{memberId} — 移除成员
  GET    /api/admin/audit-logs                  — 审计日志（分页 + 关联用户/组织）

认证：
  GET    /api/auth/gitea                        — Gitea OAuth 重定向
  GET    /api/auth/feishu                       — 飞书 OAuth 重定向
  GET    /api/auth/callback/gitea               — Gitea OAuth 回调
  GET    /api/auth/callback/feishu              — 飞书 OAuth 回调
  GET    /api/auth/session                      — 获取当前 Session
  POST   /api/auth/logout                       — 登出

Webhook 接收：
  POST   /api/webhooks/gitea                    — Gitea Webhook 接收（HMAC-SHA256 签名验证）
```

#### 请求与响应规范

采用 Gitea API 的请求/响应格式：

| 规范项 | Gitea 规范 | Teax 实现 |
| ------ | ---------- | --------- |
| **认证** | `Authorization: token {PAT}` 或 `?token=` | 采用 Cookie Session（Web 应用），内部调 Gitea 时用 PAT |
| **路径参数** | name-based（`{owner}/{repo}`、`{orgname}`） | API 内部使用 UUID（`{orgId}`、`{projectId}`），前端通过 `/api/resolve/*` 桥接 name → UUID |
| **分页** | `?page=1&limit=20` | 完全采用 |
| **排序** | `?sort=created&order=desc` | 完全采用 |
| **时间格式** | ISO 8601（`2023-01-15T10:30:00Z`） | 完全采用 |
| **错误响应** | `{ "message": "...", "url": "swagger doc url" }` | 采用 `{ "message": "..." }` |
| **空列表** | 返回 `[]`（不包装） | 采用 `{ "data": [], "total": 0 }` 包装（便于分页） |

#### 响应格式

**单个资源**（与 Gitea 一致，直接返回对象）：

```json
{
  "id": 42,
  "name": "repo",
  "full_name": "owner/repo",
  "description": "...",
  "html_url": "https://teax.example.com/owner/repo",
  "created_at": "2026-01-15T10:30:00Z"
}
```

**列表资源**（Teax 在 Gitea 基础上增加分页包装）：

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

> Gitea 列表 API 返回裸数组 + `X-Total-Count` header。Teax 选择 JSON 包装分页信息，对前端更友好。

**错误响应**：

```json
{
  "message": "Not Found",
  "url": "https://teax.example.com/-/api/swagger"
}
```

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

> **Tab 路由结构**：每个 Tab 对应独立子路由路径（如 `/{orgName}/{projectName}/actions`），采用 Gitea 风格的 URL 结构。`[projectName].vue` 作为布局页提供项目头部和 Tab 导航，子路由通过 `<NuxtPage>` 渲染。Tab 切换使用 `<NuxtLink>` 导航，天然支持刷新保持、链接分享、浏览器前进/后退。

> **Actions Tab 说明**：CI/CD 完全由 Gitea Actions（`.gitea/workflows/*.yml`）驱动。Teax 通过 Gitea API 代理展示 workflow runs 列表，提供飞书通知等增值功能。不再维护独立的 PublishTask 发布系统。

### 3. CI/CD 集成（Gitea Actions）

#### 3.1 架构

```text
代码提交 → Gitea Actions 自动触发 → workflow 执行 → Teax Webhook 接收通知 → 飞书推送
```

- **CI/CD 执行**：由 Gitea Actions 原生处理，Teax 不参与构建部署过程
- **数据展示**：Teax 后端通过 Gitea API（`/api/v1/repos/{owner}/{repo}/actions/runs`）获取 workflow runs，前端通过 `/api/orgs/{orgId}/projects/{projectId}/actions` 代理访问
- **Workflow 解析**：Teax 后端通过 Gitea API（`/api/v1/repos/{owner}/{repo}/contents/{path}`）获取 workflow YAML 并解析
- **通知增值**：Gitea Webhook 推送事件到 Teax，Teax 根据项目通知设置发送飞书通知

#### 3.2 Workflow 信息卡片

选中具体 workflow 时，在 runs 列表上方展示信息卡片：

| 信息项 | 数据来源 | 说明 |
| ------ | -------- | ---- |
| **触发方式** | YAML `on` 字段 | 蓝色圆角 badge（push / schedule / workflow_dispatch 等） |
| **输入参数数量** | YAML `on.workflow_dispatch.inputs` | 如 "3 个参数"（有参数时才显示） |
| **定时调度** | YAML `on.schedule[].cron` | 使用 `cronstrue` 库转为中文可读文本（如 "在 02:00, 仅在 星期一"），hover 显示原始 cron |
| **文件路径** | workflow `.path` 字段 | 等宽字体显示完整路径（Workflows API 返回格式 `.gitea/workflows/xxx.yaml`） |
| **描述** | YAML `x-description` 自定义扩展字段 | 可折叠显示，默认收起，点击"详情"展开 |

> **自定义扩展字段约定**：所有 Teax 自定义的 YAML 顶级字段使用 `x-` 前缀（如 `x-description`），以避免与标准 GitHub Actions / Gitea Actions 字段冲突。

#### 3.3 Workflow Run 卡片

每个 run 卡片包含以下信息：

```text
┌──────────────────────────────────────────────────────────────────┐
│  ✓  ci: 添加工作流描述信息  #508  [成功]                        ↗  │
│  � publish.yml  🌿 develop  9bcc505  [推送]  👤 liuhuan  🕐 5m  ⏱ 2m36s │
└──────────────────────────────────────────────────────────────────┘
```

- **左侧状态图标**：根据状态显示不同颜色图标（蓝色时钟=排队中、琥珀色旋转=运行中、绿色勾=成功、红色叉=失败、灰色禁止=已取消）
- **状态 badge**：中文标签（排队中/等待中/运行中/成功/失败/已取消/已跳过）
- **Workflow 文件名**：当未按 workflow 筛选时，显示 `filename.yml`（带后缀），从 `path` 字段解析
- **元信息行**：带图标装饰（workflow 文件名、git-branch 分支、user 用户、clock 相对时间、timer 耗时）
- **事件 badge**：中文化（push→推送、workflow_dispatch→手动触发、schedule→定时、pull_request→PR）
- **相对时间**：刚刚 / N 分钟前 / N 小时前 / N 天前（超 7 天显示日期）
- **耗时**：空值自动隐藏（不显示无意义的 "-"）
- 点击整个卡片跳转到 Gitea Actions 查看详细日志

> **Gitea Workflow Runs API `path` 字段格式**：返回 `filename.yml@refs/heads/branch`（如 `publish.yml@refs/heads/main`），而非完整文件路径。解析 workflow 文件名需用 `@` 分隔取前半部分。Workflows 列表 API 的 `path` 字段则返回完整路径（如 `.gitea/workflows/publish.yml`）。

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
         │        └─ step_finish → 累加 tokens_used / cost
         │
         ├─ 8. [可选] git add . && git commit && Gitea API 创建 PR
         │        └─ 写入 AgentSession.pr_url
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

采用 Gitea Web UI 路由规范（详见「设计规范 > 前端路由规范」）：

```text
/                                    # 首页/仪表盘（组织列表 + 统计卡片）
│
├── /auth
│   ├── /login                       # 登录页
│   └── /callback
│       ├── /gitea                   # Gitea OAuth 回调
│       └── /feishu                  # 飞书 OAuth 回调
│
├── /:orgName                        # 组织项目列表（动态路由 [orgName]）
│   └── /:projectName               # 项目工作台（布局页 [projectName].vue）
│       ├── /                        # README / 概览（默认）
│       ├── /actions                 # Actions — Gitea Workflow Runs
│       ├── /agents                  # Agents — AI Agent Sessions（Teax 扩展）
│       ├── /pages                   # Pages — 静态托管（Teax 扩展）
│       └── /settings                # 项目设置（仅 owner/admin）
│
├── /org/:orgName                    # 组织管理（使用 /org/ 前缀避免与 /:orgName/:projectName 冲突）
│   ├── /settings                    # 组织设置（团队 + 权限组管理）
│   └── /new                         # 创建项目
│
└── /-/admin                         # 系统管理（= Gitea /-/admin，仅管理员）
    ├── /users                       # 用户管理
    ├── /orgs                        # 组织管理
    │   └── /:orgId                  # 组织详情（团队 + 权限组）
    ├── /audit-logs                  # 审计日志（Teax 扩展）
    └── /settings                    # 系统设置
```

> **未实现页面**：`/user/settings`（个人信息、飞书绑定、通知设置）尚未实现，计划后续迭代。前端页面通过 `/api/resolve/{orgName}/{projectName}` 获取 UUID 后，再调用 `/api/orgs/{orgId}/...` 等 UUID-based API 获取数据。

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
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │ 我的组织   │ │ 项目总数   │ │ 仓库总数   │ │ 今日构建   │  │
│  │    3      │ │    12     │ │    28     │ │     5     │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│                                                             │
│  我的组织                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ xg-org        项目: 5   仓库: 12    最后同步: 2分钟前  │   │
│  │ bj-org        项目: 3   仓库: 8     最后同步: 1小时前  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  最近提交                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ abc1234  feat: add new feature    xg/nodecloud  2m前 │   │
│  │ def5678  fix: bug fix             xg/webapp     1h前 │   │
│  │ 9bcc505  chore: update deps       xg/api-server 3h前 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3. 创建项目 `/org/:orgName/new`

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

#### 4. 项目工作台 `/:orgName/:projectName`

```text
┌─────────────────────────────────────────────────────────────┐
│  xg/nodecloud                                               │
│  Node.js 云服务项目                                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┬────────┬────────┬────────┬────────┐           │
│  │ README  │Actions │ Agents │ Pages  │ 设置   │           │
│  └─────────┴────────┴────────┴────────┴────────┘           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌── Workflow 信息卡片 ──────────────────────────────────┐  │
│  │  publish.yml                                          │  │
│  │  触发: [push] [workflow_dispatch]   参数: 3个          │  │
│  │  调度: 每天 02:00                    [触发 Workflow]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Workflow Runs                          [筛选: All ▾]       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ┌──────────────────────────────────────────────┐    │   │
│  │ │  #42  feat: add new feature           ● 运行中 │    │   │
│  │ │  publish.yml  master  abc1234  · 2分钟前       │    │   │
│  │ └──────────────────────────────────────────────┘    │   │
│  │ ┌──────────────────────────────────────────────┐    │   │
│  │ │  #41  fix: bug fix                    ✓ 成功  │    │   │
│  │ │  publish.yml  master  def5678  · 1小时前       │    │   │
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

#### 6. 团队管理 `/org/:orgName/settings`

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

#### 7. 权限组管理 `/org/:orgName/settings`

```text
┌─────────────────────────────────────────────────────────────┐
│  权限组管理                                      [新建权限组] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  管理员                                       │   │   │
│  │  │  拥有所有权限                                  │   │   │
│  │  │  权限: repo:* actions:* agent:* ...          │   │   │
│  │  │                                    [编辑]     │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  开发者                                       │   │   │
│  │  │  可以触发 Actions 和启动 Agent                  │   │   │
│  │  │  权限: actions:trigger agent:start agent:stop │   │   │
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

#### 8. 个人账号 - 飞书绑定 `/account/feishu`（⏳ 未实现）

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

#### 9. 后台管理 - 用户管理 `/-/admin/users`

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

#### 10. 后台管理 - 组织管理 `/-/admin/orgs`

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

#### 11. 后台管理 - 组织详情 `/-/admin/orgs/:orgId`

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

> 当前 Header 和 Sidebar 功能内嵌在 `layouts/default.vue` 和 `layouts/admin.vue` 中，尚未拆分为独立组件。

| 组件 | 状态 | 说明 |
| ---- | ---- | ---- |
| `AppLogo` | ✅ | 应用 Logo |
| `TemplateMenu` | ✅ | 模板菜单 |
| `AppHeader` | 规划中 | 顶部导航栏，包含 Logo、组织切换、搜索、用户菜单 |
| `AppSidebar` | 规划中 | 侧边栏导航，根据当前组织显示菜单 |
| `OrgSwitcher` | 规划中 | 组织切换下拉框 |
| `UserMenu` | 规划中 | 用户头像下拉菜单 |
| `NotificationBell` | 规划中 | 通知铃铛，显示未读通知数 |

#### 业务组件（已实现）

| 组件 | 说明 |
| ---- | ---- |
| `ProjectActionsTab` | Actions Tab：workflow 信息卡片 + runs 列表 + 手动触发弹窗 |
| `ProjectActionsSkeleton` | Actions Tab 骨架屏加载状态 |
| `ProjectSettingsTab` | 设置 Tab：通知配置（notifyOnSuccess/notifyOnFailure）+ 删除项目 |
| `ProjectReadmeTab` | README Tab：展示 TEAX.md 或 README.md 内容 |
| `ProjectTabSkeleton` | 通用 Tab 骨架屏 |
| `OrgTeamPanel` | 团队管理面板：成员列表、角色变更、权限组分配 |
| `OrgPermissionPanel` | 权限组管理面板：CRUD、权限选择、仓库范围 |
| `AppLogo` | 应用 Logo 组件 |
| `TemplateMenu` | 模板菜单组件 |

#### 业务组件（规划中）

| 组件 | 说明 |
| ---- | ---- |
| `SessionCard` | Agent Session 卡片，显示运行状态、耗时 |
| `LogViewer` | 日志查看器，支持实时日志流 |
| `StatusBadge` | 状态徽章（运行中/成功/失败等） |

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
└──────┬──────┘     └──────┬──────┘     └─────────────┘
       │                   │
       │ has_many          │ has_many
       ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Repository  │     │ TeamMember  │     │  AuditLog   │
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
  gitea_id: number;              // Gitea 用户 ID
  gitea_username: string;        // Gitea 用户名
  email: string;
  avatar_url?: string;
  is_admin: boolean;             // 系统管理员
  row_creator?: string;          // 记录创建者（公共字段）
  created_at: Date;
  updated_at: Date;
}
```

#### UserFeishu（飞书绑定）

```typescript
interface UserFeishu {
  id: string;
  user_id: string;               // 关联 User.id
  feishu_open_id: string;        // 飞书 open_id
  feishu_union_id?: string;      // 飞书 union_id
  feishu_name: string;           // 飞书显示名
  feishu_avatar?: string;
  access_token?: string;         // 飞书 access_token（加密存储）
  token_expires_at?: Date;       // token 过期时间
  notify_publish: boolean;       // 接收发布通知（默认 true）
  notify_approval: boolean;      // 接收审批请求（默认 true）
  notify_agent: boolean;         // 接收 Agent 运行结果（默认 true）
  notify_system: boolean;        // 接收系统通知（默认 false）
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### Organization（组织）

```typescript
interface Organization {
  id: string;
  gitea_org_id: number;          // Gitea Organization ID
  name: string;                  // 组织名称
  full_name?: string;
  avatar_url?: string;
  synced_at: Date;               // 最后同步时间
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### Team（团队）

```typescript
interface Team {
  id: string;
  organization_id: string;      // 关联 Organization.id
  gitea_team_id: number;        // Gitea Team ID
  name: string;
  description?: string;
  synced_at: Date;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### TeamMember（团队成员）

```typescript
interface TeamMember {
  id: string;
  team_id: string;               // 关联 Team.id
  user_id: string;               // 关联 User.id
  role: 'owner' | 'member';      // 团队角色
  joined_at: Date;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### PermissionGroup（权限组）

```typescript
interface PermissionGroup {
  id: string;
  organization_id: string;       // 所属组织
  type: 'default' | 'custom';    // 权限组类型
  name: string;                  // 权限组名称
  description?: string;
  permissions: string[];          // 权限 key 列表，如 ["repo:view", "actions:view"]
  repository_ids: string[] | null; // null=全部仓库, ["id1"]=指定仓库
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}

type Permission =
  | 'repo:view'
  | 'repo:create'
  | 'repo:delete'
  | 'repo:settings'
  | 'actions:view'
  | 'actions:trigger'
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
  team_id: string;               // 关联 Team.id
  permission_group_id: string;   // 关联 PermissionGroup.id
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

---

### 仓库相关

#### Repository（仓库）

```typescript
interface Repository {
  id: string;
  organization_id: string;       // 所属组织
  gitea_repo_id: number;         // Gitea 仓库 ID
  name: string;                  // 仓库名称
  full_name: string;             // 完整名称 (owner/repo)
  description?: string;
  default_branch: string;        // 默认分支
  clone_url: string;             // Git clone 地址
  webhook_id?: number;           // Gitea Webhook ID
  webhook_secret?: string;       // Webhook 签名密钥
  settings: RepositorySettings;
  created_by?: string;           // 创建者 User.id
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}

interface RepositorySettings {
  notifyOnSuccess: boolean;      // 成功时通知（JSONB 内部结构保持 camelCase）
  notifyOnFailure: boolean;      // 失败时通知
}
```

> **注意**：CI/CD 流水线（Action）完全由 Gitea Actions 驱动，Teax 不在本地数据库维护 Action 定义。Teax 通过 Gitea API 代理展示 Workflow Runs。

---

### Agent 相关

#### Agent（Agent 定义）

Agent 由 **`@opencode-ai/sdk`** 驱动执行，通过配置 systemPrompt + LLM 供应商定义一个代码智能体。

```typescript
interface Agent {
  id: string;
  repository_id: string;
  name: string;
  description?: string;

  // open-code 核心配置
  system_prompt: string;          // Agent 任务定义（系统提示词）
  llm_config: AgentLlmConfig;     // LLM 供应商配置
  tool_config: AgentToolConfig;   // 工具权限配置

  // 触发配置
  trigger_config?: {
    onPush?: boolean;             // push 时自动触发（JSONB 内部结构）
    branches?: string[];
    promptTemplate?: string;
  };

  // 工作区配置
  workspace_config?: {
    branch?: string;
    createPR?: boolean;
    prTitleTemplate?: string;     // PR 标题模板，如 "chore: {{agentName}} auto fix"
  };

  // 资源限制
  resources?: {
    timeout?: number;             // 最大运行时间（秒），默认 3600
    maxSteps?: number;            // open-code 最大步骤数，防止无限循环，默认 50
  };

  enabled: boolean;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
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
  repository_id: string;
  name: string;                   // 密钥名称，如 "OPENAI_API_KEY"
  encrypted_value: string;        // AES-256-GCM 加密后的值
  created_by: string;             // 创建者 User.id
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### AgentSession（Agent 会话）

```typescript
interface AgentSession {
  id: string;
  repository_id: string;
  agent_id: string;               // Agent 定义 ID
  agent_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  triggered_by: string;           // 触发者 User.id
  trigger_type: 'manual' | 'webhook' | 'feishu';
  user_prompt?: string;           // 实际发送给 open-code 的 user prompt（模板渲染后）
  started_at?: Date;
  ended_at?: Date;
  duration?: number;

  // open-code 运行追踪
  oc_session_id?: string;         // open-code 内部 session ID
  steps?: number;                 // 已执行步骤数
  tokens_used?: number;           // 累计消耗 token 数
  cost?: number;                  // 推算费用（USD）

  // 产物
  pr_url?: string;                // 若 workspace_config.createPR=true，记录创建的 PR 链接
  log_url?: string;               // 完整日志 S3 URL（完成后归档）
  metadata: Record<string, unknown>;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
  // 实时日志通过 session_logs 表流式写入，不内联在主实体
}
```

---

### Pages 与小程序

#### Page（静态页面）

```typescript
interface Page {
  id: string;
  repository_id: string;
  name: string;                  // 页面名称
  domain?: string;               // 自定义域名
  subdomain: string;             // 子域名
  branch: string;                // 部署分支
  build_command?: string;        // 构建命令
  output_dir: string;            // 输出目录
  status: 'active' | 'building' | 'failed' | 'disabled';
  last_deployed_at?: Date;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### MiniAppCode（小程序开发码）

```typescript
interface MiniAppCode {
  id: string;
  repository_id: string;
  type: 'preview' | 'experience' | 'release';
  version: string;
  qrcode_url: string;            // 二维码图片 URL
  expired_at?: Date;             // 过期时间
  created_by: string;            // 创建者 User.id
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

---

### 飞书相关

#### FeishuNotification（飞书通知记录）

```typescript
interface FeishuNotification {
  id: string;
  type: 'publish' | 'approval' | 'agent' | 'system';
  target_type: 'user' | 'group';
  target_id: string;             // 飞书 open_id 或 chat_id
  message_id?: string;           // 飞书消息 ID
  content: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: Date;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### FeishuApproval（飞书审批）

```typescript
interface FeishuApproval {
  id: string;
  repository_id: string;         // 关联仓库
  approval_code: string;         // 飞书审批定义 code
  instance_code: string;         // 飞书审批实例 code
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_open_id?: string;
  approved_at?: Date;
  comment?: string;
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### AuditLog（操作审计）

```typescript
interface AuditLog {
  id: number;                    // bigserial
  user_id: string;               // 操作者
  organization_id?: string;      // 所属组织
  action: string;                // 操作类型，如 repo.create / agent.stop / permission.update
  resource_type?: string;        // repository | agent_session | permission_group
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  detail: Record<string, unknown>; // 操作内容快照
  row_creator?: string;
  created_at: Date;
  updated_at: Date;
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
| **OAuth Token 过期** | Gitea access_token 过期后需重新授权；飞书 token 存储到 `user_feishu.access_token`，访问前检查 `token_expires_at` |
| **飞书机器人越权** | 收到机器人指令时，通过 `feishu_open_id` 查找关联 Teax 用户，校验权限组后才执行操作 |
| **敏感信息过滤** | API 响应不返回密钥、token 字段；日志中过滤 env 中标记为 `SECRET_*` 的字段 |
| **请求限流** | Webhook 接收端点和 API 路由应配置限流（如 10 req/s），利用 Redis 实现滑动窗口计数器 |
| **Session 服务端校验** | Cookie sealed session 内嵌 `session_id`，每次 API 请求通过 `session-validate` middleware 检查 Redis（`session:{user_id}:{session_id}`）是否仍有效，支持服务端主动踢人 |

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
│  │  │ Auth     │ │ Sync     │ │ Feishu   │ │ Agent    │        │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │   │
│  │  │ Gitea    │ │ Resolve  │ │ Page     │                    │   │
│  │  │ Utils    │ │   API    │ │ Service  │                    │   │
│  │  └──────────┘ └──────────┘ └──────────┘                    │   │
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
| **状态管理** | Pinia | 2.x | Vue 官方状态管理（⏳ 当前使用 Nuxt 内置 `useUserSession` + `useFetch`） |
| **请求** | ofetch | - | Nuxt 内置 HTTP 客户端（`$fetch` / `useFetch`） |
| **WebSocket** | Socket.io-client | 4.x | 实时通信（⏳ 尚未实现，已延期） |
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
│   ├── AppLogo.vue            # 应用 Logo
│   ├── TemplateMenu.vue       # 模板菜单
│   ├── project/               # 项目相关组件
│   │   ├── ProjectActionsTab.vue    # ✅ Actions Tab（workflow 信息卡片 + runs 列表 + 触发弹窗）
│   │   ├── ProjectActionsSkeleton.vue # Actions Tab 骨架屏
│   │   ├── ProjectSettingsTab.vue   # ✅ 设置 Tab（通知 + 删除）
│   │   ├── ProjectReadmeTab.vue     # ✅ README Tab（TEAX.md 优先，回退 README.md）
│   │   └── ProjectTabSkeleton.vue   # 通用 Tab 骨架屏
│   └── admin/                 # 管理面板组件
│       ├── OrgTeamPanel.vue   # 团队管理（成员、角色、权限组分配）
│       └── OrgPermissionPanel.vue # 权限组管理（CRUD、权限选择、仓库范围）
├── composables/               # 组合式函数
│   └── useOrgRole.ts          # 获取当前用户在组织中的角色
├── layouts/                   # 布局
│   ├── default.vue            # 默认布局
│   └── admin.vue              # Admin 侧边栏布局
├── middleware/                # 中间件
│   ├── auth.global.ts         # 全局认证守卫（重定向未登录用户到 /auth/login）
│   └── admin.ts               # Admin 路由守卫（非管理员重定向首页）
├── pages/                     # 页面（Gitea 风格路由）
│   ├── index.vue              # / — 首页（组织列表 + 统计卡片 + 最近提交）
│   ├── auth/                  # /auth/*
│   │   ├── login.vue
│   │   └── callback/
│   │       ├── gitea.vue
│   │       └── feishu.vue
│   ├── [orgName]/             # /:orgName — 组织项目列表
│   │   ├── index.vue
│   │   ├── [projectName].vue  # /:orgName/:projectName — 项目布局页（Tab 导航）
│   │   └── [projectName]/     # 项目子路由
│   │       ├── index.vue      # README / 概览
│   │       ├── actions.vue    # Actions（Gitea Workflow Runs）
│   │       ├── agents.vue     # Agents（Teax 扩展）
│   │       ├── pages.vue      # Pages（Teax 扩展）
│   │       └── settings.vue   # 项目设置
│   ├── org/                   # /org/:orgName（组织管理，/org/ 前缀避免路由冲突）
│   │   └── [orgName]/
│   │       ├── settings.vue   # 组织设置（团队 + 权限组管理）
│   │       └── new.vue        # 创建项目（搜索 Gitea 仓库）
│   └── -/                     # /-/（= Gitea 系统前缀）
│       └── admin/             # 系统管理
│           ├── index.vue      # 重定向到 /users
│           ├── users.vue      # 用户管理
│           ├── orgs/
│           │   ├── index.vue  # 组织列表
│           │   └── [orgId].vue # 组织详情（团队 + 权限组）
│           ├── audit-logs.vue # 审计日志
│           └── settings.vue   # 系统设置
└── types/                     # 类型定义
    └── admin.ts               # Admin 面板相关类型（TeamItem, MemberItem, PermissionGroup 等）
```

> **未实现**：`plugins/`（Socket.io 客户端）、`stores/`（Pinia stores）、`utils/` 目录尚未创建，当前使用 Nuxt 内置的 `useFetch`/`$fetch` 和 `useUserSession` 管理数据和状态。

---

### 后端技术栈

| 类别 | 技术 | 版本 | 说明 |
| ---- | ---- | ---- | ---- |
| **运行时** | Nuxt Server (Nitro) | - | 基于 H3 的服务端 |
| **ORM** | Drizzle ORM | 0.45+ | TypeScript ORM，轻量高性能 |
| **Schema 验证** | Zod + drizzle-zod | 3.x / 0.8.x | 从 Drizzle Schema 自动生成 Zod 验证 schema，用于 API 请求/响应 DTO |
| **数据库** | PostgreSQL | 16.x | 主数据库 |
| **缓存** | Redis | 7.x | Session、缓存、消息队列 |
| **对象存储** | S3 兼容存储 | - | 火山引擎 TOS，日志、构建产物存储 |
| **任务队列** | BullMQ | 5.x | 基于 Redis 的任务队列（⏳ 尚未实现，已延期） |
| **WebSocket** | Socket.io | 4.x | 实时日志推送（⏳ 尚未实现，已延期） |
| **认证** | nuxt-auth-utils | - | OAuth2 认证 |

#### 后端目录结构

API 路由使用 UUID-based 路径（`orgs/[orgId]/projects/[projectId]`），前端通过 resolve API 桥接 name → UUID：

```text
server/
├── api/                       # API 路由
│   ├── auth/                  # /api/auth/*
│   │   ├── gitea.get.ts           # Gitea OAuth 重定向
│   │   ├── feishu.get.ts          # 飞书 OAuth 重定向
│   │   ├── session.get.ts         # 获取当前 session
│   │   ├── logout.post.ts         # 登出（清除 Redis session）
│   │   └── callback/
│   │       ├── gitea.get.ts       # Gitea OAuth 回调
│   │       └── feishu.get.ts      # 飞书 OAuth 回调
│   ├── resolve/               # 名称 → UUID 解析（前端路由桥接）
│   │   └── [orgName]/
│   │       ├── index.get.ts       # 通过组织名查找组织
│   │       └── [projectName].get.ts # 通过 fullName 查找项目
│   ├── orgs/                  # /api/orgs/{orgId}/*（UUID-based）
│   │   ├── index.get.ts           # 当前用户的组织列表
│   │   └── [orgId]/
│   │       ├── repos.get.ts       # 搜索 Gitea 仓库
│   │       ├── role.get.ts        # 当前用户在组织的角色
│   │       ├── my-permissions.get.ts # 当前用户在组织的权限列表
│   │       ├── sync.post.ts       # 同步组织（requireOrgOwnerOrAdmin）
│   │       ├── teams/
│   │       │   ├── index.get.ts   # 团队列表
│   │       │   └── [teamId]/
│   │       │       ├── members.get.ts # 团队成员列表
│   │       │       └── assigned-permissions/
│   │       │           ├── index.get.ts   # 已分配权限组列表
│   │       │           ├── index.post.ts  # 分配权限组
│   │       │           └── [assignmentId].delete.ts # 移除权限组
│   │       ├── permissions/       # 权限组管理
│   │       │   ├── index.get.ts
│   │       │   ├── index.post.ts  # requireOrgOwnerOrAdmin
│   │       │   ├── [groupId].put.ts
│   │       │   └── [groupId].delete.ts
│   │       └── projects/          # 项目管理
│   │           ├── index.get.ts   # 项目列表
│   │           ├── index.post.ts  # 创建项目（+ 注册 Webhook）
│   │           └── [projectId]/
│   │               ├── index.get.ts      # 项目详情
│   │               ├── index.delete.ts   # 删除项目（+ 清理 Webhook）
│   │               ├── settings.patch.ts # 更新项目设置
│   │               ├── branches.get.ts   # 分支列表
│   │               ├── readme.get.ts     # README 内容
│   │               ├── actions.get.ts    # Workflow Runs 列表
│   │               ├── actions.post.ts   # 触发 Workflow
│   │               └── workflows.get.ts  # Workflow 定义列表
│   ├── permissions/           # 全局权限定义
│   │   └── definitions.get.ts     # 权限 key 定义列表
│   ├── stats/                 # 统计 API
│   │   ├── today-publishes.get.ts # 今日构建数量
│   │   ├── repo-count.get.ts      # 仓库总数
│   │   └── recent-commits.get.ts  # 最近提交
│   ├── admin/                 # /api/admin/*（UUID-based）
│   │   ├── users/
│   │   │   ├── index.get.ts       # 用户列表
│   │   │   └── [userId]/
│   │   │       └── toggle-admin.post.ts # 切换管理员身份
│   │   ├── orgs/
│   │   │   ├── index.get.ts       # 组织列表（含统计）
│   │   │   └── [orgId]/
│   │   │       ├── index.get.ts   # 组织详情
│   │   │       ├── sync.post.ts   # 同步组织
│   │   │       └── teams/
│   │   │           ├── [teamId]/
│   │   │           │   ├── members.get.ts    # 成员列表
│   │   │           │   ├── members.post.ts   # 添加成员
│   │   │           │   └── members/
│   │   │           │       └── [memberId].patch.ts   # 更新角色
│   │   │           │       └── [memberId].delete.ts  # 移除成员
│   │   │           └── index.get.ts  # 团队列表（注：实际路径为 teams.get.ts）
│   │   └── audit-logs.get.ts      # 审计日志（分页 + 关联用户/组织）
│   └── webhooks/
│       └── gitea.post.ts          # Gitea Webhook 接收（HMAC-SHA256）
├── middleware/                # 服务端中间件
│   └── session-validate.ts    # Redis session 有效性校验
├── services/                  # 业务服务
│   ├── auth.service.ts        # upsertUser（首次登录自动管理员）
│   ├── sync.service.ts        # syncUserOrgsAndTeams
│   └── feishu.service.ts      # 飞书用户查找（by feishu_open_id）+ 绑定
├── shared/                    # 前后端共享代码
│   ├── dto/                   # DTO（Data Transfer Object）— 从 Drizzle Schema 自动生成
│   │   ├── user.dto.ts        # users + user_feishu 的 insert/select/update schema
│   │   ├── organization.dto.ts # organizations + teams + team_members
│   │   ├── repository.dto.ts  # repositories + 自定义 body schema（createProjectBody 等）
│   │   ├── permission.dto.ts  # permission_groups + team_permissions + CRUD body schema
│   │   ├── audit.dto.ts       # audit_logs
│   │   ├── common.dto.ts      # 通用分页参数、addTeamMember body 等
│   │   └── index.ts           # 统一导出
│   └── permissions.ts         # 权限 key 和分组定义
├── db/                        # 数据库
│   ├── schema/                # Drizzle Schema（snake_case 字段名）
│   │   ├── base.ts            # baseColumns()：row_creator, created_at, updated_at
│   │   ├── user.ts            # users + user_feishu
│   │   ├── organization.ts    # organizations + teams + team_members
│   │   ├── permission.ts      # permission_groups + team_permissions
│   │   ├── repository.ts      # repositories
│   │   ├── audit.ts           # audit_logs
│   │   └── index.ts           # 统一导出
│   └── index.ts               # useDB() 单例
├── types/
│   └── auth.d.ts              # #auth-utils 类型扩展
└── utils/                     # 工具函数
    ├── gitea.ts               # GiteaService（Gitea API v1 封装 + token 自动刷新）
    ├── feishu.ts              # 飞书 API 封装（OAuth token 交换 + 用户信息）
    ├── redis.ts               # useRedis() 单例
    ├── session.ts             # Redis session 追踪（register/validate/remove）
    ├── auth.ts                # requireAuth + requireAdmin 中间件
    ├── org-access.ts          # requireOrgAccess（组织成员验证，管理员可跳过）
    ├── org-owner.ts           # requireOrgOwnerOrAdmin（组织 Owner/Admin 验证）
    ├── team-owner.ts          # requireTeamOwner（团队 Owner 验证）
    ├── permission.ts          # requirePermission（权限组验证）
    ├── webhook-verify.ts      # Webhook HMAC-SHA256 签名验证
    └── audit.ts               # writeAuditLog 辅助函数
```

> **路径别名约定**：server 端代码统一使用 Nuxt 内置别名 `~~/server/` 替代相对路径，避免多层 `../../` 嵌套。例如：
>
> ```typescript
> // ✅ 使用别名
> import { useDB, schema } from "~~/server/db";
> import { requireAdmin } from "~~/server/utils/auth";
> import { createProjectBodySchema } from "~~/server/shared/dto";
>
> // ❌ 避免相对路径
> import { useDB, schema } from "../../../../../../../db";
> ```
>
> - `~~` — Nuxt 内置别名，指向项目根目录（零配置）
> - `~~/server/db` — 数据库
> - `~~/server/utils/*` — 工具函数
> - `~~/server/shared/dto` — DTO schema
> - `~~/server/shared/permissions` — 权限定义
> - `~~/server/services/*` — 业务服务

> **BullMQ 失败处理**（⏳ 尚未实现）：所有任务需要配置 `attempts`（建议 3 次）和 `backoff`（指数退避）。失败超次数后进入死信队列（`dead`），并更新对应任务状态为 `failed`。最终失败部署应触发飞书告警通知。

---

### 数据库设计

> **字段命名约定**：所有数据库列名、Drizzle ORM Schema 字段名、API JSON key 统一使用 `snake_case`。每张表通过 `baseColumns()` 自动包含 `row_creator`、`created_at`、`updated_at` 三个公共字段。

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
  row_creator UUID,                          -- 公共字段：记录创建者
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
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 组织表
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gitea_org_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  synced_at TIMESTAMPTZ,
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 团队表
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gitea_team_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  synced_at TIMESTAMPTZ,
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, gitea_team_id)
);

-- 权限组表
CREATE TABLE permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL DEFAULT 'custom',  -- default | custom
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',              -- ["repo:view", "actions:view", ...]
  repository_ids JSONB,                        -- null=全部仓库, ["id1","id2"]=指定仓库
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 仓库表
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gitea_repo_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  default_branch VARCHAR(255) DEFAULT 'main',
  clone_url TEXT NOT NULL,
  webhook_id INTEGER,
  webhook_secret VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
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
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 团队权限分配表
CREATE TABLE team_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  permission_group_id UUID REFERENCES permission_groups(id) ON DELETE CASCADE,
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, permission_group_id)
);

-- Agent 定义表（open-code 驱动）
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
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
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,         -- 如 "OPENAI_API_KEY"
  encrypted_value TEXT NOT NULL,      -- AES-256-GCM 加密后的值
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- Agent Session 表
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
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
  action VARCHAR(100) NOT NULL,       -- 如 repo.create, agent.stop, permission.update
  resource_type VARCHAR(50),          -- repository | agent_session | permission_group
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  detail JSONB DEFAULT '{}',
  row_creator UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_repositories_org ON repositories(organization_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_agent_sessions_repo ON agent_sessions(repository_id);
CREATE INDEX idx_session_logs_session ON session_logs(session_id);
CREATE INDEX idx_agent_secrets_repo ON agent_secrets(repository_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

---

### 第三方 API 集成

> Teax 后端通过 Gitea API v1 访问 Gitea 服务。Teax 自身 API 使用 UUID-based 路径，前端通过 resolve API 桥接 name → UUID（详见「设计规范 > 后端 API 规范」）。

#### Gitea API

文档地址：`https://{your-gitea}/-/api/swagger`

Teax 调用的 Gitea API 列表：

| Gitea API | 用途 | Teax 调用场景 |
| --------- | ---- | ------------- |
| `GET /api/v1/user` | 当前用户信息 | OAuth 登录后获取用户资料 |
| `GET /api/v1/user/orgs` | 用户所属组织 | 首页组织列表、组织同步 |
| `GET /api/v1/orgs/{orgname}` | 组织详情 | 组织信息展示 |
| `GET /api/v1/orgs/{orgname}/teams` | 组织团队列表 | 团队同步 |
| `GET /api/v1/teams/{id}/members` | 团队成员列表 | 成员同步 |
| `GET /api/v1/repos/search` | 搜索仓库 | 创建项目时搜索可用仓库 |
| `GET /api/v1/repos/{owner}/{repo}` | 仓库详情 | 项目详情展示 |
| `GET /api/v1/repos/{owner}/{repo}/branches` | 分支列表 | 分支选择器 |
| `GET /api/v1/repos/{owner}/{repo}/contents/{path}` | 文件内容 | 读取 workflow YAML |
| `POST /api/v1/repos/{owner}/{repo}/hooks` | 创建 Webhook | 项目创建时注册 |
| `DELETE /api/v1/repos/{owner}/{repo}/hooks/{id}` | 删除 Webhook | 项目删除时清理 |
| `GET /api/v1/repos/{owner}/{repo}/commits` | 提交记录 | 提交历史展示 |
| `GET /api/v1/repos/{owner}/{repo}/actions/runs` | Workflow Runs | Actions Tab |
| `GET /api/v1/repos/{owner}/{repo}/actions/workflows` | Workflow 定义列表 | Workflow 筛选 |
| `POST /api/v1/repos/{owner}/{repo}/actions/workflows/{id}/dispatches` | 触发 Workflow | 手动 dispatch |
| `GET /api/v1/admin/users` | 用户列表（管理员） | 后台用户管理 |
| `GET /api/v1/admin/orgs` | 组织列表（管理员） | 后台组织管理 |

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

> 详见「设计规范 > 后端 API 规范」。以下为 TypeScript 接口定义。

#### 命名规范

所有 API 请求/响应的 JSON key 统一使用 **snake_case**，与 PostgreSQL 列名和 Gitea/GitHub API 风格保持一致：

```json
{
  "id": "uuid",
  "gitea_username": "admin",
  "is_admin": true,
  "created_at": "2026-01-15T10:30:00Z",
  "organization_id": "uuid",
  "repository_ids": ["id1", "id2"]
}
```

> **规范**：TypeScript schema 字段名 = PostgreSQL 列名 = API JSON key，全部 `snake_case`。JSONB 内部结构（如 `settings`）不受此约束。

#### DTO 验证（drizzle-zod）

API 请求/响应的类型定义和运行时验证采用 **DTO（Data Transfer Object）** 模式，通过 `drizzle-zod` 从 Drizzle Schema 自动生成 Zod 验证 schema：

```typescript
// server/shared/dto/repository.dto.ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { repositories } from "../../db/schema/repository";
import { z } from "zod";

// 自动从 Drizzle schema 生成
export const insertRepositorySchema = createInsertSchema(repositories);
export const selectRepositorySchema = createSelectSchema(repositories);

// 排除敏感字段
export const repositoryResponseSchema = selectRepositorySchema.omit({
  webhook_secret: true,
});

// 自定义 request body schema（非直接映射 insert 的）
export const createProjectBodySchema = z.object({
  repo_full_name: z.string().min(1).includes("/"),
});

// 推断出的 TS 类型，前后端共享
export type RepositoryResponse = z.infer<typeof repositoryResponseSchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
```

**使用方式**（所有 API handler 已完成迁移）：

```typescript
// ✅ 使用 readValidatedBody + DTO schema（Zod 运行时验证 + 自动类型推断）
import { createProjectBodySchema } from "~~/server/shared/dto";
const { repo_full_name } = await readValidatedBody(event, createProjectBodySchema.parse);
// 验证失败时自动抛出 400 错误，无需手动 if 检查
```

DTO 文件位于 `server/shared/dto/`，前端可通过 `import type` 直接引用推断出的类型。

**已定义的 request body schema 一览**：

| Schema | 文件 | 用途 |
| ------ | ---- | ---- |
| `createProjectBodySchema` | repository.dto.ts | 创建项目（`repo_full_name`） |
| `triggerWorkflowBodySchema` | repository.dto.ts | 触发 Workflow（`workflow_id`, `ref`, `inputs?`） |
| `updateRepoSettingsBodySchema` | repository.dto.ts | 更新仓库设置（`notifyOnSuccess?`, `notifyOnFailure?`） |
| `createPermissionGroupBodySchema` | permission.dto.ts | 创建权限组 |
| `updatePermissionGroupBodySchema` | permission.dto.ts | 更新权限组 |
| `assignPermissionBodySchema` | permission.dto.ts | 分配权限组到团队（`permission_group_id`） |
| `addTeamMemberBodySchema` | common.dto.ts | 添加团队成员（`user_id`, `role`） |
| `updateMemberRoleBodySchema` | common.dto.ts | 更新成员角色（`role`） |
| `paginationQuerySchema` | common.dto.ts | 通用分页查询参数（`page`, `limit`） |

#### 分页

采用 Gitea API 的 `page` + `limit` 分页参数：

```typescript
// 请求参数（= Gitea ?page=1&limit=20）
interface ListQuery {
  page?: number;     // 页码，默认 1
  limit?: number;    // 每页条数，默认 20，最大 100
  sort?: string;     // 排序字段（= Gitea ?sort=created）
  order?: 'asc' | 'desc'; // 排序方向（= Gitea ?order=desc）
}

// 响应格式（Teax 包装，Gitea 用裸数组 + X-Total-Count header）
interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

#### 错误响应

采用 Gitea 错误格式：

```typescript
// Gitea 风格：{ message: "Not Found", url: "swagger_url" }
interface ApiError {
  message: string;   // 人类可读错误信息
  url?: string;      // API 文档链接（可选）
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

# Gitea Service Token（系统级 PAT，用于无用户上下文的 API 调用）
SERVICE_TOKEN=xxx                  # 在 Gitea 管理员账号手动创建 PAT，配到此环境变量

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
2. **Phase 2（Week 3-4）✅ 已完成**：后台管理系统（用户/组织/团队/成员管理）、项目管理、Gitea Webhook（含 HMAC 签名验证）、CI/CD 改为 Gitea Actions 原生驱动（移除 PublishTask）、基础权限中间件
3. **Phase 3（Week 5-6）**：Agent 定义（open-code 集成）、密钥管理、Session 管理（隔离容器执行）、Pages 静态托管
4. **Phase 4（Week 7-8）**：飞书消息通知、机器人指令（含越权校验）、审批流程
5. **Phase 5（Week 9-10）✅ 部分完成**：权限组完整 UI ✅、审计日志 ✅、DTO 验证迁移 ✅、路由重构为 Gitea 风格 ✅、小程序码管理（待定）、生产环境部署上线（待定）
