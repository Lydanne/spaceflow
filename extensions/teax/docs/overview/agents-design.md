# Agents 系统设计（当前实现）

> 更新时间：2026-03-29。本文仅描述已落地实现，避免把规划能力与现状混写。

## 1. 目标

Agents 当前版本要解决两个问题：

1. 在仓库内提供可隔离、可重复的 AI 会话执行目录
2. 让多人可以围绕同一会话协作（可见性、参与者、消息与事件）

设计原则：

- 每仓库一个 Runtime 容器，简化资源边界
- 每会话一个独立目录，保证任务互不污染
- 会话操作全量可审计（事件流）
- 权限由组织/仓库权限体系统一收口

## 2. 现状边界

已实现：

- Repo Runtime（Docker provider）
- Session 生命周期（create/prepare/run/stop/retry/delete）
- 参与者管理（invite/update/join/leave）
- 会话消息与消息置顶
- 会话事件分页查询（`after_seq` 增量拉取）
- 会话级 Opencode 进程控制（start/stop/restart）

未实现：

- System Runtime / 跨仓库系统会话
- Agent 自动执行与 `agent_reply` 自动产出
- 事件 SSE 推送
- OpenCode 独立会话 API（`/opencode/sessions/*`）与自动执行闭环

## 3. 架构总览

```text
UI (/owner/repo/agents)
  ↕ HTTP
Agents API (/api/repos/{owner}/{repo}/agents/*)
  ↕
AgentSessionService + AgentRuntimeService
  ↕
PostgreSQL（runtime/session/worktree/participant/message/event）
  ↕
Docker（每仓库一个容器）
  ↕
Host FS（${AGENT_RUNTIME_ROOT}/sessions/{sessionId}）
```

## 4. 领域模型

### 4.1 Runtime（`agent_runtimes`）

- 仓库级唯一 runtime（`repository_id` 唯一）
- 当前 provider 固定 `docker`
- `runtime_key` 用于标识容器名
- `metadata.docker` 记录镜像、Dockerfile 来源、挂载目录

### 4.2 Session（`agent_sessions`）

- 会话主体，保存提示词、分支、可见性、状态
- `runtime_id` 关联运行时
- `auto_commit/auto_pr/opencode_session_id` 字段已预留，当前未驱动自动执行流程

### 4.3 Session Worktree（`agent_session_worktrees`）

- 每会话唯一一条 worktree 记录
- 状态：`preparing/active/failed/removed`
- 记录实际目录路径、基线分支、工作分支、最后错误

### 4.4 参与者（`agent_session_participants`）

- 角色：`owner/collaborator/viewer`
- `can_chat` 控制是否允许发言
- private 会话通过该表控制访问

### 4.5 消息（`agent_session_messages`）

- 会话内按 `seq` 单调递增
- 当前 API 主要写入 `message_type=user_prompt`
- 支持 `pinned/pinned_by/pinned_at`

### 4.6 事件（`agent_session_events`）

- 会话内按 `seq` 单调递增
- 记录关键动作：创建、prepare、参与者变更、消息、停止、重试等
- 支持分页 + `after_seq` 增量读取

## 5. Runtime 设计细节

### 5.1 容器命名与隔离

- 容器名：`teax-agent-repo-{repoId8}`
- 一个仓库一个容器，避免跨仓库上下文泄漏

### 5.2 两段构建

1. 构建基础镜像到固定 tag：`teax-agent-runtime:base`
2. 构建仓库运行镜像（repo Dockerfile 首个 `FROM` 改写到固定基础镜像）

repo Dockerfile 来源优先级：

1. `${AGENT_RUNTIME_ROOT}/.teax/projects/{owner}/{repo}/Dockerfile`
2. `${AGENT_RUNTIME_ROOT}/.teax/globals/Dockerfile`
3. 系统生成最小 Dockerfile

### 5.3 挂载

- `${AGENT_RUNTIME_ROOT}/sessions` -> `${AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT}/sessions`
- `${AGENT_RUNTIME_ROOT}/.teax` -> `${AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT}/.teax`

## 6. Session 生命周期

### 6.1 状态机（当前实现）

```text
created -> preparing -> running
             |           |
             v           v
           failed      stopped

failed/stopped --retry--> created
```

补充：`completed` 目前只在数据模型中保留，尚无自动流转路径。

### 6.2 创建会话

- 创建 session + owner 参与者 + 首条消息
- 写事件：`session_created` -> `session_preparing`
- 调 `prepareRepoSessionWorktree`
- 成功写 `worktree_prepared`，失败写 `worktree_prepare_failed`

### 6.3 停止 / 重试 / 删除

- 停止：标记 `stopped` + 尝试清理目录 + 写 `session_stopped`
- 重试：仅允许 `failed/stopped`，先清理再 prepare
- 删除：先尝试清理，再删除 session

## 7. 权限模型（API 侧）

- `agent:read`：runtime 摘要、会话详情、消息、事件、参与者
- `agent:create`：创建会话
- `agent:chat`：发消息、join/leave
- `agent:write`：stop/retry/delete/pin/opencode control
- `agent:manage`：参与者管理、可见性变更
- `agent:start`：runtime 启动
- `agent:stop`：runtime 停止

会话内二次约束：

- private 会话非受邀成员不可读
- owner 可读写全量
- viewer 不可发言、不可 pin
- owner 不能 leave

## 8. API 设计（已实现）

基线路径：`/api/repos/{owner}/{repo}/agents`

Runtime：

- `GET /runtime`
- `POST /runtime/start`
- `POST /runtime/stop`

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
- `POST /sessions/{sessionId}/prompt`
- `POST /sessions/{sessionId}/messages/{messageId}/pin`
- `GET /sessions/{sessionId}/events`
- `POST /sessions/{sessionId}/opencode/control`

## 9. 前端对应

- 页面：`/:owner/:repo/agents`
- Runtime 面板：状态、活跃会话数、活跃 worktree 数、启动/停止
- Session 面板：会话列表、详情、参与者、消息、事件
- 刷新策略：轮询拉取（非 SSE）

## 10. 后续扩展建议

建议将后续能力按独立 phase 推进，避免影响当前稳定路径：

1. 增加 Agent 执行引擎与 `agent_reply` 自动产出
2. 增加事件流推送（SSE 或 WebSocket）
3. 引入 System Runtime 与跨仓库编排
4. 启用 `auto_commit/auto_pr` 流程闭环
