# 项目结构

Spaceflow 采用 pnpm Monorepo 结构，以下是主要目录说明。

## 目录概览

```text
spaceflow/
├── core/                  # @spaceflow/core — 核心能力库
│   └── src/
│       ├── config/        # 配置加载与校验
│       ├── extension-system/  # Extension 加载系统
│       └── shared/        # 共享模块
│           ├── git-provider/  # Git 平台适配器（GitHub / Gitea）
│           ├── git-sdk/       # Git 命令封装
│           ├── llm-proxy/     # 多 LLM 统一代理
│           ├── feishu-sdk/    # 飞书 SDK
│           ├── logger/        # 日志系统（Plain / TUI）
│           ├── i18n/          # 国际化
│           ├── storage/       # 本地存储
│           ├── parallel/      # 并行执行工具
│           └── ...
│
├── cli/                   # @spaceflow/cli — CLI 入口
│   └── src/
│       ├── commands/      # 内置命令
│       │   ├── install/   # 安装 Extension
│       │   ├── uninstall/ # 卸载 Extension
│       │   ├── build/     # 构建 Extension
│       │   ├── dev/       # 开发模式
│       │   ├── create/    # 创建 Extension 模板
│       │   ├── list/      # 列出已安装 Extension
│       │   ├── commit/    # Git 提交辅助
│       │   ├── setup/     # 编辑器配置
│       │   ├── schema/    # JSON Schema 生成
│       │   ├── mcp/       # MCP 服务
│       │   ├── runx/      # 运行外部命令
│       │   ├── update/    # 更新 Extension
│       │   └── clear/     # 清理缓存
│       ├── extension-loader/  # Extension 加载器
│       └── locales/       # CLI i18n 资源
│
├── commands/              # 外部 Extension（独立 npm 包）
│   ├── review/            # @spaceflow/review — AI 代码审查
│   ├── publish/           # @spaceflow/publish — 版本发布
│   ├── ci-scripts/        # @spaceflow/ci-scripts — 脚本执行
│   ├── ci-shell/          # @spaceflow/ci-shell — Shell 执行
│   └── period-summary/    # @spaceflow/period-summary — 周期总结
│
├── actions/               # GitHub Actions
│   ├── src/
│   └── action.yml
│
├── references/            # 代码审查规范文件
│   ├── js&ts.base.md
│   ├── js&ts.nest.md
│   └── ...
│
├── templates/             # Extension 模板
│   ├── command/           # 命令型 Extension 模板
│   └── skills/            # 技能型 Extension 模板
│
├── .spaceflow/            # Spaceflow 工作目录
│   ├── spaceflow.json     # 项目配置
│   └── package.json       # Extension 依赖管理
│
├── pnpm-workspace.yaml    # pnpm Monorepo 配置
└── package.json           # 根 package.json
```

## 核心包

### `@spaceflow/core`

核心能力库，提供所有 Extension 共享的基础模块。作为 npm 包发布，Extension 通过 `peerDependencies` 依赖它。

主要导出：

- **Git Provider** — GitHub / Gitea 平台适配器
- **Git SDK** — Git 命令封装
- **LLM Proxy** — 多 LLM 统一代理（OpenAI、Claude 等）
- **Logger** — 日志系统（Plain 模式 + TUI 模式）
- **i18n** — 国际化工具函数
- **Config** — 配置加载与校验
- **Extension System** — Extension 接口定义

### `@spaceflow/cli`

CLI 入口包，包含所有内置命令和 Extension 加载器。通过 `bin` 字段注册 `spaceflow` 和 `space` 两个命令。

### 外部 Extension

位于 `commands/` 目录下，每个 Extension 是独立的 npm 包，拥有自己的 `package.json`、构建配置和测试。

## 配置文件

| 文件 | 说明 |
|------|------|
| `spaceflow.json` / `.spaceflow/spaceflow.json` | 项目配置 |
| `.spaceflow/package.json` | Extension 依赖管理 |
| `pnpm-workspace.yaml` | Monorepo 工作区配置 |
| `references/*.md` | 代码审查规范文件 |
