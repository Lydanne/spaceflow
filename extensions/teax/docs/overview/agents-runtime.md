# Agents Runtime 使用与配置指南

> 更新时间：2026-03-29（与当前代码实现对齐）

## 1. 适用范围

本文覆盖当前已实现的仓库级 Agents Runtime：

- Runtime 查询 / 启动 / 停止
- Session 创建后自动准备会话目录
- Session 停止 / 重试 / 删除时的目录清理逻辑
- `/:owner/:repo/agents` 页面对应的数据字段

不包含：

- System Runtime
- 跨仓库编排
- Agent 自动回复执行链路

## 2. 环境变量

### 2.1 Runtime 相关

| 变量名 | 说明 | 代码默认值 |
| --- | --- | --- |
| `AGENT_RUNTIME_ROOT` | Runtime 根目录 | `.teax-agent-runtime` |
| `AGENT_RUNTIME_DOCKER_BIN` | Docker 命令路径 | `docker` |
| `AGENT_RUNTIME_DOCKER_BASE_DOCKERFILE` | 基础镜像 Dockerfile | `docker/base/node24-vscode-browser.Dockerfile` |
| `AGENT_RUNTIME_DOCKER_BASE_BUILD_CONTEXT` | 基础镜像 build context | `.` |
| `AGENT_RUNTIME_DOCKER_BUILD_ON_START` | 启动 Runtime 时是否重建镜像 | `true` |
| `AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT` | 容器内工作根目录 | `/runtime` |
| `AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP` | 停止会话时是否保留目录 | `false` |
| `AGENT_RUNTIME_OPENCODE_START_COMMAND` | Opencode 启动命令（可选） | `""` |

说明：仓库 `.env.example` 当前给出的 `AGENT_RUNTIME_ROOT` 示例是 `./.runtime`。若你使用该示例值，实际生效将是 `./.runtime`，否则走代码默认值 `.teax-agent-runtime`。

`AGENT_RUNTIME_OPENCODE_START_COMMAND` 为空时，系统会按顺序回退尝试 `opencode serve`、`opencode server`。

### 2.2 元数据仓库与凭据

| 变量名 | 说明 |
| --- | --- |
| `AGENT_META_REPO_URL` | 元数据仓库地址 |
| `AGENT_META_REPO_BRANCH` | 元数据仓库分支（默认 `main`） |
| `AGENT_META_REPO_TOKEN` | 元数据仓库 token（优先） |
| `AGENT_BOT_TOKEN` | 回退 token（当 `AGENT_META_REPO_TOKEN` 未配置） |
| `AGENT_BOT_USERNAME` / `AGENT_BOT_EMAIL` | git 凭据用户名和邮箱 |

Token 优先级：`AGENT_META_REPO_TOKEN > AGENT_BOT_TOKEN > GITEA_SERVICE_TOKEN(回退)`。

## 3. Runtime 行为

### 3.1 每仓库一个容器

- 容器名：`teax-agent-repo-{repoId8}`
- 数据库唯一键：`agent_runtimes.repository_id`

### 3.2 启动时构建与来源规则

启动 Runtime（`POST /runtime/start`）时：

1. 构建基础镜像 `teax-agent-runtime:base`
2. 选择 repo Dockerfile：
   - `${AGENT_RUNTIME_ROOT}/.teax/projects/{owner}/{repo}/Dockerfile`
   - `${AGENT_RUNTIME_ROOT}/.teax/globals/Dockerfile`
   - 系统生成最小 Dockerfile
3. 将首个 `FROM` 改写为 `FROM teax-agent-runtime:base`
4. 构建 repo image 并启动容器

当 `AGENT_RUNTIME_DOCKER_BUILD_ON_START=false` 且容器已存在（停止态）时，优先直接 `docker start`。

### 3.3 挂载

默认挂载关系：

- `${AGENT_RUNTIME_ROOT}/sessions` -> `/runtime/sessions`
- `${AGENT_RUNTIME_ROOT}/.teax` -> `/runtime/.teax`

## 4. Session 与目录生命周期

### 4.1 创建会话

`POST /sessions` 触发后：

1. 创建 `agent_sessions`（`status=created`）
2. 写入 `session_preparing` 事件
3. 自动准备会话目录
4. 成功后 `status=running`，失败则 `status=failed`

### 4.2 目录准备细节

会话目录为 `${AGENT_RUNTIME_ROOT}/sessions/{sessionId}`，准备流程：

- `git clone --branch {baseBranch}`
- `git checkout -B {workingBranch} origin/{baseBranch}`
- `git reset --hard` + `git clean -fd`

对应 worktree 表状态：

- 成功：`active`
- 失败：`failed`

