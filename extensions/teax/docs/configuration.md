# Teax 配置指南

本文档详细说明了 Teax 系统的所有配置选项和环境变量。

## 📋 目录

- [环境变量](#环境变量)
- [Gitea 配置](#gitea-配置)
- [飞书配置](#飞书配置)
- [数据库配置](#数据库配置)
- [Session 配置](#session-配置)
- [高级配置](#高级配置)

## 环境变量

Teax 使用环境变量进行配置。所有配置都可以通过 `.env` 文件或系统环境变量设置。

### 基础配置

```env
# 应用名称（显示在页面标题和通知中）
NUXT_PUBLIC_APP_NAME=Teax

# 应用访问地址（用于生成回调 URL 和通知链接）
NUXT_PUBLIC_APP_URL=http://localhost:3000
```

**说明：**
- `NUXT_PUBLIC_APP_NAME`: 应用显示名称，会出现在浏览器标题、飞书通知等位置
- `NUXT_PUBLIC_APP_URL`: 应用的完整访问地址，**生产环境必须使用 HTTPS**

### 数据库配置

```env
# PostgreSQL 连接字符串
DATABASE_URL=postgresql://username:password@host:port/database
```

**连接字符串格式：**
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?[参数]
```

**示例：**
```env
# 本地开发
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teax

# 生产环境（带 SSL）
DATABASE_URL=postgresql://teax_user:strong_password@db.example.com:5432/teax_prod?sslmode=require

# 使用连接池
DATABASE_URL=postgresql://teax_user:password@localhost:5432/teax?pool_timeout=30&connection_limit=10
```

**常用参数：**
- `sslmode=require` - 强制使用 SSL 连接
- `pool_timeout=30` - 连接池超时时间（秒）
- `connection_limit=10` - 最大连接数

### Redis 配置

```env
# Redis 连接字符串
REDIS_URL=redis://host:port
```

**连接字符串格式：**
```
redis://[:密码@]主机:端口[/数据库编号]
```

**示例：**
```env
# 本地开发（无密码）
REDIS_URL=redis://localhost:6379

# 生产环境（带密码）
REDIS_URL=redis://:strong_redis_password@redis.example.com:6379

# 使用特定数据库
REDIS_URL=redis://:password@localhost:6379/1

# Redis Sentinel
REDIS_URL=redis-sentinel://sentinel1:26379,sentinel2:26379/mymaster
```

**用途：**
- Session 存储
- 缓存
- 消息队列（未来）

## Gitea 配置

### OAuth 应用配置

```env
# Gitea 实例地址
GITEA_URL=https://gitea.example.com

# OAuth 客户端 ID
GITEA_CLIENT_ID=your-gitea-client-id

# OAuth 客户端密钥
GITEA_CLIENT_SECRET=your-gitea-client-secret

# Gitea 服务令牌（用于 API 调用）
GITEA_SERVICE_TOKEN=your-gitea-service-token
```

### 创建 OAuth 应用

1. **登录 Gitea 管理员账号**

2. **进入应用管理**
   - 点击右上角头像 → 设置
   - 左侧菜单选择 "应用"
   - 点击 "管理 OAuth2 应用程序"

3. **创建新应用**
   - 应用名称：`Teax`
   - 重定向 URI：`https://your-domain.com/api/auth/callback/gitea`
   - 保存后获得 `Client ID` 和 `Client Secret`

4. **创建服务令牌**
   - 在 "应用" 页面选择 "访问令牌"
   - 点击 "生成新令牌"
   - 令牌名称：`Teax Service`
   - 选择权限：
     - `repo` - 仓库访问
     - `admin:org` - 组织管理
     - `admin:repo_hook` - Webhook 管理
   - 保存后获得 `Service Token`

### Webhook 配置

**重要说明：** Teax 的 **Action 成功推送** 功能依赖 Gitea Webhook。当你在 Teax 中创建项目时，系统会自动在对应的 Gitea 仓库中注册 Webhook。

#### Webhook 生命周期管理

**何时创建 Webhook？**

Webhook 在以下时机**自动创建**：

1. **创建项目时**
   - 在 Teax 中点击"新建项目"并选择 Gitea 仓库
   - 提交创建表单后，Teax 立即执行以下操作：
     - 使用 `GITEA_SERVICE_TOKEN` 调用 Gitea API
     - 在选中的仓库中创建 Webhook
     - Webhook URL: `https://your-teax-domain.com/api/webhooks/gitea`
     - 自动生成随机的 Webhook 密钥（32字节）
     - 订阅所有事件 (`*`)
     - 将 Webhook ID 和密钥保存到 Teax 数据库

2. **创建流程**
   ```
   用户点击"新建项目" 
   → 选择 Gitea 仓库
   → Teax 验证仓库未被绑定
   → 调用 Gitea API 创建 Webhook
   → 保存项目信息到数据库
   → 创建完成
   ```

**何时删除 Webhook？**

Webhook 在以下时机**自动删除**：

1. **删除项目时**
   - 在 Teax 项目设置中点击"删除项目"
   - 确认删除后，Teax 执行以下操作：
     - 使用 `GITEA_SERVICE_TOKEN` 调用 Gitea API
     - 删除仓库中的 Webhook（使用保存的 webhook_id）
     - 从 Teax 数据库中删除项目记录
     - 删除相关的通知规则和配置

2. **删除流程**
   ```
   用户点击"删除项目"
   → 确认删除操作
   → Teax 调用 Gitea API 删除 Webhook
   → 删除数据库中的项目记录
   → 删除完成
   ```

**重要说明：**

- ✅ **完全自动化** - 你不需要手动在 Gitea 中创建或删除 Webhook
- ✅ **幂等性** - 如果 Webhook 创建失败，项目仍会创建，但不会收到事件通知
- ✅ **清理保证** - 删除项目时会自动清理 Gitea 中的 Webhook，不会留下垃圾数据
- ⚠️ **权限要求** - `GITEA_SERVICE_TOKEN` 必须有 `admin:repo_hook` 权限

2. **订阅的事件**

   Teax 自动订阅以下所有 Gitea 事件类型：

   - **仓库事件**: `create`、`delete`、`fork`、`push`
   - **Issues 事件**: `issues`、`issue_assign`、`issue_label`、`issue_milestone`、`issue_comment`
   - **Pull Request 事件**: `pull_request`、`pull_request_assign`、`pull_request_label`、`pull_request_milestone`、`pull_request_comment`、`pull_request_review_approved`、`pull_request_review_rejected`、`pull_request_review_comment`、`pull_request_sync`
   - **工作流事件**: `status`、`workflow_run`、`workflow_job`（**Actions 推送的关键**）
   - **其他事件**: `wiki`、`repository`、`release`、`package`

   在 Teax 内部通过配置控制实际处理哪些事件

3. **Webhook 触发流程**
   ```text
   Gitea 事件触发（如 Workflow 完成）
   → Gitea 发送事件到 Teax Webhook
   → Teax 验证 HMAC-SHA256 签名
   → 根据事件类型和配置决定是否处理
   → 匹配通知规则
   → 发送飞书卡片通知
   ```

#### 必需条件

要让 Webhook 正常工作，需要确保：

1. **网络连通性**
   - Gitea 必须能够访问 Teax 的 Webhook 接收地址
   - 如果 Teax 在内网，确保 Gitea 可以访问（同一内网或配置端口转发）
   - **生产环境强烈建议使用公网域名和 HTTPS**

2. **服务令牌权限**
   - `GITEA_SERVICE_TOKEN` 必须有 `admin:repo_hook` 权限
   - 用于自动创建和管理 Webhook

3. **Webhook 密钥验证**
   - Teax 会自动生成 Webhook 密钥并保存到数据库
   - 每次接收 Webhook 时使用 HMAC-SHA256 验证签名
   - 防止伪造的 Webhook 请求

#### 手动检查 Webhook

如果 Action 推送不工作，可以手动检查：

1. **在 Gitea 仓库中查看 Webhook**
   - 进入仓库 → 设置 → Webhooks
   - 应该能看到一个指向 Teax 的 Webhook
   - URL 格式：`https://your-teax-domain.com/api/webhooks/gitea`

2. **查看 Webhook 推送历史**
   - 点击 Webhook 查看推送记录
   - 检查是否有推送失败的记录
   - 查看失败原因（网络超时、签名验证失败等）

3. **测试 Webhook**
   - 在 Webhook 详情页点击"测试推送"
   - 选择 `workflow_run` 事件类型
   - 查看 Teax 日志确认是否收到

#### 常见问题

**Q: 创建项目后没有自动创建 Webhook？**

A: 检查：
- `GITEA_SERVICE_TOKEN` 是否配置正确
- 令牌是否有 `admin:repo_hook` 权限
- Teax 日志中是否有创建 Webhook 的错误信息

**Q: Webhook 推送失败？**

A: 检查：
- Gitea 是否能访问 Teax（网络连通性）
- Teax 的 Webhook 接收地址是否正确
- 查看 Gitea Webhook 推送日志中的错误信息

**Q: 收到 Webhook 但没有飞书通知？**

A: 检查：
- 项目是否配置了通知规则或飞书群聊 ID
- 通知规则是否匹配（分支、Workflow 文件名）
- 飞书应用配置是否正确
- Teax 日志中是否有发送通知的错误

## 飞书配置

飞书集成是**可选的**，如果不配置飞书，系统仍可正常使用，只是无法使用消息通知和机器人功能。

### 应用配置

```env
# 飞书应用 ID
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx

# 飞书应用密钥
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 飞书加密密钥（用于 Webhook 事件解密）
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 飞书验证令牌（用于 Webhook URL 验证）
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 飞书审批定义 Code（可选，用于审批流程）
FEISHU_APPROVAL_CODE=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 创建飞书应用

1. **登录飞书开放平台**
   - 访问 https://open.feishu.cn/
   - 使用企业管理员账号登录

2. **创建企业自建应用**
   - 点击 "创建企业自建应用"
   - 填写应用名称：`Teax`
   - 上传应用图标
   - 填写应用描述

3. **配置应用权限**

   进入应用详情 → 权限管理，添加以下权限：

   **消息与群组**
   - `im:message` - 获取与发送单聊、群组消息
   - `im:message.group_at_msg` - 获取群组中所有消息（用于 @ 机器人）
   - `im:message.p2p_msg` - 获取用户发给机器人的单聊消息
   - `im:message:send_as_bot` - 以应用的身份发消息

   **通讯录**
   - `contact:user.base` - 获取用户基本信息
   - `contact:user.email` - 获取用户邮箱信息

   **审批**（可选）
   - `approval:approval` - 审批流程管理

4. **配置事件订阅**

   进入应用详情 → 事件订阅，选择以下**任一**模式：

   **方式一：长连接模式（推荐）**
   - 优势：无需公网 IP、本地开发友好、实时性更强
   - 配置步骤：
     1. 选择 "订阅方式" → "使用长连接接收事件/回调"
     2. 订阅以下事件：
        - `im.message.receive_v1` - 接收消息（用于机器人指令）
        - `card.action.trigger` - 卡片交互
        - `approval_instance` - 审批事件（可选）
     3. 无需配置请求地址，Teax 启动时会自动建立长连接

   **方式二：Webhook 模式（传统）**
   - 优势：支持多实例部署、易于审计
   - 配置步骤：
     1. 选择 "订阅方式" → "请求网址配置"
     2. 请求地址：`https://your-domain.com/api/webhooks/feishu`
     3. 加密策略：选择 "加密"
     4. 复制 `Encrypt Key` 和 `Verification Token` 到环境变量
     5. 订阅相同的事件（同上）
     6. 禁用长连接：设置环境变量 `FEISHU_LONGCONNECTION_DISABLED=true`

   > 💡 **建议**：开发环境使用长连接，生产环境根据部署架构选择

5. **获取凭证**
   - 进入应用详情 → 凭证与基础信息
   - 复制 `App ID` 和 `App Secret` 到环境变量

6. **发布应用**
   - 进入应用详情 → 版本管理与发布
   - 创建版本并提交审核
   - 审核通过后发布到企业

### 审批流程配置（可选）

如果需要使用审批功能：

1. **创建审批定义**
   - 登录飞书管理后台
   - 进入 "工作台" → "审批"
   - 创建自定义审批流程

2. **配置审批表单**
   
   添加以下字段：
   - `title` - 单行文本 - 审批标题
   - `description` - 多行文本 - 审批描述
   - `type` - 单行文本 - 审批类型（deploy/rollback/custom）
   - `approval_id` - 单行文本 - Teax 审批 ID

3. **获取审批 Code**
   - 在审批定义页面复制 "审批定义 Code"
   - 填入 `FEISHU_APPROVAL_CODE` 环境变量

## Session 配置

```env
# Session 加密密钥（必需，至少 32 字符）
NUXT_SESSION_PASSWORD=at-least-32-characters-long-secret-key!!
```

**重要说明：**
- 密钥长度必须 >= 32 字符
- 使用强随机字符串
- **生产环境必须更改默认值**
- 更改密钥会使所有现有 Session 失效

**生成强密钥：**

```bash
# 使用 OpenSSL
openssl rand -base64 32

# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 高级配置

### 日志配置

```env
# 日志级别（development/production）
NODE_ENV=production

# Nuxt 日志级别
NUXT_LOG_LEVEL=info
```

### 性能优化

```env
# 数据库连接池大小
DATABASE_POOL_SIZE=10

# Redis 连接池大小
REDIS_POOL_SIZE=10

# API 请求超时（毫秒）
API_TIMEOUT=30000
```

### 安全配置

```env
# CORS 允许的源（逗号分隔）
CORS_ORIGINS=https://example.com,https://app.example.com

# 信任的代理数量（用于获取真实 IP）
TRUSTED_PROXY_COUNT=1

# 启用 HTTPS 强制重定向
FORCE_HTTPS=true
```

## 配置文件示例

### 开发环境 (.env.development)

```env
# 基础配置
NUXT_PUBLIC_APP_NAME=Teax Dev
NUXT_PUBLIC_APP_URL=http://localhost:3000

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teax_dev

# Redis
REDIS_URL=redis://localhost:6379

# Gitea
GITEA_URL=http://localhost:3001
GITEA_CLIENT_ID=dev-client-id
GITEA_CLIENT_SECRET=dev-client-secret
GITEA_SERVICE_TOKEN=dev-service-token

# Session
NUXT_SESSION_PASSWORD=development-session-password-32-chars-min

# 飞书（可选）
FEISHU_APP_ID=
FEISHU_APP_SECRET=
```

### 生产环境 (.env.production)

```env
# 基础配置
NUXT_PUBLIC_APP_NAME=Teax
NUXT_PUBLIC_APP_URL=https://teax.example.com

# 数据库（使用 SSL）
DATABASE_URL=postgresql://teax_user:STRONG_PASSWORD@db.example.com:5432/teax_prod?sslmode=require

# Redis（使用密码）
REDIS_URL=redis://:STRONG_REDIS_PASSWORD@redis.example.com:6379

# Gitea
GITEA_URL=https://gitea.example.com
GITEA_CLIENT_ID=prod-client-id
GITEA_CLIENT_SECRET=prod-client-secret
GITEA_SERVICE_TOKEN=prod-service-token

# Session（强密钥）
NUXT_SESSION_PASSWORD=GENERATE_A_STRONG_RANDOM_KEY_AT_LEAST_32_CHARS

# 飞书
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_APPROVAL_CODE=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 性能优化
DATABASE_POOL_SIZE=20
REDIS_POOL_SIZE=20

# 安全
NODE_ENV=production
FORCE_HTTPS=true
TRUSTED_PROXY_COUNT=1
```

## 配置验证

启动应用前，可以验证配置是否正确：

```bash
# 检查环境变量
pnpm run env:check

# 测试数据库连接
pnpm run db:test

# 测试 Redis 连接
pnpm run redis:test

# 测试 Gitea 连接
pnpm run gitea:test

# 测试飞书连接（如果配置了）
pnpm run feishu:test
```

## 故障排查

### 数据库连接失败

**错误：** `ECONNREFUSED` 或 `connection refused`

**解决方案：**
1. 检查 PostgreSQL 是否运行：`pg_isready`
2. 检查连接字符串格式
3. 检查防火墙设置
4. 检查 PostgreSQL 监听地址（`postgresql.conf` 中的 `listen_addresses`）

### Redis 连接失败

**错误：** `ECONNREFUSED` 或 `Redis connection failed`

**解决方案：**
1. 检查 Redis 是否运行：`redis-cli ping`
2. 检查连接字符串格式
3. 检查 Redis 密码配置
4. 检查防火墙设置

### Gitea OAuth 失败

**错误：** `OAuth callback failed` 或 `Invalid client`

**解决方案：**
1. 检查 `GITEA_CLIENT_ID` 和 `GITEA_CLIENT_SECRET` 是否正确
2. 检查回调 URL 是否匹配：`{NUXT_PUBLIC_APP_URL}/api/auth/callback/gitea`
3. 检查 Gitea 是否可以访问 Teax
4. 检查 Gitea OAuth 应用是否启用

### 飞书 Webhook 失败

**错误：** `Webhook verification failed` 或 `Decrypt failed`

**解决方案：**
1. 检查 `FEISHU_ENCRYPT_KEY` 和 `FEISHU_VERIFICATION_TOKEN` 是否正确
2. 检查 Webhook URL 是否可以从公网访问
3. 检查飞书应用是否已发布
4. 查看飞书开放平台的事件推送日志

## 最佳实践

1. **使用环境变量管理工具**
   - 开发：使用 `.env` 文件
   - 生产：使用 Docker secrets、Kubernetes secrets 或云服务的密钥管理

2. **定期轮换密钥**
   - Session 密钥：每季度更换
   - API 令牌：每半年更换
   - 数据库密码：每年更换

3. **使用强密码**
   - 长度 >= 32 字符
   - 包含大小写字母、数字和特殊字符
   - 不使用字典单词

4. **分离环境配置**
   - 开发、测试、生产使用不同的配置
   - 不要在代码仓库中提交 `.env` 文件
   - 使用 `.env.example` 作为配置模板

5. **监控和告警**
   - 监控数据库连接数
   - 监控 Redis 内存使用
   - 设置 API 调用失败告警

## 相关文档

- [快速开始](../README.md#快速开始)
- [部署指南](./DEPLOYMENT.md)
- [架构概览](./overview.md)
