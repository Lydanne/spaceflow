# Agents 系统设计文档

> 参考 GitHub Agents 交互范式，基于 OpenCode 构建“仓库级执行 + 系统级编排”的 AI 开发体系

## 1. 设计目标

本设计直接定义 Teax 的 Agents 模型，不依赖其他模块的历史语义。

硬性约束：

- 每个仓库有且仅有一个 OpenCode Runtime 容器
- 每个 Runtime 容器仅运行一个 OpenCode 服务实例
- 每个会话都在 `sessions/{sessionId}` 目录中独立执行（基于 `git clone/checkout`）
- 会话默认公开（`public`），可创建用户私有会话（`private`）
- 会话支持人工接管（Web IDE / VSCode Remote）
- 系统启动后默认拉起一个系统级 Agent，用于跨仓库任务
- Runtime 基础镜像内置 Node.js 24、OpenCode CLI、无头浏览器等基础工具链
- 支持后续动态扩展工具链，并生成新 Dockerfile 覆盖当前 Runtime 镜像
- Runtime 配置与状态由 Gitea 元数据仓库托管，资源手动接入并自动提交
- OpenCode 配置、MCP、skills、rules 采用双层主模型：全局层 + 资源层（项目/仓库）

## 2. 双层 Agent 模型

### 2.1 Repo Agent（仓库级）

面向单仓库任务，例如：

- 修复 Bug
- 生成测试
- 升级依赖
- 编写文档

关键特征：

- 绑定一个仓库
- 在该仓库 Runtime 内执行
- 每个会话独立目录

### 2.2 System Agent（系统级）

系统启动即存在并保持可用，负责跨仓库编排，例如：

- 批量升级组织内依赖版本
- 批量安全修复与 PR 提交
- 跨仓库发布准备（changelog、版本一致性检查）
- 统一代码规范迁移

关键特征：

- 不绑定单一仓库
- 可以一次选择多个仓库作为目标
- 通过“编排 + 子会话”机制驱动多个 Repo Agent 并行执行

## 3. 总体架构

```text
用户/飞书/API
    │
    ▼
Agent Control Plane
    ├── Session API（创建/停止/事件流/权限）
    ├── Runtime Manager（system + repo runtime 生命周期）
    ├── Session Workspace Manager（分支与目录隔离）
    ├── Orchestrator（系统级跨仓库编排）
    └── Audit & Policy（审计、配额、策略）
            │
            ├── System Runtime（固定 1 个）
            └── Repo Runtime（每仓库 1 个）
```

## 4. Runtime 设计

### 4.1 System Runtime

- 容器名建议：`teax-agent-system`
- 启动时机：平台启动时自动启动
- 职责：接收系统级任务并拆分为多个仓库子任务
- 执行形态：主要做“计划、分发、聚合”，不直接修改业务仓库代码

### 4.2 Repo Runtime

- 容器名建议：`teax-agent-repo-{repoId}`
- 启动策略：懒启动 + 空闲回收（可配置常驻）
- 职责：在目标仓库执行具体编码任务
- 代码根目录建议：`/data/repos/{owner}/{repo}`
- 会话目录建议：`/data/sessions/{sessionId}`

### 4.3 Runtime 基础镜像与默认工具链

默认基础镜像建议：`teax/agent-runtime:base-v1`

默认内置软件：

- Node.js 24.x（含 npm/pnpm/corepack）
- `vscode-server`（或 openvscode-server，统一作为远程编辑服务）
- OpenCode 运行依赖（Node、Git、Shell、Python 基础环境）
- 无头浏览器运行栈（Chromium + 常见依赖库）
- 常用开发工具（git、curl、jq、ripgrep、build-essential）

默认目录布局：

- `/opt/agent`：平台运行组件
- `/data/repos`：仓库主目录
- `/data/sessions`：会话 worktree 目录
- `/var/log/agent`：运行日志

### 4.4 动态扩展与 Dockerfile 覆盖机制

目标：平台管理员可在后期动态追加工具链（例如 Java、Go、Rust、Playwright 依赖），并产出可追踪的新镜像。

机制：

1. 管理员提交“扩展配置”（包列表、脚本、环境变量、探针）
2. 系统根据模板生成目标目录的 `Dockerfile`（覆盖原有 `Dockerfile`）
3. 触发构建任务并产出新镜像 tag/digest
4. 通过策略灰度到 System Runtime 或指定 Repo Runtime
5. 验证通过后升级为默认镜像，失败可一键回滚到上一个 digest

