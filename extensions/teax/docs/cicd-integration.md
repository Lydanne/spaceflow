# CI/CD 集成文档

> Gitea Actions 集成、Workflow 管理和执行流程

## 架构概述

```text
代码提交 → Gitea Actions 自动触发 → workflow 执行 → Teax Webhook 接收通知 → 飞书推送
```

- **CI/CD 执行**：由 Gitea Actions 原生处理，Teax 不参与构建部署过程
- **数据展示**：Teax 后端通过 Gitea API（`/api/v1/repos/{owner}/{repo}/actions/runs`）获取 workflow runs，前端通过 `/api/orgs/{orgId}/projects/{projectId}/actions` 代理访问
- **Workflow 解析**：Teax 后端通过 Gitea API（`/api/v1/repos/{owner}/{repo}/contents/{path}`）获取 workflow YAML 并解析
- **通知增值**：Gitea Webhook 推送事件到 Teax，Teax 根据项目通知设置发送飞书通知

> **Actions Tab 说明**：CI/CD 完全由 Gitea Actions（`.gitea/workflows/*.yml`）驱动。Teax 通过 Gitea API 代理展示 workflow runs 列表，提供飞书通知等增值功能。不再维护独立的 PublishTask 发布系统。

## OpenCode 集成（AI 辅助 CI/CD）

Teax 提供 OpenCode API 供 Gitea Actions 调用。API 内部通过 OpenCode 客户端连接到 CI 工作区容器内的 OpenCode 服务端，执行 AI 自动化代码操作。

**架构流程：**
```text
Gitea Actions → Teax API → OpenCode Client → OpenCode Server (容器内) → 执行 AI 操作
```

### 使用场景

| 场景 | 说明 | 示例 |
| ---- | ---- | ---- |
| **代码审查** | PR 自动审查并提出改进建议 | AI 检查代码质量、安全漏洞、性能问题 |
| **自动修复** | CI 失败时自动修复代码 | 测试失败时 AI 分析并修复 bug |
| **文档生成** | 自动生成或更新文档 | 根据代码变更更新 API 文档 |
| **代码重构** | 自动化代码优化 | 应用最佳实践、移除冗余代码 |
| **依赖更新** | 自动升级依赖并修复兼容性 | 升级 npm 包并修复破坏性变更 |

