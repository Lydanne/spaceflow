# Teax 开发文档

本文档面向项目开发者，说明本地开发、环境变量、数据库初始化，以及 Docker 镜像构建的两种模式。

## 1. 前置要求

- Node.js 24.x（建议与容器保持一致）
- pnpm 10.x
- Docker / Docker Compose
- PostgreSQL 16
- Redis 7

## 2. 本地开发启动

1. 安装依赖

```bash
pnpm install
```

2. 准备环境变量

```bash
cp .env.example .env
```

3. 启动依赖服务（PostgreSQL + Redis）

```bash
docker compose up -d
```

4. 初始化数据库（开发环境可直接 push）

```bash
pnpm db:push
```

5. 启动开发服务

```bash
pnpm dev
```

## 3. 环境变量约定（重要）

当前项目采用 Nuxt `runtimeConfig`，生产运行时请使用 `NUXT_*` 注入配置。

- 服务端私有配置示例：
  - `NUXT_DATABASE_URL`
  - `NUXT_REDIS_URL`
  - `NUXT_GITEA_CLIENT_SECRET`
  - `NUXT_FEISHU_APP_SECRET`
- 公共配置示例：
  - `NUXT_PUBLIC_APP_NAME`
  - `NUXT_PUBLIC_APP_URL`

注意事项：
- `nuxt build` 之后使用 `node .output/server/index.mjs` 运行时，不会自动读取项目根目录 `.env`。
- 生产环境请通过容器环境变量或 `--env-file` 注入。
- 推荐使用 `.env.docker` 作为容器运行配置，不要把本地 `.env` 用于镜像构建。

## 4. Docker 构建模式

### 模式 A：本地加速构建（默认）

流程：本地 `pnpm nuxt:build` -> 仅把 `.output` 打进运行镜像，不在容器内重复构建。

```bash
pnpm docker:build
```

默认会读取 `package.json` 的 `version`，生成两个 tag：
- `<image>:<version>`
- `<image>:latest`

自定义镜像名与标签（默认 local）：

```bash
scripts/build-docker.sh lydamirror/teax test
```

### 模式 B：可复现构建（容器内 build）

流程：`pnpm pack` -> 容器内安装依赖并 `nuxt build` -> 产出运行镜像。

```bash
pnpm docker:build:repro
```

默认会读取 `package.json` 的 `version`，生成两个 tag：
- `<image>:<version>`
- `<image>:latest`

自定义镜像名与标签：

```bash
BUILD_MODE=repro scripts/build-docker.sh lydamirror/teax test
```

如果你已经有最新 `.output`，可在 local 模式跳过本地二次构建：

```bash
SKIP_LOCAL_BUILD=1 scripts/build-docker-local.sh lydamirror/teax local
```

## 5. 发布到 Docker Hub

1. 先在 Docker Hub 创建仓库（默认使用：`lydamirror/teax`）

2. 登录 Docker Hub

```bash
docker login
```

3. 设置镜像名与版本号（可选）

```bash
IMAGE_NAME="lydamirror/teax"
VERSION="$(node -p "require('./package.json').version")"
echo "$IMAGE_NAME:$VERSION"
```

4. 构建镜像（会自动打 `version` 和 `latest` 两个标签）

```bash
# 默认本地加速构建
scripts/build-docker.sh "$IMAGE_NAME"

# 可复现构建（容器内 build）
BUILD_MODE=repro scripts/build-docker.sh "$IMAGE_NAME"
```

推荐：使用发布脚本一条命令完成“构建 + 推送”

```bash
# 默认本地加速构建并发布（默认镜像名: lydamirror/teax）
scripts/publish-docker.sh "$IMAGE_NAME"
scripts/publish-docker.sh

# 可复现构建并发布
BUILD_MODE=repro scripts/publish-docker.sh "$IMAGE_NAME"
```

5. 推送镜像

```bash
docker push "${IMAGE_NAME}:${VERSION}"
docker push "${IMAGE_NAME}:latest"
```

6. 验证推送结果

```bash
docker pull "${IMAGE_NAME}:${VERSION}"
docker pull "${IMAGE_NAME}:latest"
```

说明：
- 如果要发布预发布版本，可显式传入标签，例如：`scripts/build-docker.sh "$IMAGE_NAME" "rc.1"`。
- 发布脚本也支持显式标签，例如：`scripts/publish-docker.sh "$IMAGE_NAME" "rc.1"`。
- 如果部署机是 x86_64（amd64），请在构建/发布时指定：
  `DOCKER_PLATFORM=linux/amd64 scripts/publish-docker.sh`
- 所有默认入口均为 local 模式；如需可复现构建，请设置 `BUILD_MODE=repro`。
- 正式发布建议保持 `package.json` 的 `version` 与镜像版本一致。

## 6. 运行容器

推荐使用 `--env-file .env.docker`：

```bash
docker run -d \
  --name teax-app \
  --network teax_default \
  --env-file .env.docker \
  -p 3000:3000 \
  lydamirror/teax:latest
```

## 7. 安全与打包说明

- 项目已通过 `.dockerignore` 和 `.npmignore` 排除 `.env` 与 `.env.*`（保留 `.env.example`）。
- Docker 默认构建流程会检查 `pnpm pack` 产物，若包含 `.env`（非 `.env.example`）会直接失败。
- 请勿把真实密钥写入仓库文件，统一通过运行时环境变量注入。

## 8. 常用命令

```bash
# 开发
pnpm dev
pnpm nuxt:build
pnpm preview

# 代码质量
pnpm lint
pnpm typecheck

# 数据库
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio

# Docker
pnpm docker:build
pnpm docker:build:repro
pnpm docker:build:local
pnpm docker:publish
pnpm docker:publish:repro
```