实现约束（当前）：

- 不再支持通过运行时环境变量传入仓库 Dockerfile 路径（如 `AGENT_RUNTIME_DOCKERFILE`）
- Repo Runtime 的第二段构建 Dockerfile 固定从 `.teax` 仓库读取：
  - 优先 `/projects/{org}/{repo}/Dockerfile`
  - 回退 `/globals/Dockerfile`
- 构建时会统一绑定到固定本地基础镜像 tag（`teax-agent-runtime:base`）

生成策略建议：

- 基础模板：由 `globals/Dockerfile` 提供
- 资源覆盖：写入 `projects/{org}/{name}/Dockerfile`
- 每次生成都记录到对应目录 `state.json`

镜像版本策略：

- tag：`teax/agent-runtime:{scopeKey}-{timestamp}`
- 生产绑定必须使用 digest，避免 tag 漂移

### 4.5 Runtime 配置与状态仓库（手动接入）

该能力改为**手动接入模式**，平台不再自动创建组织、仓库与机器人账号。

接入前提（由用户或管理员预先创建）：

- 元数据组织（示例：`.teax`）
- 元数据仓库（示例：`.teax`）
- 提交账号（示例：`TeaxBot`）及其访问令牌

该仓库定位：**仅存储配置与状态元数据**，不存业务代码与构建二进制产物。

接入参数（建议作为平台配置项）：

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `AGENT_META_REPO_URL` | `https://gitea.example.com/.teax/.teax.git` | 元数据仓库地址（clone/fetch/push 目标） |
| `AGENT_META_REPO_BRANCH` | `main` | 元数据仓库默认分支 |
| `AGENT_META_REPO_AUTH_TYPE` | `token` | 鉴权方式（当前建议 token） |
| `AGENT_META_REPO_TOKEN` | 空（可选） | 元数据仓库写入令牌；不传时自动回退 `AGENT_BOT_TOKEN` |
| `AGENT_BOT_USERNAME` | `TeaxBot` | 机器人提交用户名 |
| `AGENT_BOT_EMAIL` | `teaxbot@local` | 机器人提交邮箱 |
| `AGENT_BOT_TOKEN` | `***` | TeaxBot Token（用于提交与状态回写） |

说明：

- 令牌解析优先级：`AGENT_META_REPO_TOKEN`（若传入） > `AGENT_BOT_TOKEN`
- 因此 `AGENT_META_REPO_TOKEN` 可不配置，默认直接使用 `AGENT_BOT_TOKEN`
- 所有敏感参数应存放在密钥管理，不写入元数据仓库

目录约定（固定）：

- `/globals/`：全局默认配置
- `/projects/{org}/{name}/`：项目或仓库级配置

每个目录都必须包含：

- `Dockerfile`
- `.opencode/`（包含 opencode、mcp、skills、rules）
- `meta.json`（环境配置、作用域信息）
- `state.json`（状态信息，会话、worktree、最近镜像等）

示例：

```text
/
├── globals/
│   ├── Dockerfile
│   ├── .opencode/
│   │   ├── opencode.yaml
│   │   ├── mcp/servers.yaml
│   │   ├── skills/index.yaml
│   │   └── rules/policy.md
│   ├── meta.json
│   └── state.json
└── projects/
    └── xgj/
        └── teacher/
            ├── Dockerfile
            ├── .opencode/
            │   ├── opencode.yaml
            │   ├── mcp/servers.yaml
            │   ├── skills/index.yaml
            │   └── rules/policy.md
            ├── meta.json
            └── state.json
```

不入库内容：

- 镜像层与镜像二进制
- 构建任务原始日志全文
- 运行时临时缓存与会话工作目录

提交与状态回写规则：

- 系统使用专用账号 `TeaxBot` 提交
- 每次配置变更自动 commit + push
- 可选开启“PR 审批后生效”模式
- 每次构建与发布变更都回写对应目录 `state.json`
- 关键状态快照（active image、会话计数、worktree 计数）自动提交

### 4.9 TeaxBot 账号（手动接入）

平台不再自动创建 `TeaxBot`。改为手动准备并传入参数：

