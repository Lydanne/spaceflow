# Workflow 预设分享功能

> Workflow 配置预设、分享链接和简化触发流程

## 功能概述

Workflow 预设允许用户将常用的 Workflow 配置（workflow、分支、输入参数）保存为预设，生成分享链接供团队成员快速触发。

### 核心特性

- **配置预设**：保存 workflow + 分支 + 输入参数组合
- **分享链接**：生成独立页面链接，无需进入项目即可触发
- **只读配置**：分享页面不可修改配置，确保一致性
- **运行互斥**：同一用户在同一预设下只能有一个运行中的工作流
- **阶段动画**：分享页面只显示 Jobs 阶段进度，不显示详细日志
- **权限校验**：访问者需要有项目的 `actions:trigger` 权限

### 使用场景

| 场景 | 说明 |
| ---- | ---- |
| **一键发布** | 运维人员分享"正式发布"链接给产品经理，产品经理点击即可触发发布 |
| **预发布环境** | 测试人员使用"预发布"链接快速部署测试环境 |
| **定期任务** | 分享"数据同步"链接，非技术人员也能手动触发 |

## 架构设计

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Workflow 预设流程                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 创建预设                                                      │
│     ┌──────────────┐    保存配置    ┌──────────────────┐         │
│     │ 触发 Workflow │ ────────────▶ │ workflow_presets │         │
│     │    弹窗      │               │      数据库       │         │
│     └──────────────┘               └──────────────────┘         │
│                                            │                     │
│  2. 分享链接                               │ 生成 share_token    │
│     ┌──────────────────────────────────────┴─────┐               │
│     │  https://teax.example.com/workflow/{token}  │               │
│     └────────────────────────────────────────────┘               │
│                                                                  │
│  3. 触发运行                                                      │
│     ┌──────────────┐    权限校验    ┌──────────────┐             │
│     │  分享页面    │ ────────────▶ │  Gitea API   │             │
│     │ /workflow/:token │  互斥检查   │ dispatchWorkflow │         │
│     └──────────────┘               └──────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 数据模型

### workflow_presets 表

```typescript
{
  id: uuid (PK),
  repository_id: uuid (FK -> repositories.id),
  name: string,                    // 预设名称，如"正式发布"
  workflow_path: string,           // workflow 文件路径
  branch: string,                  // 固定分支
  inputs: jsonb,                   // 预设的 input 值
  share_token: string (unique),    // 分享 token（16 位 nanoid）
  created_by: uuid (FK -> users.id),
  created_at: timestamp,
  updated_at: timestamp
}
```

### 索引

```sql
CREATE INDEX idx_workflow_presets_repo ON workflow_presets(repository_id);
CREATE UNIQUE INDEX idx_workflow_presets_token ON workflow_presets(share_token);
```

## API 设计

### 预设管理 API

| 方法 | 路径 | 说明 | 权限 |
| ---- | ---- | ---- | ---- |
| `GET` | `/api/repos/:owner/:repo/workflow-presets` | 获取预设列表 | `actions:view` |
| `POST` | `/api/repos/:owner/:repo/workflow-presets` | 创建预设 | `actions:trigger` |
| `DELETE` | `/api/repos/:owner/:repo/workflow-presets/:presetId` | 删除预设 | `actions:trigger` |

### 分享页面 API

| 方法 | 路径 | 说明 | 权限 |
| ---- | ---- | ---- | ---- |
| `GET` | `/api/workflow-presets/:token` | 获取预设详情 | `actions:trigger` |
| `POST` | `/api/workflow-presets/:token/run` | 触发运行 | `actions:trigger` |
| `GET` | `/api/workflow-presets/:token/status` | 获取运行状态 | `actions:view` |

### 请求/响应示例

#### 创建预设

```bash
POST /api/repos/xgj/teacher/workflow-presets
Content-Type: application/json

{
  "name": "正式发布",
  "workflow_path": ".gitea/workflows/publish.yml",
  "branch": "master",
  "inputs": {
    "preset": "production",
    "merge-develop": "true",
    "dry-run": "false"
  }
}
```

响应：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "正式发布",
  "workflow_path": ".gitea/workflows/publish.yml",
  "branch": "master",
  "inputs": { "preset": "production", "merge-develop": "true", "dry-run": "false" },
  "share_token": "abc123xyz789defg",
  "created_at": "2026-03-20T08:00:00Z"
}
```

#### 获取预设详情（通过 token）

```bash
GET /api/workflow-presets/abc123xyz789defg
```

响应：

```json
{
  "preset": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "正式发布",
    "workflow_path": ".gitea/workflows/publish.yml",
    "workflow_name": "正式/预发布",
    "branch": "master",
    "inputs": { "preset": "production", "merge-develop": "true", "dry-run": "false" }
  },
  "repository": {
    "id": "...",
    "full_name": "xgj/teacher",
    "name": "teacher"
  }
}
```

#### 触发运行

```bash
POST /api/workflow-presets/abc123xyz789defg/run
```

成功响应：

```json
{
  "success": true,
  "message": "工作流已触发"
}
```

互斥错误响应（409）：

```json
{
  "statusCode": 409,
  "message": "您有一个正在运行的工作流，请等待完成或取消后再试",
  "data": {
    "runId": 123,
    "runNumber": 508
  }
}
```

#### 获取运行状态

```bash
GET /api/workflow-presets/abc123xyz789defg/status
```

响应：

```json
{
  "hasRunning": true,
  "run": {
    "id": 123,
    "run_number": 508,
    "status": "running",
    "conclusion": null,
    "started_at": "2026-03-20T08:05:00Z",
    "completed_at": null,
    "jobs": [
      {
        "id": 456,
        "name": "build",
        "status": "running",
        "conclusion": null,
        "started_at": "2026-03-20T08:05:10Z",
        "completed_at": null
      },
      {
        "id": 457,
        "name": "deploy",
        "status": "queued",
        "conclusion": null,
        "started_at": null,
        "completed_at": null
      }
    ]
  }
}
```

## 前端页面

### 分享页面

路由：`/workflow/:token`

```text
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                        正式发布                              │
│                     xgj/teacher                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📋 Workflow                                           │  │
│  │     正式/预发布                                         │  │
│  │                                                        │  │
│  │  🌿 分支                                               │  │
│  │     master                                             │  │
│  │                                                        │  │
│  │  ─────────────────────────────────────────────────────  │  │
│  │  预设参数                                              │  │
│  │     preset          production                         │  │
│  │     merge-develop   true                               │  │
│  │     dry-run         false                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🔄 运行 #508  [运行中]                          2m36s  │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  ✓ build                                   1m20s │  │  │
│  │  │  🔄 deploy                                       │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                      [ 运行中... ]                           │
│                   请等待当前运行完成                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 页面特性

