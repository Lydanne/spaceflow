# 项目结构

Spaceflow 采用 pnpm Monorepo 结构，以下是主要目录说明。

## 目录概览

```text
spaceflow/
├── packages/
│   ├── cli/                 # @spaceflow/cli — CLI 壳子
│   │   └── src/
│   │       └── cli.ts       # 唯一入口：引导 → 生成 bin → 执行
│   │
│   ├── core/                # @spaceflow/core — 核心运行时
│   │   └── src/
│   │       ├── cli-runtime/     # DI 容器、ExtensionLoader、exec() 入口
│   │       ├── commands/        # 13 个内置命令（defineExtension 定义）
│   │       │   ├── build/
│   │       │   ├── clear/
│   │       │   ├── commit/
│   │       │   ├── create/
│   │       │   ├── dev/
│   │       │   ├── install/
│   │       │   ├── list/
│   │       │   ├── mcp/
│   │       │   ├── runx/
│   │       │   ├── schema/
│   │       │   ├── setup/
│   │       │   ├── uninstall/
│   │       │   └── update/
│   │       ├── config/          # 配置加载与 Schema 生成
│   │       ├── extension-system/# 扩展类型定义与 defineExtension
│   │       ├── locales/         # CLI 命令翻译文件（en + zh-cn）
│   │       └── shared/          # 共享模块
│   │           ├── git-provider/    # Git 平台适配器（GitHub / Gitea / GitLab）
│   │           ├── git-sdk/         # Git 命令封装
│   │           ├── llm-proxy/       # 多 LLM 统一代理
│   │           ├── llm-jsonput/     # JSON 结构化输出
│   │           ├── feishu-sdk/      # 飞书 SDK
│   │           ├── logger/          # 日志系统（Plain / TUI）
│   │           ├── mcp/             # MCP 装饰器与工具
│   │           ├── parallel/        # 并行执行工具
│   │           ├── storage/         # 通用存储服务
│   │           └── ...
│   │
│   └── shared/              # @spaceflow/shared — 公共工具库
│       └── src/
│           ├── config/          # 配置读写工具
│           ├── editor-config/   # 编辑器目录映射
│           ├── package-manager/ # 包管理器检测
│           ├── source-utils/    # 源类型判断
│           ├── spaceflow-dir/   # .spaceflow 目录管理
│           └── verbose/         # 日志级别工具
│
├── extensions/              # 扩展（独立 npm 包）
│   ├── review/              # @spaceflow/review — AI 代码审查
│   ├── publish/             # @spaceflow/publish — 版本发布
│   ├── scripts/             # @spaceflow/scripts — 脚本执行
│   ├── shell/               # @spaceflow/shell — Shell 执行
│   └── review-summary/      # @spaceflow/review-summary — 审查总结
│
├── actions/                 # GitHub Actions
│   ├── src/
│   └── action.yml
│
├── templates/               # Extension 模板
│   ├── command/             # 命令型 Extension 模板
│   ├── mcp/                 # MCP Server 模板
│   └── skills/              # 技能型 Extension 模板
│
├── references/              # 代码审查规范文件
│   ├── js&ts.base.md
│   ├── js&ts.nest.md
│   └── ...
│
├── docs/                    # 文档站点（VitePress）
│
├── .spaceflow/              # Spaceflow 工作目录（运行时生成）
│   ├── package.json         # Extension 依赖管理
│   └── bin/index.js         # 生成的入口文件
│
├── .spaceflowrc             # 项目配置文件
├── pnpm-workspace.yaml      # pnpm Monorepo 配置
└── package.json             # 根 package.json
```

## 架构概览

Spaceflow 采用三层架构：

```text
┌─────────────────────────────────────────────┐
│  @spaceflow/cli（壳子）                      │
│  职责：确保 .spaceflow 目录 → 安装依赖       │
│       → 生成 bin/index.js → spawn 子进程执行 │
└──────────────────┬──────────────────────────┘
                   │ spawn node .spaceflow/bin/index.js
┌──────────────────▼──────────────────────────┐
│  @spaceflow/core（运行时）                   │
│  exec() → ServiceContainer → ExtensionLoader │
│       → Commander.js 程序构建 → 执行命令     │
└──────────────────┬──────────────────────────┘
                   │ defineExtension()
┌──────────────────▼──────────────────────────┐
│  Extension（内置 + 外部）                    │
│  commands[] + services[] + mcp? + hooks      │
└─────────────────────────────────────────────┘
```

## 核心包

### `@spaceflow/cli`

CLI 壳子入口。只使用 Node.js 内置模块（`fs`/`path`/`child_process`/`os`）和 `@spaceflow/shared`。通过 `bin` 字段注册 `spaceflow` 和 `space` 两个命令。

职责：

1. 确保 `.spaceflow/` 目录和 `package.json` 存在
2. 确保依赖已安装（`pnpm install`）
3. 读取配置文件中的外部扩展列表
4. 生成 `.spaceflow/bin/index.js`（动态 import 所有扩展）
5. `execSync` 执行生成的入口文件

### `@spaceflow/core`

核心运行时 + 全部 13 个内置命令 + 共享基础模块。作为 npm 包发布，外部 Extension 通过 `peerDependencies` 依赖它。

主要导出：

- **cli-runtime** — `exec()` 入口、`ServiceContainer` DI 容器、`ExtensionLoader` 加载器
- **extension-system** — `defineExtension()`、`ExtensionDefinition` 类型、`SpaceflowContext` 接口
- **commands** — 13 个内置命令（build/clear/commit/create/dev/install/list/mcp/runx/schema/setup/uninstall/update）
- **shared** — Git Provider、Git SDK、LLM Proxy、Logger、MCP、Storage、Parallel 等模块
- **config** — 配置加载、Zod Schema 校验、JSON Schema 生成

### `@spaceflow/shared`

轻量公共工具库，CLI 和 core 共同依赖。提供配置读写、包管理器检测、编辑器目录映射、日志级别等基础工具函数。

### 外部 Extension

位于 `extensions/` 目录下，每个 Extension 是独立的 npm 包，拥有自己的 `package.json`、构建配置和测试。

## 配置文件

| 文件                                             | 说明                |
| ------------------------------------------------ | ------------------- |
| `.spaceflowrc` / `.spaceflow/spaceflow.json`     | 项目配置            |
| `~/.spaceflowrc` / `~/.spaceflow/spaceflow.json` | 全局配置            |
| `.spaceflow/package.json`                        | Extension 依赖管理  |
| `pnpm-workspace.yaml`                            | Monorepo 工作区配置 |
| `references/*.md`                                | 代码审查规范文件    |