1. 在 Gitea 手动创建（或指定已有）`TeaxBot` 账号
2. 手动生成最小权限访问令牌
3. 在平台配置中至少传入 `AGENT_BOT_TOKEN`；若需对元数据仓库使用独立令牌，再额外传 `AGENT_META_REPO_TOKEN`
4. 配置提交身份（`AGENT_BOT_USERNAME` / `AGENT_BOT_EMAIL`）

`TeaxBot` 默认职责：

- 提交配置与状态仓库变更（`meta.json`、`state.json`、`.opencode/*`、`Dockerfile`）
- 记录 Runtime 构建与发布状态
- 执行系统级自动化同步任务

权限边界：

- 默认仅授予配置与状态仓库写权限
- 不默认授予业务仓库代码写权限（除非显式授权）
- 所有 `TeaxBot` 写操作必须带审计字段（actor=`TeaxBot`、traceId、scopePath）

### 4.6 Runtime 应用策略

- System Runtime 默认加载 `/globals`
- Repo Runtime 默认加载 `/projects/{org}/{name}`，缺失时回退 `/globals`
- 项目级与仓库级都映射到 `/projects/{org}/{name}`（由 `meta.json.scope` 区分）
- 会话创建时可显式声明目标配置目录（需权限）
- 运行中会话不热切镜像，新镜像在下次 runtime 重建时生效

### 4.7 OpenCode 配置分层（globals + projects）

分层来源：

- 全局层（globals）：`/globals/.opencode/*`
- 资源层（projects）：`/projects/{org}/{name}/.opencode/*`
- 会话层（session）：本次会话临时覆盖项（不回写仓库）

生效优先级：

- `session > projects > globals > runtime default`

合并规则：

- `opencode.yaml`：深度合并，仅允许白名单字段覆盖（模型、温度、工具开关、超时等）
- `mcp`：按 `serverId` 合并；projects 可覆盖 globals 同名 server 配置，敏感信息仅引用 secret key
- `skills`：集合并集 + 去重；projects 可显式禁用某些 global skills
- `rules`：按优先级拼接（globals -> projects）；冲突时以更严格规则优先

审计要求：

- 每次会话都记录最终“解析后配置快照”（resolved config hash）
- 记录命中来源（globals/projects/session）用于追溯

### 4.8 容器启动配置加载

容器启动时必须先从配置与状态仓库拉取对应目录作为默认配置：

- System Runtime：拉取 `/globals`
- 资源 Runtime（项目或仓库）：优先拉取 `/projects/{org}/{name}`，不存在则回退 `/globals`

加载步骤：

1. 拉取目标目录中的 `Dockerfile` 对应镜像版本（由 `state.json.active_image_digest` 指定）
2. 将 `.opencode/` 挂载或同步到容器内默认路径（例如 `/opt/agent/.opencode`）
3. 读取 `meta.json` 注入环境变量、工具开关、资源限制
4. 读取 `state.json` 恢复运行状态信息（最近会话索引、worktree 计数、健康状态）

启动后回写：

- 容器健康与配置 hash 回写到对应目录 `state.json`
- 若发生回退（例如目录缺失），必须记录告警事件

## 5. 会话模型

会话分两类：

- `repo_session`：单仓库会话
- `system_session`：系统级编排会话

通用状态机：

```text
created -> preparing -> running -> completed
              │            │
              │            ├-> stopped
              │            └-> failed
              └-> failed
```

### 5.1 Repo Session

- 输入：`repo`、`baseBranch`、`taskPrompt`、`visibility`
- 执行：创建 worktree -> 运行 OpenCode -> 输出日志/改动/PR
- 结果：commit、PR、执行摘要

### 5.2 System Session

- 输入：`targetRepos[]`、`taskTemplate`、`policy`
- 执行：
  - 先生成计划（Plan）
  - 再为每个仓库创建一个或多个 `repo_session`
  - 聚合结果并输出总报告
- 结果：跨仓库执行报告、成功/失败矩阵、批量 PR 链接

### 5.3 会话协作与对话记录

- 每个会话必须记录 `creator_id`（谁创建的）
- 会话支持多人协作，允许多个用户在同一会话持续对话
- 每条消息都记录发言人（`actor_type`、`actor_id`）、时间、内容、上下文
- 同一会话内消息按 `seq` 单调递增，保证可回放的对话顺序

协作规则：

- `public` 会话：具备权限的项目成员可加入对话
- `private` 会话：默认仅创建者可对话；可显式邀请协作者
- 系统会话可只读展示给普通成员，对话权限仅限授权角色

