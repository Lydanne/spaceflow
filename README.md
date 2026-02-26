# Spaceflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

可扩展的 AI 工程化工作流平台，提供插件化的 CI/CD 管理、AI 代码审查和多编辑器集成能力。

## 功能特性

- **AI 代码审查**：基于 LLM（OpenAI、Claude、Gemini）的自动化 PR 审查，支持行级评论和增量审查
- **自动化发布**：基于 Conventional Commits 的版本管理，支持 Monorepo 拓扑排序发布
- **扩展系统**：基于 `defineExtension` 的纯函数式扩展体系，支持 npm 包、本地路径和 Git 仓库安装
- **多编辑器集成**：自动关联扩展到 Claude Code、Windsurf、Cursor、OpenCode 等编辑器
- **多平台适配**：支持 GitHub、Gitea、GitLab 等 Git 托管平台
- **CI 流程编排**：分支锁定保护下执行 Shell 命令或 JS 脚本

## 快速开始

```bash
# 安装 CLI
pnpm add -D @spaceflow/cli

# 初始化项目配置
pnpm spaceflow setup

# 安装扩展
pnpm spaceflow install @spaceflow/review
pnpm spaceflow install @spaceflow/publish
```

## 项目结构

```text
spaceflow/
├── packages/
│   ├── cli/              # @spaceflow/cli — CLI 壳子
│   ├── core/             # @spaceflow/core — 核心运行时
│   │   └── src/
│   │       ├── cli-runtime/        # DI 容器、ExtensionLoader、exec() 入口
│   │       ├── commands/           # 13 个内置命令
│   │       ├── config/             # 配置管理
│   │       ├── extension-system/   # 扩展类型定义与 defineExtension
│   │       ├── locales/            # 国际化资源
│   │       └── shared/             # 共享模块
│   │           ├── git-provider/   # Git 平台适配器
│   │           ├── git-sdk/        # Git 命令封装
│   │           ├── llm-proxy/      # LLM 统一代理
│   │           ├── logger/         # 日志系统（TUI/Plain）
│   │           ├── parallel/       # 并行执行工具
│   │           └── storage/        # 通用存储服务
│   └── shared/           # @spaceflow/shared — 公共工具库
├── extensions/           # 扩展
│   ├── review/           # @spaceflow/review — AI 代码审查
│   ├── publish/          # @spaceflow/publish — 自动化发布
│   ├── scripts/          # @spaceflow/scripts — 脚本执行
│   ├── shell/            # @spaceflow/shell — Shell 执行
│   └── review-summary/   # @spaceflow/review-summary — 审查统计
├── actions/              # GitHub Actions
├── docs/                 # 文档站点（VitePress）
└── templates/            # 扩展模板（command / mcp / skills）
```

## 包一览

| 包名                        | 说明                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `@spaceflow/cli`            | CLI 壳子入口，负责引导和启动                                 |
| `@spaceflow/core`           | 核心运行时 + 13 个内置命令 + 共享模块（Git、LLM、Logger 等） |
| `@spaceflow/shared`         | 轻量公共工具库，CLI 和 core 共同依赖                         |
| `@spaceflow/review`         | AI 代码审查扩展                                              |
| `@spaceflow/publish`        | 自动化版本发布扩展                                           |
| `@spaceflow/scripts`        | CI 环境下执行 JS 脚本                                        |
| `@spaceflow/shell`          | CI 环境下执行 Shell 命令                                     |
| `@spaceflow/review-summary` | PR 贡献审查统计                                              |

## 内置命令

| 命令         | 说明                 |
| ------------ | -------------------- |
| `install`    | 安装扩展             |
| `uninstall`  | 卸载扩展             |
| `build`      | 构建扩展             |
| `dev`        | 开发模式运行         |
| `create`     | 创建新扩展           |
| `update`     | 更新扩展             |
| `mcp`        | 启动 MCP Server      |
| `list`       | 列出已安装扩展       |
| `clear`      | 清理缓存             |
| `runx` / `x` | 执行扩展命令         |
| `schema`     | 生成配置 JSON Schema |
| `commit`     | AI 智能提交          |
| `setup`      | 初始化项目配置       |

## 配置

在项目根目录创建 `.spaceflowrc` 或 `.spaceflow/spaceflow.json`：

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

通过 `support` 字段配置，`spaceflow install` 会自动将扩展关联到对应编辑器目录：

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
