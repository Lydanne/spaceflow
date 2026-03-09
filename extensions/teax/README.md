# Teax

> Gitea 功能扩展平台 + 飞书控制与消息交互

[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt&labelColor=020420)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&labelColor=020420)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&labelColor=020420)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&labelColor=020420)](https://redis.io/)

Teax 是一个基于 Nuxt 4 构建的全栈应用，为 Gitea 提供功能扩展，并通过飞书实现消息通知、机器人指令和审批流程等企业级协作功能。

## ✨ 核心特性

### 🔐 统一认证与权限
- **Gitea OAuth 登录** - 使用 Gitea 账号作为主账号
- **飞书 OAuth 登录** - 支持飞书账号登录并关联 Gitea
- **细粒度权限控制** - 基于权限组的仓库级访问控制
- **团队同步** - 自动同步 Gitea 组织和团队结构

### 🚀 CI/CD 增强
- **Gitea Actions 集成** - 可视化 Workflow 管理和执行
- **实时日志查看** - ANSI 彩色日志渲染
- **手动触发 Workflow** - 支持自定义输入参数
- **状态通知** - Workflow 运行状态实时推送到飞书

### 📱 飞书深度集成
- **消息通知** - Workflow 运行、Push 事件、Agent 结果通知
- **机器人指令** - `/help`、`/status`、`/deploy`、`/rollback` 等
- **审批流程** - 部署审批、回滚审批等企业级流程
- **交互式卡片** - 丰富的卡片交互和状态更新

### 🎯 项目管理
- **仓库绑定** - 将 Gitea 仓库绑定到 Teax 项目
- **通知规则** - 灵活的通知规则配置（分支、事件、Workflow）
- **审计日志** - 完整的操作审计和追踪

## 🏗️ 技术栈

### 前端
- **Nuxt 4** - Vue 3 全栈框架
- **Nuxt UI 4** - 现代化 UI 组件库
- **Tailwind CSS 4** - 原子化 CSS 框架
- **TypeScript** - 类型安全

### 后端
- **Nitro** - 服务端引擎（H3）
- **Drizzle ORM** - 类型安全的 ORM
- **PostgreSQL 16** - 主数据库
- **Redis 7** - Session 存储和缓存
- **nuxt-auth-utils** - 认证管理

### 集成
- **Gitea API** - 仓库、Workflow、Webhook 管理
- **飞书 API** - 消息、机器人、审批流程

## 🚀 快速开始

### 前置要求

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 16
- Redis >= 7
- Gitea 实例（需配置 OAuth 应用）
- 飞书企业账号（可选，用于消息通知）

### 安装步骤

1. **克隆仓库**

```bash
git clone <repository-url>
cd spaceflow/extensions/teax
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置环境变量**

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

必需配置：
```env
# 应用基础配置
NUXT_PUBLIC_APP_NAME=Teax
NUXT_PUBLIC_APP_URL=http://localhost:3000

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teax

# Redis
REDIS_URL=redis://localhost:6379

# Gitea OAuth（必需）
GITEA_URL=https://gitea.example.com
GITEA_CLIENT_ID=your-gitea-client-id
GITEA_CLIENT_SECRET=your-gitea-client-secret
GITEA_SERVICE_TOKEN=your-gitea-service-token

# Session 密钥（至少 32 字符）
NUXT_SESSION_PASSWORD=at-least-32-characters-long-secret-key!!
```

可选配置（飞书集成）：
```env
# 飞书应用配置
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_ENCRYPT_KEY=xxx
FEISHU_VERIFICATION_TOKEN=xxx
FEISHU_APPROVAL_CODE=xxx
```

> 详细配置说明请查看 [CONFIGURATION.md](./docs/CONFIGURATION.md)

4. **初始化数据库**

```bash
# 生成迁移文件
pnpm db:generate

# 执行迁移
pnpm db:migrate

# 或直接推送 schema（开发环境）
pnpm db:push
```

5. **启动开发服务器**

```bash
pnpm dev
```

访问 http://localhost:3000

### Docker 快速启动

使用 Docker Compose 快速启动开发环境：

```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d

# 初始化数据库
pnpm db:push

# 启动应用
pnpm dev
```

## 📖 文档

### 用户文档
- [快速开始](./docs/getting-started.md) - 新手入门指南
- [配置指南](./docs/configuration.md) - 详细的配置说明
- [部署指南](./docs/deployment.md) - 生产环境部署

### 设计文档
- [架构概览](./docs/overview.md) - 系统架构和定位
- [API 规范](./docs/api-specification.md) - 前后端 API 设计
- [权限系统](./docs/permission-system.md) - 权限模型和访问控制
- [CI/CD 集成](./docs/cicd-integration.md) - Gitea Actions 集成
- [飞书集成](./docs/feishu-integration.md) - 飞书消息和机器人

## 🔧 开发

### 可用命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm preview          # 预览生产构建

# 代码质量
pnpm lint             # 运行 ESLint
pnpm format           # 格式化代码
pnpm typecheck        # TypeScript 类型检查

# 数据库
pnpm db:generate      # 生成迁移文件
pnpm db:migrate       # 执行迁移
pnpm db:push          # 推送 schema（开发）
pnpm db:studio        # 打开 Drizzle Studio
```

### 项目结构

```
teax/
├── app/                    # 前端应用
│   ├── components/         # Vue 组件
│   ├── composables/        # 组合式函数
│   ├── layouts/            # 布局组件
│   ├── middleware/         # 路由中间件
│   ├── pages/              # 页面路由
│   └── types/              # 前端类型定义
├── server/                 # 后端应用
│   ├── api/                # API 路由
│   ├── db/                 # 数据库
│   │   └── schema/         # Drizzle schema
│   ├── middleware/         # 服务端中间件
│   ├── services/           # 业务逻辑
│   ├── shared/             # 共享代码
│   │   └── dto/            # DTO 和验证
│   └── utils/              # 工具函数
├── docs/                   # 文档
└── public/                 # 静态资源
```

## 🔐 Gitea OAuth 配置

在 Gitea 中创建 OAuth 应用：

1. 登录 Gitea 管理员账号
2. 进入 **设置 → 应用 → 管理 OAuth2 应用程序**
3. 点击 **创建新的 OAuth2 应用程序**
4. 填写信息：
   - **应用名称**: Teax
   - **重定向 URI**: `http://localhost:3000/api/auth/callback/gitea`
5. 保存后获得 `Client ID` 和 `Client Secret`
6. 将这两个值填入 `.env` 文件

## 📱 飞书应用配置

### 创建飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 配置应用信息和权限

### 所需权限

- `im:message` - 发送消息
- `im:message.group_at_msg` - 群组 @ 消息
- `contact:user.base` - 获取用户基本信息
- `approval:approval` - 审批流程

### 配置 Webhook

在飞书应用后台配置事件订阅：

- **请求地址**: `https://your-domain.com/api/webhooks/feishu`
- **加密策略**: 使用 Encrypt Key
- **订阅事件**:
  - `im.message.receive_v1` - 接收消息
  - `approval.instance.create_v1` - 审批创建
  - `approval.instance.update_v1` - 审批更新

## 🚀 生产部署

详细的生产环境部署指南请查看 [DEPLOYMENT.md](./docs/deployment.md)

### 快速部署检查清单

- [ ] 配置生产环境变量
- [ ] 设置强密码和密钥
- [ ] 配置 PostgreSQL 和 Redis
- [ ] 配置 Gitea OAuth 回调地址
- [ ] 配置飞书 Webhook 地址
- [ ] 执行数据库迁移
- [ ] 构建生产版本
- [ ] 配置反向代理（Nginx/Caddy）
- [ ] 配置 HTTPS 证书
- [ ] 设置进程管理（PM2/systemd）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [Nuxt 4 文档](https://nuxt.com)
- [Nuxt UI 文档](https://ui.nuxt.com)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [Gitea API 文档](https://docs.gitea.io/en-us/api-usage/)
- [飞书开放平台](https://open.feishu.cn/)

> The starter template for Vue is on https://github.com/nuxt-ui-templates/starter-vue.

## Quick Start

```bash [Terminal]
npm create nuxt@latest -- -t github:nuxt-ui-templates/starter
```

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-name=starter&repository-url=https%3A%2F%2Fgithub.com%2Fnuxt-ui-templates%2Fstarter&demo-image=https%3A%2F%2Fui.nuxt.com%2Fassets%2Ftemplates%2Fnuxt%2Fstarter-dark.png&demo-url=https%3A%2F%2Fstarter-template.nuxt.dev%2F&demo-title=Nuxt%20Starter%20Template&demo-description=A%20minimal%20template%20to%20get%20started%20with%20Nuxt%20UI.)

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