## 6. Git Worktree 设计

### 6.1 分支策略

- `baseBranch` 默认仓库默认分支
- `workingBranch` 默认：`agent/{sessionId}-{slug}`
- 若分支已存在：
  - 可配置 `reuse`（复用）或 `force-new`（自动加后缀）

### 6.2 目录策略

- 主仓：`/data/repos/{owner}/{repo}`
- 会话目录：`/data/sessions/{sessionId}`
- 示例：

```bash
git fetch origin --prune
git worktree add -B "${WORKING_BRANCH}" "/data/sessions/${SESSION_ID}" "origin/${BASE_BRANCH}"
```

### 6.3 并发控制

- 同仓库 Git 元数据共享，必须加仓库级锁
- 串行操作：`fetch`、`worktree add/remove`、`prune`
- 并行操作：OpenCode 在各自会话目录中执行

## 7. OpenCode 执行协议

每个会话执行流程：

```text
create session record
  -> ensure runtime alive
  -> prepare worktree
  -> resolve config (globals + projects + session override)
  -> open-code create/bind session
  -> inject system prompt + user prompt
  -> stream events (text/tool/reasoning/error)
  -> optional commit / optional PR
  -> finalize session
```

关键约束：

- system prompt 必须包含当前会话目录和工具策略
- OpenCode 执行前必须注入“分层合并后的配置”
- 禁止越界写入非会话目录
- 所有工具调用事件必须写入审计日志

## 8. 可见性与权限

### 8.1 会话可见性

- 默认 `public`：仓库成员可见
- 可选 `private`：仅创建者可见
- 管理员与组织 Owner 可审计 private 会话

### 8.2 权限建议

- `agent:read`：查看会话与日志
- `agent:create`：创建会话
- `agent:chat`：在会话中发送消息与追问
- `agent:write`：追加任务、手动提交、重试
- `agent:manage`：终止他人会话、改可见性、删除会话
- `agent:system`：创建系统级跨仓库会话

### 8.3 System Agent 权限边界

- 默认仅管理员/平台运维拥有 `agent:system`
- 系统会话必须记录“操作者 + 目标仓库集合 + 审批记录（可选）”
- 支持高风险任务二次确认（如批量推送分支）

### 8.4 OpenCode 权限控制

OpenCode 权限控制采用“五维模型”：

- 身份维度：谁在执行（用户、`TeaxBot`、系统会话）
- 作用域维度：在哪执行（`/globals`、`/projects/{org}/{name}`、会话目录）
- 工具维度：允许哪些工具/命令
- 资源维度：可访问哪些 MCP、Secrets、网络目标
- 审批维度：哪些操作必须人工批准

工具权限分级建议：

- `read_only`：只读工具（检索、读取、分析）
- `workspace_write`：仅允许写当前会话目录
- `repo_write`：允许提交/推送到目标仓库分支
- `privileged`：高风险能力（外网写入、敏感命令、批量变更）

默认策略：

- 普通会话默认 `workspace_write`
- `repo_write` 需要 `agent:write` 且仓库策略允许
- `privileged` 必须触发审批流
- `TeaxBot` 默认仅在配置与状态仓库具备 `repo_write`

MCP 权限策略：

- MCP 按 `serverId` 白名单启用
- 每个 server 可配置 `allowedTools` / `allowedMethods`
- 仓库或项目层可禁用全局 MCP
- 敏感 MCP（数据库、生产环境）默认需审批

Secrets 权限策略：

- 密钥按 `global/project/repo/session` 分域管理
- OpenCode 会话只拿到“最小必需密钥引用”
- 运行日志默认脱敏，不回显密钥原文
- 高风险密钥调用写入审计并可配置双人审批

## 9. VSCode 远程协作

Repo Session 支持人工接管：

- Web IDE：`/:owner/:repo/agents/:sessionId/ide`
- VSCode Remote SSH：通过短期 token 换取临时连接凭据

安全要求：

- token 短 TTL（如 10 分钟）
- 强制登录后交换凭据
- 连接后工作目录固定到对应会话目录

## 10. 数据模型（草案）

### 10.1 `agent_runtimes`

- `id`
- `scope`（system/repo）
- `repository_id`（repo scope 时必填，unique）
- `container_id`
- `status`（starting/running/stopped/failed）
- `last_heartbeat_at`
- `created_at` / `updated_at`

