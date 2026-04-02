# Agents 当前实现文档

> 更新时间：2026-03-29（基于当前仓库代码）

## 1. 文档范围

本文描述 **已经在代码中实现** 的 Agents 能力，覆盖：

- 仓库级 Runtime（Docker）生命周期
- 会话（Session）创建、重试、停止、删除
- 会话协作（参与者、可见性、消息、事件）
- Worktree（会话目录）准备与清理

不包含（尚未落地）：

- System Agent / 跨仓库编排
- SSE 实时事件流（当前为分页查询）

## 2. 当前架构

```text
用户 / 前端
   ↓
/api/repos/{owner}/{repo}/agents/*
   ↓
Agent Session Service / Agent Runtime Service
   ↓
PostgreSQL（session/runtime/worktree/event，消息主时间线由 OpenCode Server 提供）
   ↓
Docker Runtime（每仓库一个容器）
   ↓
会话目录（${AGENT_RUNTIME_ROOT}/sessions/{sessionId}）
```

关键约束：

- 每个仓库最多一个 runtime 记录（`agent_runtimes.repository_id` 唯一）
- Runtime provider 当前固定为 `docker`
- 每个会话一个独立 worktree 目录
- worktree 实际通过 `git clone + checkout -B` 准备，不使用 git worktree 子命令

## 3. Runtime 实现

### 3.1 启动流程（`POST /agents/runtime/start`）

`ensureRepoRuntime()` 的主要步骤：

1. 读取仓库信息与 Runtime 配置
2. 启动时先将 `{projectRoot}/defaults/.teax/` 中缺失文件补齐到 `${AGENT_RUNTIME_ROOT}/.teax/`（按文件补齐，不覆盖已有）
3. 确保目录存在：
   - `${AGENT_RUNTIME_ROOT}/sessions`
   - `${AGENT_RUNTIME_ROOT}/.teax`
4. 构建基础镜像（固定 tag：`teax-agent-runtime:base`）
5. 使用全局 Dockerfile：`${AGENT_RUNTIME_ROOT}/.teax/globals/Dockerfile`（不存在时自动创建默认值）
6. 容器启动时映射全局 opencode 目录：
   - `${AGENT_RUNTIME_ROOT}/.teax/globals/opencode` -> `/root/.config/opencode`
   - `${AGENT_RUNTIME_ROOT}/.teax/globals/opencode` -> `/home/node/.config/opencode`
7. 启动/复用容器（容器名：`teax-agent-repo-{repoId8}`）
8. 写回 `agent_runtimes`（状态、metadata、docker 信息）

### 3.2 停止流程（`POST /agents/runtime/stop`）

- `force=false`：若存在活跃 worktree，返回 `409`
- `force=true`：先清理活跃 worktree，并将活跃会话状态改为 `stopped`
- docker 容器会被停止并移除

### 3.3 Runtime 摘要（`GET /agents/runtime`）

返回字段包含：

- `runtime_status`：优先按 docker 实时 `inspect` 推断
- `active_session_count`
- `active_worktree_count`
- `root_dir` / `sessions_root_dir` / `mode`

## 4. Session 与 Worktree 实现

### 4.1 创建会话（`POST /agents/sessions`）

`createAgentSession()` 流程：

1. 新建 `agent_sessions`（初始 `status=created`）
2. 创建 owner 参与者
3. 记录事件：`session_created`、`session_preparing`
4. 调用 `prepareRepoSessionWorktree()`
5. 成功后记录事件 `worktree_prepared`；失败则 `worktree_prepare_failed`

### 4.2 Worktree 准备

`prepareRepoSessionWorktree()` 会：

- 自动确保 runtime 可用
- 将会话状态更新为 `preparing`
- 在容器内执行：
  - `git clone --branch {baseBranch}`
  - `git checkout -B {workingBranch} origin/{baseBranch}`
  - `git reset --hard` + `git clean -fd`
- 成功后：
  - `agent_session_worktrees.status=active`
  - `agent_sessions.status=running`
- 失败后：
  - `agent_session_worktrees.status=failed`
  - `agent_sessions.status=failed`

### 4.3 停止 / 重试 / 删除

- 停止：`POST /sessions/{sessionId}/stop`
  - 会话状态改为 `stopped`
  - 尝试清理目录，记录 `session_stopped`
- 重试：`POST /sessions/{sessionId}/retry`
  - 仅 `failed/stopped` 可重试
  - 会话重置到 `created` 后重新 prepare
- 删除：`DELETE /sessions/{sessionId}`
  - 先尝试清理目录，再删会话记录

### 4.4 会话级 Opencode 进程控制

已实现会话目录内的 Opencode 进程控制接口：

- `POST /sessions/{sessionId}/opencode/control`
- body: `{ action: "start" | "stop" | "restart" }`

行为要点：

