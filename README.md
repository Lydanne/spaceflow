# Spaceflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

可扩展的 AI 工程化工作流平台，提供插件化的 CI/CD 管理、AI 代码审查和多编辑器集成能力。

## 功能特性

- **AI 代码审查**：基于 LLM（OpenAI、Claude、Gemini）的自动化 PR 审查，支持行级评论和增量审查
- **自动化发布**：基于 Conventional Commits 的版本管理，支持 Monorepo 拓扑排序发布
- **插件系统**：通过 NestJS 模块化架构，支持自定义命令和技能扩展
- **多编辑器集成**：自动关联插件到 Claude Code、Windsurf、Cursor、OpenCode 等编辑器
- **多平台适配**：支持 GitHub、Gitea、GitLab 等 Git 托管平台
- **CI 流程编排**：分支锁定保护下执行 Shell 命令或 JS 脚本

## 快速开始

```bash
# 安装 CLI
pnpm add -D @spaceflow/cli

# 初始化项目配置
pnpm spaceflow setup

# 安装插件
pnpm spaceflow install @spaceflow/review
pnpm spaceflow install @spaceflow/publish
```

## 项目结构

```text
spaceflow/
├── packages/
│   ├── cli/            # CLI 入口（@spaceflow/cli）
│   ├── core/           # 核心能力库（@spaceflow/core）
│   │   └── src/
│   │       ├── config/             # 配置管理
│   │       ├── extension-system/   # 插件系统
│   │       ├── locales/            # 国际化资源
│   │       └── shared/             # 共享模块
│   │           ├── git-provider/   # Git 平台适配器
│   │           ├── git-sdk/        # Git 命令封装
│   │           ├── llm-proxy/      # LLM 统一代理
│   │           ├── llm-jsonput/    # JSON 结构化输出
│   │           ├── feishu-sdk/     # 飞书 SDK
│   │           ├── logger/         # 日志系统（TUI/Plain）
│   │           ├── parallel/       # 并行执行工具
│   │           └── storage/        # 通用存储服务
├── extensions/         # 外部插件
│   ├── review/         # AI 代码审查（@spaceflow/review）
│   ├── publish/        # 自动化发布（@spaceflow/publish）
│   ├── ci-scripts/     # CI 脚本执行（@spaceflow/ci-scripts）
│   ├── ci-shell/       # CI Shell 执行（@spaceflow/ci-shell）
│   └── period-summary/ # 周期统计（@spaceflow/period-summary）
├── actions/            # GitHub Actions
├── docs/               # 文档站点（VitePress）
└── templates/          # 插件模板
```

## 包一览

| 包名                        | 说明                                       |
| --------------------------- | ------------------------------------------ |
| `@spaceflow/cli`            | CLI 工具，提供 `spaceflow` / `space` 命令  |
| `@spaceflow/core`           | 核心能力库，提供共享模块和插件系统基础设施 |
| `@spaceflow/review`         | AI 代码审查插件                            |
| `@spaceflow/publish`        | 自动化版本发布插件                         |
| `@spaceflow/ci-scripts`     | CI 环境下执行 JS 脚本                      |
| `@spaceflow/ci-shell`       | CI 环境下执行 Shell 命令                   |
| `@spaceflow/period-summary` | PR 贡献周期统计                            |

## 内置命令

| 命令         | 说明                  |
| ------------ | --------------------- |
| `install`    | 安装插件（命令/技能） |
| `uninstall`  | 卸载插件              |
| `build`      | 构建插件              |
| `dev`        | 开发模式运行          |
| `create`     | 创建新插件            |
| `list`       | 列出已安装插件        |
| `clear`      | 清理缓存              |
| `runx` / `x` | 执行插件命令          |
| `schema`     | 生成配置 JSON Schema  |
| `commit`     | AI 智能提交           |
| `setup`      | 初始化项目配置        |
| `mcp`        | 启动 MCP Server       |

## 配置

在项目根目录创建 `spaceflow.json`：

```json
{
  "support": ["claudeCode", "windsurf", "cursor"],
  "dependencies": {
    "@spaceflow/review": "latest",
    "@spaceflow/publish": "latest"
  },
  "review": {
    "includes": ["*/**/*.ts", "!*/**/*.spec.*"],
    "generateDescription": true,
    "lineComments": true,
    "verifyFixes": true,
    "concurrency": 5,
    "retries": 3
  },
  "publish": {
    "monorepo": { "enabled": true, "propagateDeps": true },
    "npm": { "publish": true, "packageManager": "pnpm" },
    "git": { "lockBranch": true }
  }
}
```

## 编辑器集成

通过 `support` 字段配置，`spaceflow install` 会自动将插件关联到对应编辑器目录：

| 编辑器      | 配置目录     |
| ----------- | ------------ |
| Claude Code | `.claude/`   |
| Windsurf    | `.windsurf/` |
| Cursor      | `.cursor/`   |
| OpenCode    | `.opencode/` |

## 环境变量

| 变量                | 说明                                          |
| ------------------- | --------------------------------------------- |
| `GITHUB_TOKEN`      | GitHub API Token                              |
| `GITEA_TOKEN`       | Gitea API Token                               |
| `GITLAB_TOKEN`      | GitLab API Token                              |
| `GIT_PROVIDER_TYPE` | Git 平台类型（`github` / `gitea` / `gitlab`） |
| `OPENAI_BASE_URL`   | OpenAI API 地址                               |
| `OPENAI_API_KEY`    | OpenAI API Key                                |
| `OPENAI_MODEL`      | OpenAI 模型名称                               |

## 开发

```bash
# 安装依赖
pnpm install

# 构建全部
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

## GitHub Actions

项目提供预配置的 GitHub Actions 工作流：

- **pr-review.yml** — PR 提交时自动触发 AI 审查
- **pr-review-command.yml** — 通过 PR 评论手动触发审查
- **publish.yml** — 推送到 main 分支时自动发布
- **test-command.yml** — 手动运行任意 spaceflow 命令

## 许可证

[MIT](LICENSE)