### 10.2 `agent_sessions`

- `id`
- `scope`（system/repo）
- `repository_id`（repo session 必填）
- `runtime_id`
- `parent_session_id`（系统会话拆分的子会话）
- `title`
- `prompt`
- `base_branch`
- `working_branch`
- `session_path`
- `visibility`（public/private，system session 可固定 internal）
- `creator_id`
- `status`
- `opencode_session_id`
- `auto_commit` / `auto_pr`
- `pr_url`
- `started_at` / `finished_at`
- `created_at` / `updated_at`

### 10.3 `agent_session_targets`

- `id`
- `session_id`（system session）
- `repository_id`
- `child_session_id`（repo session）
- `status`
- `summary`
- `created_at` / `updated_at`

### 10.4 `agent_session_events`

- `id`
- `session_id`
- `seq`
- `type`（stdout/tool/reasoning/system/error）
- `payload`（jsonb）
- `actor_type`（user/agent/system/bot）
- `actor_id`
- `created_at`

### 10.5 `agent_runtime_scopes`

- `id`
- `scope_path`（`/globals` 或 `/projects/{org}/{name}`）
- `scope_type`（global/project/repo）
- `organization_id`（project/repo scope 时可用）
- `project_id`（project scope）
- `repository_id`（repo scope）
- `source_repo_full_name`（如 teax-system/agents-runtime-config）
- `source_path`（与 `scope_path` 一致）
- `is_active`
- `created_by`
- `created_at` / `updated_at`

### 10.6 `agent_runtime_builds`

- `id`
- `scope_path`（`/globals` 或 `/projects/{org}/{name}`）
- `status`（queued/building/success/failed）
- `dockerfile_ref`（配置与状态仓库中的目标 `Dockerfile` 路径）
- `state_ref`（对应目录 `state.json` 路径）
- `image_tag`
- `image_digest`
- `build_log_url`
- `started_at` / `finished_at`
- `created_by`
- `created_at`

### 10.7 `agent_config_layers`

- `id`
- `scope`（global/project/repo）
- `organization_id`（global/project scope）
- `project_id`（project scope）
- `repository_id`（repo scope）
- `config_root_ref`（`/globals` 或 `/projects/{org}/{name}`）
- `opencode_dir_ref`（配置仓库中 `.opencode/` 路径）
- `meta_ref`（配置仓库中 `meta.json` 路径）
- `state_ref`（配置仓库中 `state.json` 路径）
- `version`
- `updated_by`
- `created_at` / `updated_at`

### 10.8 `agent_session_resolved_configs`

- `id`
- `session_id`
- `resolved_config_hash`
- `resolved_payload`（jsonb）
- `sources`（jsonb，记录 globals/projects/session 来源）
- `created_at`

### 10.9 `agent_opencode_policies`

- `id`
- `scope_path`（`/globals` 或 `/projects/{org}/{name}`）
- `tool_policy`（jsonb，工具分级与命令白名单/黑名单）
- `mcp_policy`（jsonb，server 白名单与 method 限制）
- `secret_policy`（jsonb，密钥域与暴露规则）
- `approval_policy`（jsonb，哪些动作需要审批）
- `version`
- `updated_by`
- `created_at` / `updated_at`

### 10.10 `agent_permission_approvals`

- `id`
- `session_id`
- `action_type`（tool_exec/mcp_call/secret_access/git_push/system_batch）
- `action_payload`（jsonb）
- `status`（pending/approved/rejected/expired）
- `requested_by`
- `approved_by`
- `reason`
- `expires_at`
- `created_at` / `updated_at`

### 10.11 `agent_session_participants`

- `id`
- `session_id`
- `user_id`
- `role`（owner/collaborator/viewer）
- `can_chat`（bool）
- `invited_by`
- `joined_at`
- `created_at` / `updated_at`

### 10.12 `agent_session_messages`

- `id`
- `session_id`
- `seq`
- `actor_type`（user/agent/system/bot）
- `actor_id`
- `message_type`（user_prompt/agent_reply/system_note/tool_summary）
- `content`
- `metadata`（jsonb）
- `created_at`

## 11. API 设计（草案）

### 11.1 仓库级 API

基线路径：`/api/repos/{owner}/{repo}/agents`

