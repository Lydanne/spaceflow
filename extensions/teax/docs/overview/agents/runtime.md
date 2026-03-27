# Agents Runtime 使用与配置指南（P1）

> 适用版本：Phase 1（Repo Runtime + Repo Session + Worktree 生命周期）

## 1. 目标与范围

本文档用于说明当前已落地的 Agents P1 能力如何配置和使用，覆盖：

- 仓库级 Runtime 生命周期（查询 / 启动 / 停止）
- 会话创建后自动准备 worktree（`created -> preparing -> running`）
- 会话停止时回收 worktree、会话重试时重建 worktree
- 会话详情中的 runtime/worktree 状态展示

不包含（Phase 2+）：

- System Runtime 与跨仓库编排
- `/globals` / `/projects/{org}/{name}` 配置仓库自动提交闭环
- VSCode Remote 临时凭据交换

## 2. 快速开始

### 2.1 环境变量配置

在 `.env` 中增加以下配置（默认值见 `.env.example`）：

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `AGENT_RUNTIME_MODE` | `docker` | 运行模式：`docker` / `local` |
| `AGENT_RUNTIME_ROOT` | `.teax-agent-runtime` | Runtime 根目录 |
| `AGENT_RUNTIME_GIT_BIN` | `git` | Git 可执行文件路径 |
| `AGENT_RUNTIME_DOCKER_BIN` | `docker` | Docker 可执行文件路径 |
| `AGENT_RUNTIME_DOCKER_BASE_DOCKERFILE` | `docker/base/node24-vscode-browser.Dockerfile` | 基础镜像 Dockerfile |
| `AGENT_RUNTIME_DOCKER_BASE_BUILD_CONTEXT` | `.` | 基础镜像 build context |
| `AGENT_RUNTIME_DOCKER_BASE_IMAGE` | `teax-agent-runtime:base-local` | 基础镜像 tag（本地构建产物） |
| `AGENT_RUNTIME_DOCKER_BUILD_ON_START` | `true` | 启动仓库 runtime 时是否自动 `docker build` |
| `AGENT_RUNTIME_DOCKERFILE` | 空 | 自定义 Dockerfile 路径（可选） |
| `AGENT_RUNTIME_DOCKER_BUILD_CONTEXT` | 空 | 自定义 docker build context（可选） |
| `AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT` | `/runtime` | 容器内挂载工作根目录 |
| `AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP` | `false` | 停止会话时是否保留 worktree 目录 |

建议：

- 默认使用 `docker`。
- 需要用宿主机 Git 执行时可切到 `local`。

### 2.2 数据库落库

P1 新增了以下表结构：

- `agent_runtimes`
- `agent_session_worktrees`
- `agent_sessions.runtime_id`

请按你们当前 DB 发布流程执行 schema 同步（例如 `drizzle-kit push`）。

### 2.3 启动服务

```bash
pnpm dev
```

## 3. 运行模式说明

### 3.1 local 模式

- 执行真实 git 流程：`clone/fetch/worktree add/worktree remove`
- 需要宿主机具备：
  - 可执行的 `git`
  - 仓库 `clone_url` 对应的访问权限
- 准备失败会直接返回错误并将会话标记为 `failed`

### 3.2 docker 模式

- 默认模式
- 启动 runtime 时会按“两段构建”拉起仓库容器（每仓库一个容器）：
  1. 先基于 `AGENT_RUNTIME_DOCKER_BASE_DOCKERFILE` 构建 `AGENT_RUNTIME_DOCKER_BASE_IMAGE`
  2. 再使用仓库 Dockerfile 构建 repo image（首个 `FROM` 会改写为 `FROM ${TEAX_BASE_IMAGE}`）
  3. 最后基于 repo image 启动 runtime 容器
- 会话 worktree 通过 `docker exec git ...` 在容器中执行
- 宿主机仅需具备 Docker，仓库目录与 sessions 目录会挂载进容器
- 停止 runtime 时会停止并移除该仓库容器

内置基础 Dockerfile 目录：

- `docker/base/node24-core.Dockerfile`
- `docker/base/node24-vscode.Dockerfile`
- `docker/base/node24-vscode-browser.Dockerfile`

