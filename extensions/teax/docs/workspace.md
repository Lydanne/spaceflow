# 工作区系统文档

> 容器化开发环境和 Web IDE 集成

## 概述

工作区是 **与项目仓库绑定的容器化开发环境**。每个工作区对应一个 Docker 容器，提供 **两种代码编辑方式**：

### 双编辑模式

```text
创建工作区 → 启动容器（clone 仓库 + Web VSCode + OpenCode）
    │
    ├── 编辑方式 1：Web VSCode（手动编辑）
    │   ├── /workspace/{name}/ide/ → 反向代理到容器内 openvscode-server
    │   └── 用户通过浏览器直接编辑代码
    │
    ├── 编辑方式 2：OpenCode（AI 辅助编辑）
    │   ├── 基于 @opencode-ai/sdk
    │   ├── 容器内运行 OpenCode 服务
    │   ├── 支持多种 LLM（OpenAI、Claude、私有部署等）
    │   └── AI Agent 自动编辑代码、执行命令、提交 PR
    │
    ├── 测试环境预览：/workspace/{name}/ → 反向代理到容器内应用端口
    │
    └── 删除工作区 → 容器销毁 + 清理存储卷
```

### 核心特性

- **双编辑模式**：用户可选择手动编辑（Web VSCode）或 AI 辅助编辑（OpenCode）
- **容器隔离**：每个工作区独立容器，互不干扰
- **持久化存储**：工作区数据保存在 Docker Volume，停止后可恢复
- **实时预览**：支持测试环境预览，直接访问容器内运行的应用
- **CI 集成**：默认 CI 工作区暴露 OpenCode API，供 Gitea Actions 调用

## 工作区类型

工作区分为三种类型，根据**可见性**和**用途**区分：

### 1. CI 工作区（项目级，自动创建）

每个项目自动创建的默认工作区，专门用于 CI/CD：

- **创建时机**：项目创建时自动创建
- **命名规则**：`{owner}-{repo}-ci`（如 `myorg-myproject-ci`）
- **可见性**：**项目级** - 所有项目成员可见（不可删除）
- **容器内服务**：
  - **OpenCode 服务端**：监听容器内端口（如 3100），等待客户端连接
  - **Web VSCode**：openvscode-server
  - **应用服务**：测试环境
- **访问方式**：
  - **Teax API**：`/api/repos/{owner}/{repo}/opencode/*`（Teax 后端通过 OpenCode 客户端连接容器内服务端）
  - **Web 界面**：`/workspace/{owner}-{repo}-ci`
- **生命周期**：默认保持运行，自动重启
- **用途**：
  - Gitea Actions 中调用 Teax API，由 Teax 连接 OpenCode 服务端执行 AI 操作
  - CI/CD 流程中的自动化代码修改
  - 自动化测试和代码审查

### 2. 项目工作区（项目级，手动创建）

项目成员创建的共享开发环境：

- **创建方式**：任何项目成员在项目页面手动创建
- **命名规则**：用户自定义（如 `dev-env`、`staging`）
- **可见性**：**项目级** - 所有项目成员可见和访问
- **访问方式**：
  - **Web VSCode**：`/workspace/{name}/ide/`
  - **OpenCode 界面**：`/workspace/{name}/opencode`
  - **测试环境**：`/workspace/{name}/`
- **生命周期**：创建者或项目管理员可以启动/停止/删除
- **用途**：
  - 团队协作开发环境
  - 共享的测试环境
  - 演示环境

### 3. 个人工作区（用户级，手动创建）

用户创建的私有开发环境：

- **创建方式**：用户在项目页面手动创建，选择"个人工作区"
- **命名规则**：自动添加用户前缀（如 `{username}-dev`）
- **可见性**：**用户级** - 仅创建者可见和访问
  - **例外**：系统管理员和组织 Owner 可以在管理后台查看所有个人工作区
- **访问方式**：同项目工作区
- **生命周期**：仅创建者可以启动/停止/删除
- **用途**：
  - 个人日常开发
  - 实验性功能开发
  - 私密调试环境

### 可见性对比

| 类型 | 可见性 | 创建者 | 访问权限 | 管理权限 | 删除权限 |
| ---- | ------ | ------ | -------- | -------- | -------- |
| **CI 工作区** | 项目级 | 系统自动 | 所有项目成员 | 项目管理员 | 不可删除 |
| **项目工作区** | 项目级 | 任何项目成员 | 所有项目成员 | 创建者 + 项目管理员 | 创建者 + 项目管理员 |
| **个人工作区** | 用户级 | 项目成员 | 仅创建者 | 仅创建者 | 仅创建者 |