- **只读配置**：workflow、分支、参数均不可修改
- **阶段动画**：显示 Jobs 列表和状态，不显示详细日志
- **运行互斥**：有运行中任务时禁用运行按钮
- **自动轮询**：运行中时每 3 秒刷新状态
- **权限校验**：无权限时显示错误提示

### 触发弹窗集成

在现有触发 Workflow 弹窗中添加"保存为预设"按钮：

```text
┌─────────────────────────────────────────────────────────────┐
│  触发 Workflow                                               │
│                                                              │
│  Workflow    [正式/预发布                              ▼]    │
│  分支        [master                                   ▼]    │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│  Workflow Inputs                                             │
│  preset *        [production                           ▼]    │
│  merge-develop   [  ]                                        │
│  dry-run         [  ]                                        │
│                                                              │
│  [🔗 保存为预设]                        [取消]  [▶ 触发]     │
└─────────────────────────────────────────────────────────────┘
```

点击"保存为预设"打开二级弹窗：

```text
┌─────────────────────────────────────────────────────────────┐
│  保存为预设                                                  │
│  保存当前配置为预设，生成分享链接供他人使用                    │
│                                                              │
│  预设名称    [正式发布                                    ]   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Workflow      正式/预发布                             │  │
│  │  分支          master                                  │  │
│  │  preset        production                              │  │
│  │  merge-develop true                                    │  │
│  │  dry-run       false                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                              [取消]  [🔗 保存并复制链接]     │
└─────────────────────────────────────────────────────────────┘
```

## 运行互斥逻辑

### 互斥规则

- **范围**：同一用户 + 同一预设
- **状态**：`running` / `waiting` / `queued` 视为运行中
- **匹配**：通过 workflow 文件名 + 用户名匹配

### 实现逻辑

```typescript
// 触发前检查
const runs = await gitea.getRepoWorkflowRuns(owner, repo, 1, 20);
const runningRun = runs.workflow_runs?.find((run) => {
  const isRunning = run.status === "running" || run.status === "waiting" || run.status === "queued";
  const isSameWorkflow = run.path?.includes(preset.workflow_path.replace(/^.*\//, ""));
  const isSameUser = run.actor?.login === session.user.username;
  return isRunning && isSameWorkflow && isSameUser;
});

if (runningRun) {
  throw createError({
    statusCode: 409,
    message: "您有一个正在运行的工作流，请等待完成或取消后再试",
  });
}
```

## 权限控制

### 访问控制

| 操作 | 所需权限 |
| ---- | -------- |
| 查看预设列表 | `actions:view` |
| 创建/删除预设 | `actions:trigger` |
| 访问分享页面 | `actions:trigger` |
| 触发运行 | `actions:trigger` |
| 查看运行状态 | `actions:view` |

### 权限校验流程

```text
访问 /workflow/:token
       │
       ▼
  用户已登录？ ──否──▶ 跳转登录页
       │
      是
       ▼
  获取预设 → 获取仓库 → 获取组织
       │
       ▼
  requirePermission(event, orgId, "actions:trigger", repoId)
       │
       ▼
  有权限？ ──否──▶ 403 Forbidden
       │
      是
       ▼
  显示分享页面
```

## 文件结构

### 后端

```text
server/
├── db/schema/
│   └── workflow-preset.ts          # 数据库 Schema
├── shared/dto/
│   └── workflow-preset.dto.ts      # DTO 验证
├── api/
│   ├── repos/[owner]/[repo]/workflow-presets/
│   │   ├── index.get.ts            # 获取预设列表
│   │   ├── index.post.ts           # 创建预设
│   │   └── [presetId].delete.ts    # 删除预设
│   └── workflow-presets/[token]/
│       ├── index.get.ts            # 获取预设详情
│       ├── run.post.ts             # 触发运行
│       └── status.get.ts           # 获取运行状态
```

### 前端

```text
app/
├── pages/
│   └── workflow/
│       └── [token].vue             # 分享页面
└── components/project/
    └── ProjectActionsTab.vue       # 触发弹窗（含保存预设）
```

## 相关文档

- [CI/CD 集成](./cicd-integration.md) - Workflow 管理和触发
- [权限系统](../design/permission-system.md) - 权限控制
- [数据库设计](../design/database-design.md) - 表结构设计
- [API 规范](../design/api-specification.md) - API 设计规范
