# 简介

## 什么是 Spaceflow？

Spaceflow 是一个**可扩展的 AI 工程化工作流平台**，为团队提供插件化的 CI/CD 管理、AI 代码审查和多编辑器集成能力。

它采用**三层架构**：轻量 CLI 壳子 → 核心运行时（Commander.js + ServiceContainer） → 可插拔的 Extension 扩展。所有命令（内置 + 外部）统一通过 `defineExtension()` 定义，以纯函数式的方式声明命令、服务和 MCP 工具。

## 核心特性

- **AI 代码审查** — 基于 LLM 的自动化代码审查，支持 OpenAI、Claude、Claude Code、OpenCode 等多种模型
- **Extension 扩展系统** — 基于 `defineExtension` 的纯函数式扩展，支持 npm 包、本地路径和 Git 仓库安装
- **多编辑器集成** — 自动将技能、命令和 MCP 服务关联到 Claude Code、Windsurf、Cursor、OpenCode 等 AI 编程工具
- **MCP 支持** — 内置 Model Context Protocol 服务器，聚合所有扩展的 MCP 工具
- **CI/CD 自动化** — 预配置 GitHub Actions，支持自动 PR 审查、版本发布
- **国际化** — 基于 i18next，每个 Extension 自管理翻译资源

## 技术栈

| 技术                                                     | 用途                        |
| -------------------------------------------------------- | --------------------------- |
| [Commander.js](https://github.com/tj/commander.js)       | CLI 命令解析                |
| [ServiceContainer](https://github.com/Lydanne/spaceflow) | 轻量 DI 容器（自研）        |
| [Rspack](https://rspack.dev/)                            | 构建打包                    |
| [i18next](https://www.i18next.com/)                      | 国际化                      |
| [Zod](https://zod.dev/)                                  | 配置校验与 JSON Schema 生成 |
| [MCP SDK](https://modelcontextprotocol.io/)              | Model Context Protocol 服务 |
| [pnpm](https://pnpm.io/)                                 | 包管理（Monorepo）          |

## 包结构

Spaceflow 采用 pnpm Monorepo 结构，主要包含以下包：

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

## 适用场景

- 需要在 CI 中集成 AI 代码审查的团队
- 需要统一管理多个仓库 CI/CD 流程的组织
- 希望将 AI 编程工具的技能和规范标准化分发的团队
- 需要自动化版本发布和变更日志生成的项目
- 需要通过 MCP 将工具能力暴露给 AI 编辑器的开发者