### 4.3 停止/重试/删除

- 停止：`POST /sessions/{sessionId}/stop`
  - 会话设为 `stopped`
  - 尝试清理目录
- 重试：`POST /sessions/{sessionId}/retry`
  - 仅允许 `failed/stopped`
  - 先清理后重建目录
- 删除：`DELETE /sessions/{sessionId}`
  - 先清理目录，再删除会话

`AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP=true` 时，停止不会删目录，worktree 记录保持 `active`。

### 4.4 Opencode 控制目录

- Session 级 Opencode 控制接口统一在容器目录 `/runtime/sessions/{sessionId}` 执行（实际前缀由 `AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT` 决定）。
- 运行标记文件：
  - PID：`/runtime/sessions/{sessionId}/.teax-opencode.pid`
  - 日志：`/runtime/sessions/{sessionId}/.teax-opencode.log`

## 5. 状态流转

### 5.1 Session

```text
created -> preparing -> running
             |           |
             v           v
           failed      stopped

failed/stopped --retry--> created
```

### 5.2 Runtime

- DB 状态会写 `running/stopped/...`
- Runtime 摘要中的 `runtime_status` 对 docker 模式会按 `docker inspect` 实时判定，优先于 DB 陈旧状态

## 6. API（当前实现）

基线路径：`/api/repos/{owner}/{repo}/agents`

### 6.1 Runtime

- `GET /runtime`（`agent:read`）
- `POST /runtime/start`（`agent:start`）
- `POST /runtime/stop`（`agent:stop`，body: `{ force?: boolean }`）

### 6.2 Sessions

- `GET /sessions`（`agent:read`）
- `POST /sessions`（`agent:create`）
- `GET /sessions/{sessionId}`（`agent:read`）
- `DELETE /sessions/{sessionId}`（`agent:write`）
- `POST /sessions/{sessionId}/stop`（`agent:write`）
- `POST /sessions/{sessionId}/retry`（`agent:write`）
- `PATCH /sessions/{sessionId}/visibility`（`agent:manage`）
- `POST /sessions/{sessionId}/opencode/control`（`agent:write`，body: `{ action: "start" | "stop" | "restart" }`）

### 6.3 协作

- `POST /sessions/{sessionId}/join`（`agent:chat`）
- `POST /sessions/{sessionId}/leave`（`agent:chat`）
- `GET /sessions/{sessionId}/participants`（`agent:read`）
- `POST /sessions/{sessionId}/participants`（`agent:manage`）
- `PATCH /sessions/{sessionId}/participants/{userId}`（`agent:manage`）

### 6.4 消息与事件

- `GET /sessions/{sessionId}/messages`（`agent:read`，分页）
- `POST /sessions/{sessionId}/messages`（`agent:chat`）
- `POST /sessions/{sessionId}/prompt`（`agent:chat`，兼容接口）
- `POST /sessions/{sessionId}/messages/{messageId}/pin`（`agent:write`）
- `GET /sessions/{sessionId}/events`（`agent:read`，分页 + `after_seq`）

说明：事件接口当前是普通分页查询，不是 SSE。

## 7. 前端字段对应

`GET /sessions/{sessionId}` 已返回用于页面展示的 runtime/worktree 衍生字段：

- `runtime_status`
- `runtime_provider`
- `runtime_last_heartbeat_at`
- `runtime_key`
- `worktree_status`
- `worktree_path`
- `worktree_last_error`

## 8. 常见问题

### 8.1 停止 Runtime 返回 409

原因：存在活跃 worktree。

处理：调用 `POST /runtime/stop` 并传 `{ "force": true }`。

### 8.2 创建会话失败

优先检查：

1. Docker 可执行文件与 daemon 权限
2. 仓库 clone URL 的访问凭据
3. `AGENT_RUNTIME_ROOT` 目录读写权限
4. `.teax` 配置目录是否可读

### 8.3 停止会话后目录仍在

检查 `AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP` 是否为 `true`。

### 8.4 Opencode 启动失败

优先检查：

1. Runtime 容器是否处于 `running`
2. 该 Session 目录是否存在（`/runtime/sessions/{sessionId}`）
3. 容器内 `opencode` 命令是否可执行
4. 是否需要设置 `AGENT_RUNTIME_OPENCODE_START_COMMAND`

## 9. 关键代码

- `server/services/agent-runtime.service.ts`
- `server/services/agent-session.service.ts`
- `server/shared/dto/agent-session.dto.ts`
- `server/api/repos/[owner]/[repo]/agents/runtime/*`
- `server/api/repos/[owner]/[repo]/agents/sessions/*`
- `app/pages/[owner]/[repo]/agents.vue`