> **管理员特权**：系统管理员和组织 Owner 可以在管理后台（`/-/admin/workspaces`）查看和管理所有工作区，包括个人工作区。

## 容器生命周期

### 状态机

```text
┌──────────────────────────────────────────────────────────────┐
│                    工作区状态机                                │
│                                                              │
│  creating ──▶ running ──▶ stopping ──▶ stopped               │
│     │            │            │           │                   │
│     │            │            │           ├──▶ starting ──▶ running │
│     │            │            │           │                   │
│     │            ▼            ▼           ▼                   │
│     └────────▶ failed    failed       deleting ──▶ deleted   │
│                                          ▲                   │
│                   任意状态 ────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### 状态说明

| 状态 | 说明 |
| ---- | ---- |
| `creating` | 容器创建中（拉取镜像 + 启动容器 + clone 仓库） |
| `running` | 容器运行中，可通过 Web IDE 和测试环境访问 |
| `stopping` | 容器停止中 |
| `stopped` | 容器已停止，数据卷保留，可重新启动 |
| `starting` | 从停止状态重新启动中 |
| `failed` | 创建或启动失败 |
| `deleting` | 容器销毁中（清理容器 + 存储卷） |

## 容器运行时抽象

接口层做抽象，先实现 Docker，后续可切换到 Kubernetes：

```typescript
// server/services/container/container-runtime.ts
interface ContainerRuntime {
  // 容器生命周期
  create(config: ContainerConfig): Promise<ContainerInfo>;
  start(containerId: string): Promise<void>;
  stop(containerId: string): Promise<void>;
  remove(containerId: string, removeVolumes?: boolean): Promise<void>;
  
  // 状态查询
  inspect(containerId: string): Promise<ContainerInfo>;
  list(filters?: ContainerFilters): Promise<ContainerInfo[]>;
  
  // 日志
  logs(containerId: string, options?: LogOptions): AsyncIterable<string>;
}

interface ContainerConfig {
  name: string;                    // 容器名称（workspace-{workspaceId}）
  image: string;                   // 镜像（teax/workspace:latest）
  env: Record<string, string>;     // 环境变量（GIT_REPO_URL, GIT_BRANCH 等）
  volumes: VolumeMount[];          // 数据卷挂载（工作区持久化）
  ports: PortMapping[];            // 端口映射
  resources?: ResourceLimits;      // CPU/内存限制
  labels?: Record<string, string>; // 标签（teax.workspace.id 等）
}

interface ContainerInfo {
  id: string;
  name: string;
  status: 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';
  ports: PortMapping[];
  createdAt: Date;
}
```

## Docker 实现

```typescript
// server/services/container/docker-runtime.ts
class DockerRuntime implements ContainerRuntime {
  private docker: Dockerode;
  
  // 创建工作区容器
  async create(config: ContainerConfig): Promise<ContainerInfo> {
    const container = await this.docker.createContainer({
      name: config.name,
      Image: config.image,
      Env: Object.entries(config.env).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        Binds: config.volumes.map(v => `${v.source}:${v.target}`),
        PortBindings: this.buildPortBindings(config.ports),
        Memory: config.resources?.memoryMB ? config.resources.memoryMB * 1024 * 1024 : undefined,
        NanoCpus: config.resources?.cpuCores ? config.resources.cpuCores * 1e9 : undefined,
      },
      Labels: {
        'teax.managed': 'true',
        ...config.labels,
      },
    });
    return this.toContainerInfo(await container.inspect());
  }
}
```

## 工作区容器镜像

基础镜像 `teax/workspace:latest` 预装：

| 组件 | 用途 |
| ---- | ---- |
| **openvscode-server** | Web 端 VSCode，监听容器内 `0.0.0.0:3000` |
| **Git** | 代码版本管理 |
| **Node.js 20 LTS** | 默认运行时 |
| **SSH Server** | VSCode Remote SSH 连接（可选） |
| **entrypoint.sh** | 启动脚本：clone 仓库 → 安装依赖 → 启动 openvscode-server |

### Dockerfile

```dockerfile
# Dockerfile.workspace
FROM gitpod/openvscode-server:latest

