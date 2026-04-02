# API 规范文档

> Teax 的前端路由和后端 API **直接采用 Gitea 的规范**。Gitea 未覆盖的功能（Agents、Pages 等）采用 GitHub 的规范。

## 设计原则

设计新功能前必须先查阅：
- **Gitea**：实例 Swagger 文档 `https://{your-gitea}/-/api/swagger`
- **GitHub**：[REST API 文档](https://docs.github.com/en/rest)

## 前端路由规范

采用 Gitea 的 Web UI 路由结构。Gitea 的 URL 设计核心是 **name-based 语义化路径**。

### Gitea 路由规范（参考）

```text
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

### Teax 路由结构

**Teax 直接采用上述结构**，仅在 Gitea 未覆盖的 Teax 扩展功能上沿用相同风格。

```text
Gitea 原有路由（直接采用）：
  /:owner                          — 组织项目列表
  /:owner/:repo                    — 项目首页（README）
  /:owner/:repo/actions            — Actions（Gitea Workflow Runs）
  /:owner/:repo/settings           — 项目设置
  /org/:orgname/settings           — 组织设置（团队 + 权限组管理）
  /-/admin                         — 系统管理面板
  /-/admin/users                   — 用户管理
  /-/admin/orgs                    — 组织管理
  /-/admin/orgs/:orgname           — 组织详情（团队 + 权限组）

Teax 扩展路由（Gitea 无，采用 GitHub 风格）：
  /:owner/:repo/pages              — Pages 静态托管（类似 GitHub Pages 设置风格）
  /org/:orgname/new                — 创建项目（Gitea 用 /repo/create，Teax 按组织维度）
  /:owner/:repo/agents             — Agents 会话工作台（Teax 扩展）

通用路由：
  /                                — 首页/仪表盘
  /auth/login                      — 登录
  /auth/callback/gitea             — Gitea OAuth 回调
  /auth/callback/feishu            — 飞书 OAuth 回调
  /-/admin/audit-logs              — 审计日志
  /-/admin/settings                — 系统设置
```

### 路由冲突处理

Gitea 使用固定前缀避免与 `/:owner/:repo` 动态路由冲突，Teax 完全沿用：

| 前缀 | 用途 | Gitea 原有 |
| ---- | ---- | ---------- |
| `/-/` | 系统级功能（admin、API swagger） | ✅ `/-/admin`、`/-/api/swagger` |
| `/org/` | 组织管理页面 | ✅ `/org/:orgname/settings` |
| `/repo/` | 仓库级全局操作 | ✅ `/repo/create` |
| `/user/` | 用户设置 | ✅ `/user/settings` |
| `/auth/` | 认证流程 | Teax 自定义（Gitea 用 `/user/login`） |
| `/explore/` | 探索页面 | ✅ `/explore/repos`、`/explore/users` |

## 后端 API 规范

### 设计决策（当前实现）

- **当前主路径为 name-based**：组织与仓库 API 直接使用 `{orgName}`、`{owner}/{repo}`。
- `resolve` 接口仍保留，用于前端历史兼容与路由辅助解析。
- 历史文档中的 UUID-based 组织/项目路径已逐步下线，不再作为主规范。

### Gitea API v1 规范（参考）

```text
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

### Teax API 路径（与当前代码对齐）

#### 解析 API（兼容）

```text
GET    /api/resolve/{orgName}                 — 通过组织名查找组织
GET    /api/resolve/{orgName}/{projectName}   — 通过 fullName 查找项目
```

#### 组织 API（name-based）

```text
GET    /api/orgs
GET    /api/orgs/{orgName}/detail
GET    /api/orgs/{orgName}/repos
GET    /api/orgs/{orgName}/role
GET    /api/orgs/{orgName}/my-permissions
POST   /api/orgs/{orgName}/sync
PATCH  /api/orgs/{orgName}/settings
GET    /api/orgs/{orgName}/teams
GET    /api/orgs/{orgName}/teams/{teamName}/members
GET    /api/orgs/{orgName}/teams/{teamName}/assigned-permissions
POST   /api/orgs/{orgName}/teams/{teamName}/assigned-permissions
DELETE /api/orgs/{orgName}/teams/{teamName}/assigned-permissions/{assignmentId}
GET    /api/orgs/{orgName}/permissions
POST   /api/orgs/{orgName}/permissions
PUT    /api/orgs/{orgName}/permissions/{groupId}
DELETE /api/orgs/{orgName}/permissions/{groupId}
GET    /api/orgs/{orgName}/projects
POST   /api/orgs/{orgName}/projects
GET    /api/orgs/{orgName}/presets
GET    /api/orgs/{orgName}/preset-groups
PATCH  /api/orgs/{orgName}/presets/{presetId}
PATCH  /api/orgs/{orgName}/preset-groups/{groupId}
```

#### 仓库 API（name-based）

```text
GET    /api/repos/{owner}/{repo}
DELETE /api/repos/{owner}/{repo}
PATCH  /api/repos/{owner}/{repo}/settings
GET    /api/repos/{owner}/{repo}/branches
GET    /api/repos/{owner}/{repo}/readme
GET    /api/repos/{owner}/{repo}/actions
POST   /api/repos/{owner}/{repo}/actions
GET    /api/repos/{owner}/{repo}/actions/runs/{runId}
POST   /api/repos/{owner}/{repo}/actions/runs/{runId}/rerun
POST   /api/repos/{owner}/{repo}/actions/runs/{runId}/cancel
GET    /api/repos/{owner}/{repo}/actions/runs/{runId}/jobs
GET    /api/repos/{owner}/{repo}/actions/jobs/{jobId}/logs
GET    /api/repos/{owner}/{repo}/workflows
GET    /api/repos/{owner}/{repo}/workflows/{...path}
GET    /api/repos/{owner}/{repo}/approvals
POST   /api/repos/{owner}/{repo}/approvals
GET    /api/repos/{owner}/{repo}/presets
GET    /api/repos/{owner}/{repo}/workflow-presets
POST   /api/repos/{owner}/{repo}/workflow-presets
PATCH  /api/repos/{owner}/{repo}/workflow-presets/{presetId}
DELETE /api/repos/{owner}/{repo}/workflow-presets/{presetId}
```

#### Agents API（仓库级，name-based）

基线路径：`/api/repos/{owner}/{repo}/agents`

```text
# runtime
GET    /api/repos/{owner}/{repo}/agents/runtime
POST   /api/repos/{owner}/{repo}/agents/runtime/start
POST   /api/repos/{owner}/{repo}/agents/runtime/stop
GET    /api/repos/{owner}/{repo}/agents/opencode/agents

# sessions
GET    /api/repos/{owner}/{repo}/agents/sessions
POST   /api/repos/{owner}/{repo}/agents/sessions
GET    /api/repos/{owner}/{repo}/agents/sessions/{sessionId}
DELETE /api/repos/{owner}/{repo}/agents/sessions/{sessionId}
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/stop
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/retry
PATCH  /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/visibility

# 协作
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/join
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/leave
GET    /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/participants
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/participants
PATCH  /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/participants/{userId}

# 消息与事件
GET    /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/messages
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/messages
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/prompt
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/messages/{messageId}/pin
GET    /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/events
POST   /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/opencode/control
GET    /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/opencode/models
```

#### 权限定义 API

```text
GET    /api/permissions/definitions
```

#### 统计 API

```text
GET    /api/stats/repo-count
GET    /api/stats/recent-commits
```

#### 管理员 API（name-based）

```text
GET    /api/admin/users
POST   /api/admin/users/{userId}/toggle-admin
GET    /api/admin/orgs
GET    /api/admin/orgs/{orgName}
POST   /api/admin/orgs/{orgName}/sync
GET    /api/admin/orgs/{orgName}/teams
GET    /api/admin/orgs/{orgName}/teams/{teamName}/members
POST   /api/admin/orgs/{orgName}/teams/{teamName}/members
PATCH  /api/admin/orgs/{orgName}/teams/{teamName}/members/{memberId}
DELETE /api/admin/orgs/{orgName}/teams/{teamName}/members/{memberId}
GET    /api/admin/audit-logs
GET    /api/admin/feishu-status
GET    /api/admin/webhooks
POST   /api/admin/webhooks
PATCH  /api/admin/webhooks/{hookId}
DELETE /api/admin/webhooks/{hookId}
GET    /api/admin/agent-runtime/globals
PATCH  /api/admin/agent-runtime/globals
```

#### 认证 API

```text
GET    /api/auth/gitea
GET    /api/auth/feishu
GET    /api/auth/callback/gitea
GET    /api/auth/callback/feishu
GET    /api/auth/session
POST   /api/auth/logout
POST   /api/auth/feishu-select
```

#### Webhook API

```text
POST   /api/webhooks/gitea
POST   /api/webhooks/feishu
POST   /api/webhooks/feishu-card
```

## 请求与响应规范

### 请求规范

| 规范项 | Gitea 规范 | Teax 实现 |
| ------ | ---------- | --------- |
| **认证** | `Authorization: token {PAT}` 或 `?token=` | 采用 Cookie Session（Web 应用），内部调 Gitea 时用 PAT |
| **路径参数** | name-based（`{owner}/{repo}`、`{orgname}`） | API 内部使用 UUID（`{orgId}`、`{projectId}`），前端通过 `/api/resolve/*` 桥接 name → UUID |
| **分页** | `?page=1&limit=20` | 完全采用 |
| **排序** | `?sort=created&order=desc` | 完全采用 |
| **时间格式** | ISO 8601（`2023-01-15T10:30:00Z`） | 完全采用 |

### 响应格式

#### 单个资源

与 Gitea 一致，直接返回对象：

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

#### 列表资源

Teax 在 Gitea 基础上增加分页包装：

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

> Gitea 列表 API 返回裸数组 + `X-Total-Count` header。Teax 选择 JSON 包装分页信息，对前端更友好。

#### 错误响应

```json
{
  "message": "Not Found",
  "url": "https://teax.example.com/-/api/swagger"
}
```

## Tab 路由设计

每个 Tab 对应独立子路由路径，采用 Gitea 风格的 URL 结构。

### 项目工作台 Tab

```text
/:owner/:repo                    — README / 概览（默认）
/:owner/:repo/actions            — Actions（Gitea Workflow Runs）
/:owner/:repo/agents             — Agents（仓库级 Agent Sessions）
/:owner/:repo/pages              — Pages（静态托管）
/:owner/:repo/settings           — 项目设置
```

### 组织设置 Tab

```text
/org/:orgName/settings/teams       — 团队管理
/org/:orgName/settings/permissions — 权限组管理
/org/:orgName/settings/feishu      — 通知规则
```

### 实现方式

- 父页面（如 `[projectName].vue`）作为布局页提供项目头部和 Tab 导航
- 子路由通过 `<NuxtPage>` 渲染
- Tab 切换使用 `<NuxtLink>` 导航，天然支持刷新保持、链接分享、浏览器前进/后退

## 相关文档

- [架构概览](../overview/index.md) - 系统整体架构和定位
- [权限系统](./permission-system.md) - 权限模型和访问控制
- [数据库设计](./database-design.md) - 完整的数据库 Schema