- 仅 owner/管理员可控制（除 API 权限外，service 层二次校验）
- 依赖 Runtime 容器处于运行状态
- 依赖会话目录存在
- PID 文件与日志文件固定写在会话目录：
  - `.teax-opencode.pid`
  - `.teax-opencode.log`
- 启动命令优先级：
  1. `AGENT_RUNTIME_OPENCODE_START_COMMAND`
  2. `opencode serve`
  3. `opencode server`

### 4.5 消息读写模型（OpenCode Server Source of Truth）

- `POST /sessions/{sessionId}/prompt` / `POST /sessions/{sessionId}/messages`：将用户输入直接转发到 OpenCode Server
- 首次对话时自动创建 OpenCode Session，并回写 `agent_sessions.opencode_session_id`
- `GET /sessions/{sessionId}/messages` 优先从 OpenCode Server 拉取消息
- `agent_session_messages` 仅保留兼容用途（例如 pinned 状态索引），不再作为主对话存储
- 如果 OpenCode 调用失败，请求直接报错，并写入 `opencode_prompt_failed` 事件

### 4.6 会话状态（当前写入路径）

```text
created -> preparing -> running
             |           |
             v           v
           failed      stopped

failed/stopped --retry--> created -> preparing -> running
```

说明：`completed` 字段在模型中保留，但当前服务层没有自动进入 `completed` 的执行逻辑。

## 5. 协作与权限

### 5.1 可见性

- `public`：仓库内有权限用户可见
- `private`：仅 owner、管理员、受邀参与者可见

### 5.2 参与者规则

- owner 不能 `leave`
- public 会话中，首次发言可自动加入参与者
- `viewer` 无法 pin 消息、无法发言

### 5.3 API 权限映射

- `agent:read`：会话/消息/事件/参与者读取、runtime 摘要
- `agent:create`：创建会话
- `agent:chat`：发消息、join/leave
- `agent:write`：stop/retry/delete/pin/opencode control
- `agent:manage`：改可见性、管理参与者
- `agent:start`：启动 runtime
- `agent:stop`：停止 runtime

## 6. API（当前实现）

基线路径：`/api/repos/{owner}/{repo}/agents`

Runtime：

- `GET /runtime`
- `POST /runtime/start`
- `POST /runtime/stop`（body: `{ force?: boolean }`）

Sessions：

- `GET /sessions`
- `POST /sessions`
- `GET /sessions/{sessionId}`
- `DELETE /sessions/{sessionId}`
- `POST /sessions/{sessionId}/stop`
- `POST /sessions/{sessionId}/retry`
- `PATCH /sessions/{sessionId}/visibility`
- `POST /sessions/{sessionId}/join`
- `POST /sessions/{sessionId}/leave`
- `GET /sessions/{sessionId}/participants`
- `POST /sessions/{sessionId}/participants`
- `PATCH /sessions/{sessionId}/participants/{userId}`
- `GET /sessions/{sessionId}/messages`
- `POST /sessions/{sessionId}/messages`
- `POST /sessions/{sessionId}/prompt`（兼容接口，内部直接转发到 OpenCode Server）
- `POST /sessions/{sessionId}/messages/{messageId}/pin`
- `GET /sessions/{sessionId}/events`（分页查询，支持 `after_seq`）
- `POST /sessions/{sessionId}/opencode/control`（会话级进程控制）

## 7. 关键环境变量

| 变量名 | 说明 |
| --- | --- |
| `AGENT_RUNTIME_ROOT` | runtime 根目录（代码默认 `.teax-agent-runtime`） |
| `AGENT_RUNTIME_DOCKER_BIN` | docker 可执行文件 |
| `AGENT_RUNTIME_DOCKER_BASE_DOCKERFILE` | 基础镜像 Dockerfile |
| `AGENT_RUNTIME_DOCKER_BASE_BUILD_CONTEXT` | 基础镜像构建上下文 |
| `AGENT_RUNTIME_DOCKER_BUILD_ON_START` | 启动 runtime 是否强制重建镜像 |
| `AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT` | 容器内挂载根目录（默认 `/runtime`） |
| `AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP` | 停止会话是否保留目录 |
| `AGENT_RUNTIME_OPENCODE_START_COMMAND` | 自定义 Opencode 启动命令（为空则走回退命令） |
| `AGENT_META_REPO_URL` | 元数据仓库地址（当前仅用于读取配置来源与凭据） |
| `AGENT_META_REPO_TOKEN` / `AGENT_BOT_TOKEN` | git 凭据来源（前者优先） |

## 8. 相关代码

- `server/services/agent-runtime.service.ts`
- `server/services/agent-session.service.ts`
- `server/shared/dto/agent-session.dto.ts`
- `server/db/schema/agent-runtime.ts`
- `server/db/schema/agent-session.ts`
- `server/api/repos/[owner]/[repo]/agents/**`
