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
  /:owner/:repo/workspaces         — 项目工作区列表（Teax 扩展）
  /org/:orgname/new                — 创建项目（Gitea 用 /repo/create，Teax 按组织维度）
  /workspace/:name                 — 工作区详情（包含 Web VSCode 和 OpenCode 两种编辑方式）
  /workspace/:name/ide/**          — Web VSCode（反向代理到容器内 openvscode-server）
  /workspace/:name/opencode        — OpenCode AI 编辑界面
  /workspace/:name/**              — 测试环境预览（反向代理到容器内应用端口）

通用路由：
  /                                — 首页/仪表盘
  /auth/login                      — 登录
  /auth/callback/gitea             — Gitea OAuth 回调
  /auth/callback/feishu            — 飞书 OAuth 回调
  /-/admin/audit-logs              — 审计日志
  /-/admin/workspaces              — 全局工作区管理
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
| `/workspace/` | 工作区访问（IDE + 测试环境代理） | Teax 扩展 |

## 后端 API 规范

### 设计决策

前端路由使用 name-based URL（`/{orgName}/{projectName}`），但后端 API 内部使用 UUID 做数据库查询。前端通过 `/api/resolve/*` 将 orgName/projectName 解析为 UUID 后，再调用 UUID-based 的业务 API。

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

### Teax API 路径（实际实现）

#### 名称解析（前端路由 → UUID 桥接）

```text
GET    /api/resolve/{orgName}                 — 通过组织名查找组织
GET    /api/resolve/{orgName}/{projectName}   — 通过 fullName 查找项目
```

#### 组织 API（UUID-based）

```text
GET    /api/orgs                              — 当前用户的组织列表
GET    /api/orgs/{orgId}/repos                — 搜索 Gitea 仓库
GET    /api/orgs/{orgId}/role                 — 当前用户在该组织的角色
GET    /api/orgs/{orgId}/my-permissions       — 当前用户在该组织的权限列表
POST   /api/orgs/{orgId}/sync                 — 同步组织团队
GET    /api/orgs/{orgId}/teams                — 团队列表
GET    /api/orgs/{orgId}/teams/{teamId}/members           — 团队成员列表
GET    /api/orgs/{orgId}/teams/{teamId}/assigned-permissions — 团队已分配的权限组
POST   /api/orgs/{orgId}/teams/{teamId}/assigned-permissions — 为团队分配权限组
DELETE /api/orgs/{orgId}/teams/{teamId}/assigned-permissions/{assignmentId} — 移除团队权限组
GET    /api/orgs/{orgId}/permissions          — 权限组列表
POST   /api/orgs/{orgId}/permissions          — 创建权限组
PUT    /api/orgs/{orgId}/permissions/{groupId}    — 更新权限组
DELETE /api/orgs/{orgId}/permissions/{groupId}    — 删除权限组
```

#### 项目 API（UUID-based）

```text
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
```

#### 工作区 API（项目级）

```text
GET    /api/orgs/{orgId}/projects/{projectId}/workspaces             — 工作区列表
POST   /api/orgs/{orgId}/projects/{projectId}/workspaces             — 创建工作区
GET    /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}         — 工作区详情
DELETE /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}         — 删除工作区
POST   /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}/start   — 启动工作区
POST   /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}/stop    — 停止工作区
```

**工作区可见性和权限：**

| API | 返回内容 | 权限要求 |
| --- | -------- | -------- |
| **GET 列表** | 根据用户身份返回不同工作区 | 项目成员 |
| | - 普通成员：CI 工作区 + 项目工作区 + 自己的个人工作区 | |
| | - 管理员/Owner：所有工作区（包括所有人的个人工作区） | |
| **POST 创建** | 创建时指定 `visibility`: `project` 或 `personal` | 项目成员 |
| **GET 详情** | 根据可见性判断访问权限 | 项目成员 + 个人工作区仅创建者 |
| **DELETE 删除** | CI 工作区不可删除 | 创建者 或 项目管理员 |
| | 个人工作区仅创建者可删除 | |
| **POST 启动/停止** | 同删除权限 | 创建者 或 项目管理员 |

#### OpenCode API（CI 工作区，name-based）

用于 Gitea Actions 调用，直接使用 owner/repo 路径：

```text
POST   /api/repos/{owner}/{repo}/opencode/sessions                   — 创建 OpenCode Session
GET    /api/repos/{owner}/{repo}/opencode/sessions/{sessionId}       — 获取 Session 状态
GET    /api/repos/{owner}/{repo}/opencode/sessions/{sessionId}/logs  — 获取 Session 日志（SSE）
POST   /api/repos/{owner}/{repo}/opencode/sessions/{sessionId}/stop  — 停止 Session
DELETE /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}         — 删除工作区
POST   /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}/start   — 启动已停止的工作区
POST   /api/orgs/{orgId}/projects/{projectId}/workspaces/{workspaceId}/stop    — 停止工作区
```

#### 权限定义 API

```text
GET    /api/permissions/definitions           — 全局权限 key 定义列表
```

#### 统计 API

```text
GET    /api/stats/today-publishes             — 今日构建数量
GET    /api/stats/repo-count                  — 用户可见仓库总数
GET    /api/stats/recent-commits              — 最近提交记录
```

#### 管理员 API（UUID-based）

```text
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
GET    /api/admin/audit-logs                  — 审计日志
GET    /api/admin/workspaces                  — 全局工作区列表
DELETE /api/admin/workspaces/{workspaceId}    — 管理员强制删除工作区
```

#### 认证 API

```text
GET    /api/auth/gitea                        — Gitea OAuth 重定向
GET    /api/auth/feishu                       — 飞书 OAuth 重定向
GET    /api/auth/callback/gitea               — Gitea OAuth 回调
GET    /api/auth/callback/feishu              — 飞书 OAuth 回调
GET    /api/auth/session                      — 获取当前 Session
POST   /api/auth/logout                       — 登出
```

#### Webhook 接收 API

```text
POST   /api/webhooks/gitea                    — Gitea Webhook 接收（HMAC-SHA256 签名验证）
POST   /api/webhooks/feishu                   — 飞书事件回调
POST   /api/webhooks/feishu-card              — 飞书卡片交互回调
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
/:orgName/:projectName           — README / 概览（默认）
/:orgName/:projectName/actions   — Actions（Gitea Workflow Runs）
/:orgName/:projectName/agents    — Agents（AI Agent Sessions）
/:orgName/:projectName/pages     — Pages（静态托管）
/:orgName/:projectName/workspaces — Workspaces（工作区管理）
/:orgName/:projectName/settings  — 项目设置
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

- [架构概览](./overview.md) - 系统整体架构和定位
- [权限系统](./permission-system.md) - 权限模型和访问控制
- [数据库设计](./database-design.md) - 完整的数据库 Schema