- `GET /sessions`
- `POST /sessions`
- `GET /sessions/{sessionId}`
- `GET /sessions/{sessionId}/participants`
- `POST /sessions/{sessionId}/participants`（邀请参与者）
- `PATCH /sessions/{sessionId}/participants/{userId}`（调整角色/对话权限）
- `POST /sessions/{sessionId}/prompt`
- `GET /sessions/{sessionId}/messages`
- `POST /sessions/{sessionId}/messages`（用户在会话中发言）
- `POST /sessions/{sessionId}/stop`
- `POST /sessions/{sessionId}/retry`
- `GET /sessions/{sessionId}/events`（SSE）
- `PATCH /sessions/{sessionId}/visibility`
- `POST /sessions/{sessionId}/remote-token`

### 11.2 系统级 API

基线路径：`/api/agents/system`

- `GET /status`：系统级 Agent 状态
- `POST /sessions`：创建跨仓库会话
- `GET /sessions`
- `GET /sessions/{sessionId}`
- `GET /sessions/{sessionId}/targets`
- `GET /sessions/{sessionId}/events`（聚合事件流）
- `POST /sessions/{sessionId}/stop`

### 11.3 Runtime 构建与发布 API

基线路径：`/api/agents/runtime`

- `POST /builds/globals`：基于 `/globals/Dockerfile` 触发构建
- `POST /builds/projects/{org}/{name}`：基于 `/projects/{org}/{name}/Dockerfile` 触发构建
- `GET /builds/{buildId}`：查看构建状态与产物 digest
- `POST /builds/{buildId}/promote`：将构建产物升级为目标目录默认镜像
- `POST /builds/{buildId}/rollback`：回滚到上一可用 digest
- `GET /scopes/{scopePath}/state`：读取目标目录 `state.json`
- `POST /scopes/{scopePath}/activate`：激活目标目录对应镜像版本

### 11.4 OpenCode 配置中心 API（globals/projects）

全局层：

- `GET /api/agents/config/globals`
- `PUT /api/agents/config/globals/opencode`
- `PUT /api/agents/config/globals/mcp`
- `PUT /api/agents/config/globals/skills`
- `PUT /api/agents/config/globals/rules`
- `PUT /api/agents/config/globals/meta`
- `GET /api/agents/config/globals/state`

项目层：

- `GET /api/orgs/{orgName}/projects/{projectId}/agents/config`
- `PUT /api/orgs/{orgName}/projects/{projectId}/agents/config/opencode`
- `PUT /api/orgs/{orgName}/projects/{projectId}/agents/config/mcp`
- `PUT /api/orgs/{orgName}/projects/{projectId}/agents/config/skills`
- `PUT /api/orgs/{orgName}/projects/{projectId}/agents/config/rules`
- `PUT /api/orgs/{orgName}/projects/{projectId}/agents/config/meta`
- `GET /api/orgs/{orgName}/projects/{projectId}/agents/config/state`
- `POST /api/orgs/{orgName}/projects/{projectId}/agents/config/resolve-preview`

仓库层：

- `GET /api/repos/{owner}/{repo}/agents/config`
- `PUT /api/repos/{owner}/{repo}/agents/config/opencode`
- `PUT /api/repos/{owner}/{repo}/agents/config/mcp`
- `PUT /api/repos/{owner}/{repo}/agents/config/skills`
- `PUT /api/repos/{owner}/{repo}/agents/config/rules`
- `PUT /api/repos/{owner}/{repo}/agents/config/meta`
- `GET /api/repos/{owner}/{repo}/agents/config/state`
- `POST /api/repos/{owner}/{repo}/agents/config/resolve-preview`（返回最终合并结果）

### 11.5 OpenCode 权限与审批 API

策略管理：

- `GET /api/agents/policies/globals`
- `PUT /api/agents/policies/globals`
- `GET /api/orgs/{orgName}/projects/{projectId}/agents/policies`
- `PUT /api/orgs/{orgName}/projects/{projectId}/agents/policies`
- `GET /api/repos/{owner}/{repo}/agents/policies`
- `PUT /api/repos/{owner}/{repo}/agents/policies`

执行前检查：

- `POST /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/permission-check`
  输入：动作类型 + 参数；输出：allow/deny/require-approval

审批流：

