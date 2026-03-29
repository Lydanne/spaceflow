# Agents 系统设计规范（会话中心版）

> 更新时间：2026-03-29。  
> 本文是下一阶段统一规范：页面信息架构、会话上下文、分支绑定、Runtime/Opencode 职责边界按此执行。

## 1. 设计基线

Agents 以“会话（Session）+ 对话（Chat）”为中心，不再把 Runtime 运营信息混在主工作台。

核心原则：

1. `Opencode` 是容器内核心服务，围绕会话目录启动与运行。
2. Agents 主页面只做会话协作主流程：左侧会话，右侧聊天。
3. Runtime 启停与统计收敛到仓库设置页；会话维度设置在会话设置面板中完成。
4. 所有对话严格与分支绑定，并在页面显式展示。
5. `.teax/` 仅作为本地运行时配置目录，不再要求 push 到任何远程仓库。

## 2. 页面信息架构（IA）

### 2.1 `/:owner/:repo/agents`（主工作台）

- 左侧：会话列表（标题、状态、可见性、分支标识、最近更新时间）
- 右侧：聊天面板（消息流、输入框、事件流入口）
- 页面只保留会话协作动作：
  - 创建会话
  - 切换会话
  - 发送消息
  - 会话参与者协作（join/leave）

不放在主页面的内容：

- Runtime 级启动/停止/重建
- Runtime 级统计（活跃容器、资源占用、活跃会话计数）
- 全局容器运维参数

### 2.2 `/:owner/:repo/settings`（Runtime 运营）

在设置页新增/使用 `Agents Runtime` 分组，统一承载：

- 容器启动/停止/重启
- Runtime 健康状态与统计
- Opencode 默认启动参数（如 `AGENT_RUNTIME_OPENCODE_START_COMMAND`）

### 2.3 会话设置（Session Settings）

每个会话有独立设置区（抽屉或侧栏）：

- 分支绑定信息（`base_branch` / `working_branch`）
- 会话上下文路径（容器内/宿主机）
- Opencode 会话级控制（start/stop/restart）
- 可见性与参与者权限

## 3. 会话上下文模型

### 3.1 标准上下文目录

每个会话绑定唯一上下文目录：

- 容器内：`/runtime/sessions/{sessionId}`
- 宿主机：`${AGENT_RUNTIME_ROOT}/sessions/{sessionId}`

说明：历史讨论中出现过 `/runtime/sesstion/...` 拼写，统一更正为 `/runtime/sessions/...`。

### 3.2 页面展示要求

在会话详情与设置中必须可见：

- `sessionId`
- 当前分支（`working_branch`）
- 上下文目录（`/runtime/sessions/{sessionId}`）

## 4. 分支绑定与对话语义

每条会话对话都与分支绑定，绑定规则：

1. 会话创建时确定 `base_branch` 和 `working_branch`。
2. 消息发送与处理默认作用于该 `working_branch`。
3. UI 必须持续展示当前绑定分支，避免“跨分支误操作”。

建议（后续增强）：

- 在消息元数据中补充 `branch_ref` 快照（便于历史追溯）。

## 5. Runtime 与 Opencode 职责

### 5.1 Runtime

- 负责仓库级容器生命周期与会话目录准备。
- 不负责具体业务对话语义。

### 5.2 Opencode

- 作为容器内核心服务，负责会话目录下的交互执行。
- 会话级启停控制作用于对应目录，不跨会话共享进程状态。

## 6. `.teax` 策略调整

`.teax/` 目录定位调整为“本地运行时配置缓存”：

- 可用于本地 Dockerfile / 策略覆盖。
- 不再作为必须 push 的配置仓库流程节点。
- 默认不进入会话分支提交链路，不参与 PR 变更。

如需共享配置，单独设计“导出/导入”机制，不与会话执行链路耦合。

## 7. API 分层约束

会话主流程 API（Agents 主页面）：

- `/agents/sessions/*`
- `/agents/sessions/{sessionId}/messages/*`
- `/agents/sessions/{sessionId}/events`

会话设置 API（Session Settings）：

- `/agents/sessions/{sessionId}/visibility`
- `/agents/sessions/{sessionId}/participants/*`
- `/agents/sessions/{sessionId}/opencode/control`

Runtime 设置 API（Repo Settings）：

- `/agents/runtime`
- `/agents/runtime/start`
- `/agents/runtime/stop`

## 8. 实施建议

1. 先调整页面布局与入口归位（主页面 vs 设置页）。
2. 再补充分支绑定展示与上下文目录展示。
3. 最后清理 `.teax push` 相关历史文档与流程说明，统一到本规范。