## 4. 目录结构

以 `AGENT_RUNTIME_ROOT=.teax-agent-runtime` 为例：

```text
.teax-agent-runtime/
├── repos/
│   └── {owner}/{repo}/          # 主仓目录
└── sessions/
    └── {sessionId}/             # 会话 worktree 目录
```

## 5. 权限要求

Runtime 与 Session 相关接口权限如下：

- `agent:read`：查看会话、事件、runtime 摘要
- `agent:create`：创建会话
- `agent:chat`：会话内对话
- `agent:write`：停止 / 重试 / 置顶等写操作
- `agent:manage`：可见性与参与者管理
- `agent:start`：启动 runtime
- `agent:stop`：停止 runtime

## 6. API 用法

基线路径：`/api/repos/{owner}/{repo}/agents`

### 6.1 Runtime 摘要

- `GET /runtime`

返回要点：

- `runtime_status`：`running/stopped/...`
- `mode`：`local/docker`
- `active_session_count`
- `active_worktree_count`

### 6.2 启动 Runtime

- `POST /runtime/start`

行为：

- 确保仓库存在 runtime 记录
- 更新状态为 `running`
- 回传最新 runtime 摘要

### 6.3 停止 Runtime

- `POST /runtime/stop`
- Body：`{ "force": boolean }`

行为：

- `force=false`：若存在活跃 worktree，返回 `409`
- `force=true`：先清理活跃 worktree，再停止 runtime

### 6.4 创建会话（自动准备 worktree）

- `POST /sessions`

行为：

1. 创建会话与首条消息
2. 写入 `session_preparing` 事件
3. 自动准备 worktree
4. 会话进入 `running`
5. 写入 `worktree_prepared` 或 `worktree_prepare_failed`

### 6.5 停止会话（自动清理 worktree）

- `POST /sessions/{sessionId}/stop`

行为：

- 会话标记为 `stopped`
- 执行 worktree 清理
- 记录 `session_stopped` 事件（含是否移除 worktree）

### 6.6 重试会话（重建 worktree）

- `POST /sessions/{sessionId}/retry`

行为：

- 仅允许 `failed/stopped` 会话
- 先尝试清理旧 worktree
- 再次执行 prepare，恢复到 `running`

## 7. 会话状态流转

P1 实际状态机：

```text
created -> preparing -> running
             |           |
             v           v
           failed     stopped/completed

failed/stopped --retry--> preparing -> running
```

## 8. 前端使用说明

仓库页面 `/:owner/:repo/agents` 已支持：

- Runtime 面板：状态、模式、活跃会话/worktree 计数、启动/停止操作
- 会话列表与详情：展示 `runtime_status/worktree_status/worktree_path/worktree_error`
- 自动刷新：消息与事件流周期刷新，Runtime 摘要定时刷新

## 9. 常见问题

### 9.1 停止 runtime 返回 409

原因：存在活跃 worktree。

处理：调用 `POST /runtime/stop` 并传 `{"force": true}`。

### 9.2 local 模式下会话创建失败

优先检查：

1. `AGENT_RUNTIME_GIT_BIN` 是否可执行
2. `clone_url` 是否可访问（凭据/网络）
3. `AGENT_RUNTIME_ROOT` 是否有读写权限

请修复环境后重试。

### 9.3 停止会话后目录未删除

检查：

- `AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP=true` 时会保留目录，这是预期行为。

## 10. 生产建议

- 生产建议使用 `docker`，必要时再切 `local`
- 建议将 `AGENT_RUNTIME_ROOT` 指向持久化磁盘
- 结合系统监控采集以下指标：
  - runtime 状态变化
  - worktree 准备失败率
  - 强制停止次数

## 11. 变更清单（P1）

关键文件：

- `server/db/schema/agent-runtime.ts`
- `server/services/agent-runtime.service.ts`
- `server/services/agent-session.service.ts`
- `server/api/repos/[owner]/[repo]/agents/runtime/*`
- `app/pages/[owner]/[repo]/agents.vue`

---

如需继续扩展到 Phase 2（System Runtime、跨仓库编排、配置仓库自动提交），建议直接在本文档基础上新增“Phase 2 运维手册”章节。