- `POST /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/approvals`
- `GET /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/approvals`
- `POST /api/repos/{owner}/{repo}/agents/approvals/{approvalId}/approve`
- `POST /api/repos/{owner}/{repo}/agents/approvals/{approvalId}/reject`

会话协作：

- `POST /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/join`（加入会话）
- `POST /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/leave`（离开会话）
- `POST /api/repos/{owner}/{repo}/agents/sessions/{sessionId}/messages/{messageId}/pin`

系统级创建请求示例：

```json
{
  "title": "批量升级 eslint 到 10.x",
  "taskTemplate": "升级依赖并修复 lint 报错，最终提交 PR",
  "targetRepos": ["org/a", "org/b", "org/c"],
  "baseBranch": "main",
  "autoPr": true
}
```

## 12. 前端信息架构

### 12.1 仓库页面（`/:owner/:repo/agents`）

- 会话列表：全部公开 + 我的私有
- 创建会话：分支、可见性、自动提交策略
- 会话详情：日志流、对话时间线（带发言人）、文件改动、打开 IDE、远程连接
- 参与者面板：创建者、协作者、当前在线成员、邀请入口
- 仓库级配置页签：mcp、opencode、skills、rules（可预览最终解析结果）
- 仓库级权限页签：OpenCode 工具权限、MCP 白名单、Secrets 策略、审批开关
- 显示继承来源标记：globals/projects（并显示 `meta.scope=project|repo`）

### 12.2 项目页面（`/:orgName/:projectName/settings/agents`）

- 项目级配置页签：mcp、opencode、skills、rules
- 项目级环境配置页签：meta/state（state 只读）
- 项目级权限矩阵页签：角色 -> 工具级别 -> MCP 访问 -> 审批要求
- 项目内仓库应用范围预览
- 配置差异对比（项目默认 vs 仓库覆盖）

### 12.3 平台页面（`/-/admin/agents`）

- System Agent 健康状态
- 跨仓库会话列表
- 目标仓库执行矩阵
- 批量任务模板与历史报告
- 全局配置页签：global mcp、global opencode、global skills、global rules
- 全局权限策略页签：OpenCode 默认策略模板 + 审批队列
- 会话审计页签：按会话查看“谁创建、谁发言、谁审批”的完整链路

## 13. 可靠性与安全

- Runtime 心跳 + 自动拉起
- 会话超时自动停止
- 成本与并发配额限制（按组织/仓库）
- 工具白名单与命令审计
- 私有会话访问日志留痕
- 系统会话高风险操作审批开关
- 运行时镜像版本固定到 digest，并保留回滚点
- 运行时配置与状态仓库开启分支保护与提交签名（可选）
- OpenCode 工具执行受策略引擎约束（默认 deny by default）
- MCP 调用必须命中白名单 server 与 method
- Secrets 注入最小化，日志强制脱敏
- 高风险动作强制审批并保留审批链路审计
- 会话消息不可静默篡改，编辑/删除操作必须记录审计事件

关键风险：

- 跨仓库任务范围失控：目标仓库必须显式列出并可审计
- 同仓库并发 Git 冲突：仓库级锁 + 重试退避
- 私有会话泄露：visibility 过滤 + 审计
- Runtime 漂移：镜像版本锁定 + 周期性重建

## 14. 分阶段实施计划

### Phase 1（MVP）

- Repo Runtime（每仓库 1 容器）与 Repo Session 全流程
- public/private 可见性与权限
- worktree 生命周期管理
- 日志流与会话详情页

当前实现状态（2026-03-27）：

- 已落地仓库级 Runtime 生命周期 API（查询 / 启动 / 停止）
- 已落地 Session 创建 -> worktree 准备 -> 运行 -> 停止清理 -> 重试重建闭环
- 已落地会话事件流与会话详情页（含运行态与 worktree 状态展示）

### Phase 2（系统级）

- System Runtime 启动即存在
- System Session 编排与子会话聚合
- 跨仓库批量任务 API 与管理页
- Runtime 配置与状态仓库手动接入与自动提交链路
- `/globals|/projects/{org}/{name}` -> `Dockerfile` -> image build 的闭环

### Phase 3（协作与治理）

- VSCode Remote 临时凭据
- 批量任务审批流
- 成本统计、配额、策略模板
- 运行时目录级灰度发布、回滚、审计报表

---

本设计文档定义目标架构与实现路径。进入开发前，应在 API 规范与数据库设计中固化字段、错误码和权限矩阵。