USER root
RUN apt-get update && apt-get install -y \
    git openssh-server curl && \
    rm -rf /var/lib/apt/lists/*

# 安装 Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER openvscode-server
WORKDIR /home/workspace

# openvscode-server 默认端口
EXPOSE 3000
# 测试环境应用端口范围
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
```

### entrypoint.sh

```bash
#!/bin/bash
# 1. Clone 仓库（如果工作区目录为空）
if [ -z "$(ls -A /home/workspace/project)" ]; then
  git clone --branch "${GIT_BRANCH:-main}" "${GIT_REPO_URL}" /home/workspace/project
fi

# 2. 配置 Git 用户信息
git config --global user.name "${GIT_USER_NAME}"
git config --global user.email "${GIT_USER_EMAIL}"

# 3. 启动 openvscode-server
exec /home/.openvscode-server/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 3000 \
  --without-connection-token \
  --default-folder /home/workspace/project
```

## 网关代理

Teax Nitro 服务内置反向代理，将 `/workspace/{name}/*` 请求转发到对应容器：

```text
浏览器请求                                  Teax Server
    │                                          │
    ├── /workspace/my-dev/ide/**    ──▶  代理到容器:3000（openvscode-server）
    ├── /workspace/my-dev/**        ──▶  代理到容器:8080（测试环境应用）
    └── /workspace/my-dev/ide/     ──▶  WebSocket 升级（IDE 实时通信）
```

### 代理实现

```typescript
// server/routes/workspace/[name]/[...path].ts
export default defineEventHandler(async (event) => {
  const { name } = getRouterParams(event);
  
  // 1. 查询工作区信息（从 DB 获取容器端口映射）
  const workspace = await getWorkspaceByName(name);
  if (!workspace || workspace.status !== 'running') {
    throw createError({ statusCode: 404, message: 'Workspace not found or not running' });
  }
  
  // 2. 根据路径前缀选择目标端口
  const path = getRouterParam(event, 'path') || '';
  const isIDE = path.startsWith('ide');
  const targetPort = isIDE ? workspace.ide_port : workspace.app_port;
  const targetPath = isIDE ? path.replace(/^ide\/?/, '') : path;
  
  // 3. 反向代理（支持 WebSocket 升级）
  const target = `http://${workspace.container_host}:${targetPort}/${targetPath}`;
  return proxyRequest(event, target);
});
```

> **WebSocket 支持**：openvscode-server 依赖 WebSocket 进行实时编辑通信。Nitro 的 `proxyRequest` 默认支持 WebSocket 升级（基于 h3 的 `sendProxy`/`proxyRequest`），无需额外配置。

## 工作区与项目的关系

```text
Organization
  └── Repository (项目)
        └── Workspace (工作区) ×N
              └── Docker Container (1:1)
```

- 每个工作区 **必须绑定一个仓库**（`repository_id`）
- 一个仓库可以有 **多个工作区**（不同分支、不同用户）
- 工作区名称在 **全局唯一**（作为 URL 路径标识）
- 工作区由 **创建者** 拥有，其他用户需要权限才能访问

## 端口分配策略

每个工作区容器需要映射两个宿主端口：

| 容器端口 | 用途 | 宿主端口分配 |
| -------- | ---- | ------------ |
| `3000` | openvscode-server（Web IDE） | 动态分配（范围 `10000-19999`） |
| `8080` | 测试环境应用 | 动态分配（范围 `20000-29999`） |

### 端口分配逻辑

1. 创建工作区时，从可用范围中分配未占用端口
2. 端口号持久化到 `workspaces` 表（`ide_port`、`app_port`）
3. 容器停止/删除时释放端口

## 安全考虑

| 风险点 | 防护措施 |
| ------ | -------- |
| **容器逃逸** | 容器以非 root 用户运行，挂载目录限定为工作区数据卷 |
| **端口扫描** | 宿主端口绑定到 `127.0.0.1`，仅允许 Teax 内部代理访问 |
| **未授权访问** | 网关代理层校验用户 session + 工作区归属/权限 |
| **资源耗尽** | 每个容器设置 CPU/内存上限（默认 2 核 4GB），可在系统设置中配置 |
| **存储膨胀** | 工作区数据卷设限（默认 10GB），定期清理已删除工作区的遗留卷 |
| **Git 凭证** | 通过 Gitea PAT（Service Token）注入容器环境变量，不暴露用户主密码 |

## 相关文档

- [架构概览](./overview.md) - 系统整体架构
- [Agent 系统](./agent-system.md) - Agent 执行隔离
- [部署配置](./deployment.md) - Docker 配置
