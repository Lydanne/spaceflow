# 飞书集成指南

> Teax 飞书集成功能包括消息通知、机器人交互和审批流程三大模块。

## 目录

- [前置条件](#前置条件)
- [环境变量配置](#环境变量配置)
- [消息通知](#消息通知)
  - [通知类型](#通知类型)
  - [通知流程](#通知流程)
  - [通知偏好设置](#通知偏好设置)
- [飞书机器人](#飞书机器人)
  - [Webhook 配置](#webhook-配置)
  - [支持的指令](#支持的指令)
  - [权限校验](#权限校验)
- [审批流程](#审批流程)
  - [审批流程概览](#审批流程概览)
  - [创建审批](#创建审批)
  - [审批状态同步](#审批状态同步)
- [用户飞书绑定](#用户飞书绑定)
  - [绑定方式](#绑定方式)
  - [解绑操作](#解绑操作)
- [API 参考](#api-参考)
- [数据库表结构](#数据库表结构)
- [架构概览](#架构概览)

---

## 前置条件

1. **飞书开放平台应用**：在 [飞书开放平台](https://open.feishu.cn/) 创建企业自建应用
2. **应用权限**：
   - `im:message:send_as_bot` — 发送消息
   - `im:message` — 接收消息（机器人）
   - `approval:instance` — 审批流程（可选）
   - `contact:user.id:readonly` — 读取用户 ID
3. **事件订阅**：
   - `im.message.receive_v1` — 接收消息事件
   - `approval_instance` — 审批状态变更事件（可选）
4. **Gitea 实例**：已配置 Webhook 的 Gitea 仓库

---

## 环境变量配置

在 `.env` 文件或运行时环境中配置以下变量：

```bash
# ─── 飞书应用凭证（必需） ─────────────────────────
FEISHU_APP_ID=cli_xxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# ─── 飞书机器人安全验证（推荐） ───────────────────
# 事件订阅加密密钥（Encrypt Key）
FEISHU_ENCRYPT_KEY=your_encrypt_key
# 事件订阅验证令牌（Verification Token）
FEISHU_VERIFICATION_TOKEN=your_verification_token

# ─── 飞书审批（可选） ─────────────────────────────
# 审批定义 Code，在飞书管理后台创建审批流程后获取
FEISHU_APPROVAL_CODE=your_approval_code
```

对应 `nuxt.config.ts` 中的 `runtimeConfig`：

```ts
runtimeConfig: {
  feishuAppId: process.env.FEISHU_APP_ID || "",
  feishuAppSecret: process.env.FEISHU_APP_SECRET || "",
  feishuEncryptKey: process.env.FEISHU_ENCRYPT_KEY || "",
  feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN || "",
  feishuApprovalCode: process.env.FEISHU_APPROVAL_CODE || "",
}
```

---

## 消息通知

### 通知类型

| 类型 | 触发场景 | 卡片样式 |
|------|----------|----------|
| **构建通知** (`publish`) | Gitea Workflow Run 完成（成功/失败） | 绿色/红色卡片，含状态、分支、耗时、详情按钮 |
| **Push 通知** (`publish`) | Git Push 事件 | 蓝色卡片，含分支、提交列表、对比按钮 |
| **Agent 通知** (`agent`) | AI Agent 运行完成/失败 | 绿色/红色卡片，含 Agent 名称、Session ID、PR 链接 |
| **审批通知** (`approval`) | 审批结果变更（通过/拒绝） | 绿色/红色卡片，含标题、类型、状态 |
| **系统通知** (`system`) | 系统维护、版本更新（预留） | — |

### 通知流程

```text
Gitea Webhook ──▶ gitea.post.ts ──▶ notification.service.ts
                                          │
                                          ├─ getNotifyTargets(orgId, type)
                                          │    └─ 查找组织成员 → 过滤已绑定飞书 → 过滤启用通知
                                          │
                                          ├─ buildWorkflowRunCard() / buildPushCard()
                                          │
                                          └─ sendFeishuBatchMessage(targets, card)
                                               └─ Promise.allSettled（忽略单个失败）
```

**关键设计**：

- 通知发送是**异步非阻塞**的，不影响 Webhook 响应速度
- 使用 `Promise.allSettled` 批量发送，单个用户发送失败不影响其他用户
- 通知对象通过组织成员关系 + 飞书绑定 + 通知偏好三重过滤

### 通知偏好设置

每个用户可在 `/user/settings` 页面独立控制四种通知类型的开关：

| 偏好字段 | 说明 | 默认值 |
|----------|------|--------|
| `notify_publish` | 构建成功/失败 + Push 事件 | `true` |
| `notify_approval` | 审批请求和结果 | `true` |
| `notify_agent` | Agent 运行结果 | `true` |
| `notify_system` | 系统通知 | `false` |

**API**：`PATCH /api/user/notify-preferences`

```json
{
  "notify_publish": true,
  "notify_approval": true,
  "notify_agent": false,
  "notify_system": false
}
```

---

## 飞书机器人

### Webhook 配置

1. 在飞书开放平台 → 应用 → 事件订阅中，设置请求地址：

   ```
   https://your-teax-domain/api/webhooks/feishu
   ```

2. 飞书会发送 URL 验证请求（`type: url_verification`），Teax 自动响应 `challenge`

3. 配置 `FEISHU_ENCRYPT_KEY` 和 `FEISHU_VERIFICATION_TOKEN` 以启用安全验证

### 安全机制

- **Verification Token**：校验 `header.token` 字段
- **签名验证**：使用 `X-Lark-Signature` 头进行 SHA256 签名校验
- **事件去重**：内存缓存 `event_id`（5 分钟 TTL），防止重复处理

### 支持的指令

| 指令 | 别名 | 说明 | 示例 |
|------|------|------|------|
| `/help` | `帮助` | 查看所有可用指令 | `/help` |
| `/status <owner/repo>` | `状态` | 查询仓库最近 5 次构建状态 | `/status myorg/myrepo` |
| `/deploy <owner/repo> [branch] [workflow]` | `部署` | 触发 workflow_dispatch 部署 | `/deploy myorg/myrepo main deploy.yml` |
| `/rollback <owner/repo> [branch]` | `回滚` | 触发 rollback.yml 回滚 | `/rollback myorg/myrepo main` |
| `/list [orgName]` | `列表` | 列出已注册的仓库 | `/list myorg` |

**参数说明**：

- `owner/repo`：Gitea 仓库全名（必需）
- `branch`：目标分支，默认使用仓库的 default_branch
- `workflow`：Workflow 文件名，`/deploy` 默认 `deploy.yml`，`/rollback` 固定 `rollback.yml`

### 权限校验

所有指令执行前会进行以下校验：

1. **飞书绑定检查**：发送者的 `open_id` 必须已绑定 Teax 账号
2. **仓库注册检查**：目标仓库必须已在 Teax 中注册
3. **操作权限**：通过 Gitea Service Token 执行 workflow dispatch

未绑定飞书账号的用户会收到提示消息引导绑定。

---

## 审批流程

### 审批流程概览

```text
用户发起审批 ──▶ approval.service.ts
                    │
                    ├─ 创建 DB 记录（status: pending）
                    │
                    ├─ 调用飞书 API 创建审批实例
                    │    └─ 回写 feishu_instance_code
                    │
                    └─ 等待飞书审批回调
                         │
                         ▼
飞书审批回调 ──▶ feishu.post.ts
                    │
                    └─ handleFeishuApprovalEvent()
                         ├─ 查找本地记录
                         ├─ 更新 status（approved/rejected/cancelled）
                         └─ 通知请求者审批结果
```

### 创建审批

**API**：`POST /api/repos/{owner}/{repo}/approvals`

```json
{
  "type": "deploy",
  "title": "生产环境部署审批",
  "description": "部署 v1.2.3 到生产环境",
  "metadata": {
    "branch": "main",
    "workflow": "deploy.yml",
    "commit_sha": "abc1234"
  }
}
```

**审批类型**：

| 类型 | 说明 |
|------|------|
| `deploy` | 部署审批 |
| `rollback` | 回滚审批 |
| `custom` | 自定义审批 |

### 审批状态同步

审批状态通过两种方式同步：

1. **飞书事件回调**（实时）：飞书审批状态变更时自动推送到 `/api/webhooks/feishu`
2. **主动查询**（按需）：调用 `syncApprovalStatus(approvalId)` 从飞书 API 拉取最新状态

| 飞书状态 | Teax 状态 |
|----------|-----------|
| `PENDING` | `pending` |
| `APPROVED` | `approved` |
| `REJECTED` | `rejected` |
| `CANCELED` / `DELETED` | `cancelled` |

---

## 用户飞书绑定

### 绑定方式

1. 导航到 `/user/settings` 页面
2. 在「飞书绑定」卡片中点击「绑定飞书账号」
3. 跳转飞书 OAuth 授权页面完成认证
4. 绑定成功后可配置通知偏好

**也可以通过飞书登录隐式绑定**：在登录页选择「使用飞书登录」，如果飞书账号已关联 Gitea 用户，会自动完成绑定。

### 解绑操作

- 在 `/user/settings` 页面点击「解绑飞书」
- 解绑后将无法通过飞书登录或接收飞书通知

**API**：`DELETE /api/user/feishu-binding`

---

## API 参考

### 用户相关

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/user/feishu-binding` | 获取当前用户的飞书绑定状态和通知偏好 |
| `DELETE` | `/api/user/feishu-binding` | 解绑飞书账号 |
| `PATCH` | `/api/user/notify-preferences` | 更新通知偏好设置 |

### 审批相关

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/repos/{owner}/{repo}/approvals` | 获取仓库审批列表（可按 `?status=pending` 过滤） |
| `POST` | `/api/repos/{owner}/{repo}/approvals` | 创建审批请求 |

### Webhook 接收

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/webhooks/gitea` | Gitea Webhook（push + workflow_run 事件） |
| `POST` | `/api/webhooks/feishu` | 飞书事件回调（消息 + 审批事件） |

---

## 数据库表结构

### user_feishu（飞书绑定）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 关联 users 表 |
| `feishu_open_id` | VARCHAR | 飞书 Open ID |
| `feishu_union_id` | VARCHAR | 飞书 Union ID |
| `feishu_name` | VARCHAR | 飞书用户名 |
| `feishu_avatar` | VARCHAR | 飞书头像 URL |
| `access_token` | VARCHAR | OAuth access_token |
| `token_expires_at` | TIMESTAMP | Token 过期时间 |
| `notify_publish` | BOOLEAN | 构建通知开关（默认 true） |
| `notify_approval` | BOOLEAN | 审批通知开关（默认 true） |
| `notify_agent` | BOOLEAN | Agent 通知开关（默认 true） |
| `notify_system` | BOOLEAN | 系统通知开关（默认 false） |

### approval_requests（审批记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `organization_id` | UUID | 所属组织 |
| `repository_id` | UUID | 关联仓库（可空） |
| `requester_id` | UUID | 发起人 |
| `type` | VARCHAR | 审批类型（deploy/rollback/custom） |
| `status` | VARCHAR | 审批状态（pending/approved/rejected/cancelled） |
| `feishu_instance_code` | VARCHAR | 飞书审批实例 Code |
| `title` | VARCHAR | 审批标题 |
| `description` | TEXT | 审批描述 |
| `metadata` | JSONB | 关联信息（branch、workflow 等） |
| `approver_open_id` | VARCHAR | 审批人飞书 Open ID |
| `approver_comment` | TEXT | 审批人备注 |

---

## 架构概览

```text
┌─────────────────────────────────────────────────────────────────┐
│                          Teax Server                            │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │  gitea.post.ts  │    │ feishu.post.ts  │    │  User API  │  │
│  │  (Webhook 接收) │    │ (事件回调接收)  │    │  (绑定/偏好)│  │
│  └───────┬─────────┘    └───────┬─────────┘    └────────────┘  │
│          │                      │                               │
│          ▼                      ▼                               │
│  ┌───────────────────┐  ┌──────────────────┐                   │
│  │ notification      │  │ bot-command      │                   │
│  │ .service.ts       │  │ .service.ts      │                   │
│  │                   │  │                  │                   │
│  │ • 构建卡片        │  │ • /help          │                   │
│  │ • 查找通知对象    │  │ • /status        │                   │
│  │ • 批量发送        │  │ • /deploy        │                   │
│  └───────┬───────────┘  │ • /rollback      │                   │
│          │              │ • /list           │                   │
│          │              └────────┬─────────┘                   │
│          │                       │                              │
│          ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                   │
│  │           feishu.ts (Utils)             │                   │
│  │                                         │                   │
│  │ • tenant_access_token 缓存              │                   │
│  │ • sendMessage / sendCardMessage         │                   │
│  │ • replyMessage / replyCardMessage       │                   │
│  │ • sendBatchMessage                      │                   │
│  │ • createApprovalInstance                │                   │
│  │ • getApprovalInstance                   │                   │
│  │ • verifyEventSignature                  │                   │
│  └──────────────────┬──────────────────────┘                   │
│                     │                                           │
│                     ▼                                           │
│            飞书 Open API                                        │
│            https://open.feishu.cn/open-apis                     │
└─────────────────────────────────────────────────────────────────┘
```

### 文件清单

```
server/
├── utils/
│   └── feishu.ts                          # 飞书 API 封装（token/消息/审批/验证）
├── services/
│   ├── feishu.service.ts                  # 飞书用户绑定 DB 操作
│   ├── notification.service.ts            # 通知编排（卡片构建 + 对象查找 + 发送）
│   ├── bot-command.service.ts             # 机器人指令解析和执行
│   └── approval.service.ts               # 审批流程（创建 + 同步 + 回调）
├── api/
│   ├── webhooks/
│   │   ├── gitea.post.ts                  # Gitea Webhook（push + workflow_run）
│   │   └── feishu.post.ts                 # 飞书事件回调（消息 + 审批）
│   ├── user/
│   │   ├── feishu-binding.get.ts          # 获取飞书绑定状态
│   │   ├── feishu-binding.delete.ts       # 解绑飞书
│   │   └── notify-preferences.patch.ts    # 更新通知偏好
│   └── repos/[owner]/[repo]/
│       └── approvals/
│           ├── index.get.ts               # 审批列表
│           └── index.post.ts              # 创建审批
├── db/schema/
│   └── approval.ts                        # approval_requests 表定义
└── shared/dto/
    ├── user.dto.ts                        # updateNotifyPreferencesBodySchema
    └── approval.dto.ts                    # createApprovalBodySchema

app/pages/
└── user/
    └── settings.vue                       # 用户设置页（飞书绑定 + 通知偏好）
```