### Workflow 示例

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - name: AI Review PR
        run: |
          SESSION_ID=$(curl -s -X POST \
            -H "Authorization: token ${{ secrets.TEAX_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "prompt": "Review this PR: ${{ github.event.pull_request.html_url }}. Check for bugs, security issues, and suggest improvements.",
              "branch": "${{ github.head_ref }}"
            }' \
            https://teax.example.com/api/repos/${{ github.repository }}/opencode/sessions | jq -r '.sessionId')
          
          echo "Session ID: $SESSION_ID"
          
          # 等待完成
          while true; do
            STATUS=$(curl -s \
              -H "Authorization: token ${{ secrets.TEAX_TOKEN }}" \
              https://teax.example.com/api/repos/${{ github.repository }}/opencode/sessions/$SESSION_ID | jq -r '.status')
            
            if [ "$STATUS" = "completed" ]; then
              echo "AI review completed"
              break
            elif [ "$STATUS" = "failed" ]; then
              echo "AI review failed"
              exit 1
            fi
            
            sleep 5
          done
```

### API 端点

详见 [OpenCode 集成文档](./agent-system.md#opencode-api用于-cicd)

## Workflow 信息卡片

选中具体 workflow 时，在 runs 列表上方展示信息卡片：

| 信息项 | 数据来源 | 说明 |
| ------ | -------- | ---- |
| **触发方式** | YAML `on` 字段 | 蓝色圆角 badge（push / schedule / workflow_dispatch 等） |
| **输入参数数量** | YAML `on.workflow_dispatch.inputs` | 如 "3 个参数"（有参数时才显示） |
| **定时调度** | YAML `on.schedule[].cron` | 使用 `cronstrue` 库转为中文可读文本（如 "在 02:00, 仅在 星期一"），hover 显示原始 cron |
| **文件路径** | workflow `.path` 字段 | 等宽字体显示完整路径（Workflows API 返回格式 `.gitea/workflows/xxx.yaml`） |
| **描述** | YAML `x-description` 自定义扩展字段 | 可折叠显示，默认收起，点击"详情"展开 |

> **自定义扩展字段约定**：所有 Teax 自定义的 YAML 顶级字段使用 `x-` 前缀（如 `x-description`），以避免与标准 GitHub Actions / Gitea Actions 字段冲突。

## Workflow Run 卡片

每个 run 卡片包含以下信息：

```text
┌──────────────────────────────────────────────────────────────────┐
│  ✓  ci: 添加工作流描述信息  #508  [成功]                        ↗  │
│  📄 publish.yml  🌿 develop  9bcc505  [推送]  👤 liuhuan  🕐 5m  ⏱ 2m36s │
└──────────────────────────────────────────────────────────────────┘
```

### 卡片元素

- **左侧状态图标**：根据状态显示不同颜色图标（蓝色时钟=排队中、琥珀色旋转=运行中、绿色勾=成功、红色叉=失败、灰色禁止=已取消）
- **状态 badge**：中文标签（排队中/等待中/运行中/成功/失败/已取消/已跳过）
- **Workflow 文件名**：当未按 workflow 筛选时，显示 `filename.yml`（带后缀），从 `path` 字段解析
- **元信息行**：带图标装饰（workflow 文件名、git-branch 分支、user 用户、clock 相对时间、timer 耗时）
- **事件 badge**：中文化（push→推送、workflow_dispatch→手动触发、schedule→定时、pull_request→PR）
- **相对时间**：刚刚 / N 分钟前 / N 小时前 / N 天前（超 7 天显示日期）
- **耗时**：空值自动隐藏（不显示无意义的 "-"）
- 点击整个卡片跳转到 Run 详情页（`/:orgName/:projectName/actions/runs/:runId`）查看 Jobs 列表和日志

> **Gitea Workflow Runs API `path` 字段格式**：返回 `filename.yml@refs/heads/branch`（如 `publish.yml@refs/heads/main`），而非完整文件路径。解析 workflow 文件名需用 `@` 分隔取前半部分。Workflows 列表 API 的 `path` 字段则返回完整路径（如 `.gitea/workflows/publish.yml`）。

## 触发 Workflow 弹窗

- Workflow 下拉选项显示 `名称 — 描述`（有 `x-description` 时追加描述文案）
- 选中 workflow 后显示 `x-description` 描述信息
- 分支选择器 + 动态输入参数表单（根据 `workflow_dispatch.inputs` 生成）

## Workflow Run 状态映射

| Gitea status | Gitea conclusion | 中文标签 | 颜色 | 图标 |
| ------------ | ---------------- | -------- | ---- | ---- |
| `queued` | - | 排队中 | info(蓝) | clock |
| `waiting` | - | 等待中 | info(蓝) | clock |
| `running` / `in_progress` | - | 运行中 | warning(琥珀) | loader(旋转) |
| - | `success` | 成功 | success(绿) | check-circle |
| - | `failure` | 失败 | error(红) | x-circle |
| - | `cancelled` | 已取消 | neutral(灰) | ban |
| - | `skipped` | 已跳过 | - | skip-forward |

## Run 详情页

路由：`/:orgName/:projectName/actions/runs/:runId`

页面布局：左侧 Jobs 列表 + 右侧日志面板。

```text
┌─────────────────────────────────────────────────────────────┐
│  ← 返回 Actions                                             │
│  ci: 添加工作流描述信息  #508                                  │
│  🌿 develop  9bcc505  [推送]  👤 liuhuan                     │
├──────────────┬──────────────────────────────────────────────┤
│  Jobs        │  Job: build                                  │
│              │  ┌────────────────────────────────────────┐  │
│  ● build ✓   │  │ ▸ Set up job          Step 1           │  │
│              │  │ ▾ Checkout repository  Step 2           │  │
│              │  │   2026-03-06T06:28:02Z Getting Git...   │  │
│              │  │   2026-03-06T06:28:03Z git version...   │  │
│              │  │ ▸ [Post] Checkout repository  Step 3    │  │
│              │  └────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
```

### 后端 API

| API | 说明 |
| --- | --- |
| `GET /api/repos/:owner/:repo/actions/runs/:runId` | Run 详情（代理 Gitea API） |
| `GET /api/repos/:owner/:repo/actions/runs/:runId/jobs` | Jobs 列表（代理 Gitea API） |
| `GET /api/repos/:owner/:repo/actions/jobs/:jobId/logs` | Job 日志（纯文本，含 ANSI 转义码） |

### Step 解析逻辑

Gitea 1.25.4 Jobs API 返回 `steps: null`，因此 Step 折叠不依赖 API，而是从日志文本中解析：

- `⭐ Run Main <StepName>` → 新 Step（Main 阶段）
- `⭐ Run Post <StepName>` → 新 Step（Post 阶段，显示为 `[Post] StepName`）
- `⭐ Run Pre <StepName>` → 新 Step（Pre 阶段）
- `::group::<title>` / `::endgroup::` → 子分组标记（过滤掉，保留 title 文本）
- 首个 `⭐ Run` 之前的日志归入 "Set up job" Step

### 日志渲染

使用 `ansi-to-html` 将 ANSI 转义码转为 HTML，支持颜色高亮。

## Workflows API

`GET /api/orgs/{orgId}/projects/{projectId}/workflows`

### 返回字段

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

### 后端解析逻辑

- `extractTriggers(doc)` — 从 `on` 字段提取触发方式列表（支持 string / array / object keys 三种格式）
- `extractSchedules(doc)` — 从 `on.schedule[].cron` 提取 cron 表达式列表
- `extractInputs(doc)` — 从 `on.workflow_dispatch.inputs` 提取输入参数定义

## 相关文档

- [架构概览](./overview.md) - 系统整体架构
- [API 规范](./api-specification.md) - API 路径设计
- [飞书集成](./feishu-integration.md) - Workflow 通知推送
