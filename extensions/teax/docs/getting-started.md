# Teax 快速开始指南

欢迎使用 Teax！本指南将帮助你快速上手 Teax 系统，从安装到使用核心功能。

## 📋 目录

- [开始之前](#开始之前)
- [本地开发环境搭建](#本地开发环境搭建)
- [首次登录](#首次登录)
- [基础功能使用](#基础功能使用)
- [常见问题](#常见问题)

## 开始之前

### 你需要准备

1. **Gitea 实例**
   - 如果还没有 Gitea，可以参考 [Gitea 官方文档](https://docs.gitea.io/zh-cn/install-from-binary/) 快速安装
   - 确保你有 Gitea 管理员权限（用于创建 OAuth 应用）

2. **开发环境**
   - Node.js >= 20.x
   - pnpm >= 9.x
   - PostgreSQL >= 16.x
   - Redis >= 7.x

3. **飞书企业账号**（可选）
   - 如果需要使用消息通知和机器人功能
   - 需要有创建企业自建应用的权限

### 了解 Teax

Teax 是 Gitea 的功能扩展平台，主要提供：

- **CI/CD 增强** - 可视化 Workflow 管理和实时日志
- **权限管理** - 细粒度的仓库访问控制
- **飞书集成** - 消息通知、机器人指令、审批流程
- **团队协作** - 组织和团队管理

## 本地开发环境搭建

### 步骤 1: 克隆项目

```bash
# 克隆仓库
git clone <repository-url>
cd spaceflow/extensions/teax
```

### 步骤 2: 安装依赖

```bash
# 使用 pnpm 安装依赖
pnpm install
```

### 步骤 3: 启动数据库服务

**方式 1: 使用 Docker Compose（推荐）**

```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d

# 查看服务状态
docker-compose ps
```

**方式 2: 手动安装**

如果你已经有本地的 PostgreSQL 和 Redis：

```bash
# 启动 PostgreSQL
sudo systemctl start postgresql

# 启动 Redis
sudo systemctl start redis

# 创建数据库
createdb teax
```

### 步骤 4: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
vim .env
```

**最小配置示例：**

```env
# 应用配置
NUXT_PUBLIC_APP_NAME=Teax Dev
NUXT_PUBLIC_APP_URL=http://localhost:3000

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teax

# Redis
REDIS_URL=redis://localhost:6379

# Gitea OAuth（需要先在 Gitea 中创建 OAuth 应用）
GITEA_URL=http://localhost:3001
GITEA_CLIENT_ID=your-client-id
GITEA_CLIENT_SECRET=your-client-secret
GITEA_SERVICE_TOKEN=your-service-token

# Session 密钥（至少 32 字符）
NUXT_SESSION_PASSWORD=development-session-password-at-least-32-chars
```

> 💡 **提示**: 详细的配置说明请查看 [配置指南](./configuration.md)

### 步骤 5: 配置 Gitea OAuth

在启动 Teax 之前，需要在 Gitea 中创建 OAuth 应用：

1. **登录 Gitea**
   - 使用管理员账号登录

2. **创建 OAuth 应用**
   - 进入：设置 → 应用 → 管理 OAuth2 应用程序
   - 点击"创建新的 OAuth2 应用程序"

3. **填写应用信息**
   ```
   应用名称: Teax
   重定向 URI: http://localhost:3000/api/auth/callback/gitea
   ```

4. **保存凭证**
   - 复制 `Client ID` 和 `Client Secret`
   - 填入 `.env` 文件的 `GITEA_CLIENT_ID` 和 `GITEA_CLIENT_SECRET`

5. **创建服务令牌**
   - 在 Gitea 设置中进入"应用" → "访问令牌"
   - 点击"生成新令牌"
   - 令牌名称：`Teax Service`
   - 选择权限：
     - ✅ `repo` - 仓库访问
     - ✅ `admin:org` - 组织管理
     - ✅ `admin:repo_hook` - Webhook 管理
   - 复制生成的令牌到 `.env` 的 `GITEA_SERVICE_TOKEN`

### 步骤 6: 初始化数据库

```bash
# 推送数据库 schema（开发环境）
pnpm db:push

# 或者使用迁移（生产环境推荐）
pnpm db:generate
pnpm db:migrate
```

### 步骤 7: 启动开发服务器

```bash
# 启动 Nuxt 开发服务器
pnpm dev
```

服务器启动后，访问 http://localhost:3000

## 首次登录

### 使用 Gitea 账号登录

1. **访问登录页面**
   - 打开 http://localhost:3000
   - 点击"使用 Gitea 登录"

2. **授权 Teax**
   - 在 Gitea 授权页面点击"授权"
   - 首次登录会自动创建 Teax 账号

3. **登录成功**
   - 自动跳转到 Teax 首页
   - 显示你在 Gitea 中的组织列表

### 设置管理员

首次部署时，需要手动设置管理员：

```bash
# 进入数据库
psql teax

# 设置用户为管理员（替换 user_id）
UPDATE users SET is_admin = true WHERE id = 'your-user-id';
```

或使用 Drizzle Studio：

```bash
# 打开 Drizzle Studio
pnpm db:studio

# 在 users 表中找到你的用户，将 is_admin 设置为 true
```

## 基础功能使用

### 1. 同步组织

首次使用需要同步 Gitea 组织数据：

1. **进入管理后台**
   - 点击右上角头像 → "管理后台"
   - 进入"组织管理"

2. **同步组织**
   - 点击"同步组织"按钮
   - 系统会从 Gitea 同步组织、团队和成员信息

3. **查看同步结果**
   - 同步完成后可以看到组织列表
   - 包含团队数量、成员数量等统计信息

### 2. 创建项目

项目是 Teax 中管理 Gitea 仓库的单位：

1. **选择组织**
   - 在首页点击组织卡片
   - 或通过侧边栏进入组织

2. **创建项目**
   - 点击"新建项目"按钮
   - 选择要绑定的 Gitea 仓库
   - 填写项目信息

3. **配置 Webhook**
   - 创建项目时会自动在 Gitea 仓库中注册 Webhook
   - 用于接收 Push、Workflow Run 等事件

### 3. 查看 Workflow

1. **进入项目详情**
   - 点击项目卡片进入详情页
   - 默认显示 Actions Tab

2. **查看 Workflow 列表**
   - 显示仓库中所有的 Workflow 文件
   - 包含最近运行状态和时间

3. **手动触发 Workflow**
   - 点击 Workflow 卡片的"运行"按钮
   - 选择分支
   - 填写输入参数（如果有）
   - 点击"触发运行"

4. **查看运行日志**
   - 点击运行记录查看详情
   - 实时显示 ANSI 彩色日志
   - 支持展开/折叠步骤

### 4. 配置权限

Teax 使用权限组管理仓库访问：

1. **进入权限管理**
   - 管理后台 → 组织详情 → 权限管理

2. **创建权限组**
   - 点击"新建权限组"
   - 填写权限组名称
   - 选择权限：
     - `repo:view` - 查看仓库
     - `repo:create` - 创建仓库
     - `actions:view` - 查看 Actions
     - `actions:trigger` - 触发 Workflow
   - 选择仓库范围（全部或指定仓库）

3. **分配权限组**
   - 在团队列表中点击"分配权限"
   - 选择要分配的权限组
   - 保存

### 5. 配置通知规则

为项目配置飞书消息通知：

1. **进入项目设置**
   - 项目详情 → 设置 Tab

2. **配置通知规则**
   - 在"通知设置"区域点击"添加规则"
   - 选择事件类型：
     - `workflow_run` - Workflow 运行
     - `push` - 代码推送
   - 设置过滤条件：
     - 分支匹配（支持通配符）
     - Workflow 文件匹配
   - 选择通知目标：
     - 飞书群聊 ID
     - 或使用组织默认通知

3. **测试通知**
   - 保存后触发一次 Workflow
   - 检查飞书群是否收到通知

## 常见问题

### Q: 登录失败，提示 OAuth 错误

**A:** 检查以下几点：
1. Gitea OAuth 应用的回调地址是否正确
2. `.env` 中的 `GITEA_CLIENT_ID` 和 `GITEA_CLIENT_SECRET` 是否正确
3. Gitea 实例是否可以访问 Teax（网络连通性）

### Q: 同步组织时报错

**A:** 确认：
1. `GITEA_SERVICE_TOKEN` 是否有效
2. 令牌是否有 `admin:org` 权限
3. 检查 Gitea API 是否可访问

### Q: Webhook 没有触发

**A:** 排查步骤：
1. 检查 Gitea 仓库设置中是否有 Webhook
2. 查看 Webhook 推送日志是否有错误
3. 确认 Teax 的 Webhook 接收地址可以从 Gitea 访问
4. 检查 Teax 日志：`docker-compose logs -f teax`

### Q: 数据库连接失败

**A:** 检查：
1. PostgreSQL 是否正在运行：`docker-compose ps`
2. 数据库连接字符串是否正确
3. 数据库用户是否有权限

### Q: Redis 连接失败

**A:** 检查：
1. Redis 是否正在运行
2. Redis 连接字符串是否正确
3. 如果设置了密码，确认密码正确

### Q: 飞书通知收不到

**A:** 确认：
1. 飞书应用配置是否正确
2. 飞书应用是否已发布
3. 用户是否已绑定飞书账号
4. 通知规则是否配置正确
5. 检查飞书开放平台的事件推送日志

## 下一步

现在你已经完成了基础设置，可以：

1. **探索更多功能**
   - 查看 [架构概览](./overview.md) 了解系统设计
   - 阅读 [权限系统](./permission-system.md) 深入理解权限模型
   - 学习 [飞书集成](./feishu-integration.md) 配置高级功能

2. **准备生产部署**
   - 阅读 [配置指南](./configuration.md) 了解所有配置选项
   - 查看 [部署指南](./deployment.md) 准备生产环境

3. **参与开发**
   - 查看 [API 规范](./api-specification.md) 了解 API 设计
   - 阅读 [CI/CD 集成](./cicd-integration.md) 了解 Workflow 集成

## 获取帮助

如果遇到问题：

1. 查看 [故障排查](./deployment.md#故障排查) 章节
2. 查看项目 Issues
3. 加入社区讨论

祝你使用愉快！🎉
