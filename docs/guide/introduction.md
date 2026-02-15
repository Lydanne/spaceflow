# 简介

## 什么是 Spaceflow？

Spaceflow 是一个**可扩展的 AI 工作流引擎**，为团队提供统一的 CI/CD 管理和 AI 代码审查能力。它基于 NestJS + nest-commander 构建，采用插件化架构，命令以 Extension 形式分发和管理。

## 核心特性

- **AI 代码审查** — 基于 LLM 的自动化代码审查，支持 OpenAI、Claude 等多种模型
- **Extension 插件系统** — 命令以插件包形式分发，支持 npm 包和本地链接
- **多编辑器集成** — 自动将技能关联到 Claude Code、Windsurf、Cursor 等 AI 编程工具
- **CI/CD 自动化** — 预配置 GitHub Actions，支持自动 PR 审查、版本发布
- **国际化** — 基于 i18next，每个 Extension 自管理翻译资源

## 技术栈

| 技术 | 用途 |
|------|------|
| [NestJS](https://nestjs.com/) | 核心框架，依赖注入和模块化 |
| [nest-commander](https://docs.nestjs.com/recipes/nest-commander) | CLI 命令系统 |
| [Rspack](https://rspack.dev/) | 构建打包 |
| [i18next](https://www.i18next.com/) | 国际化 |
| [Zod](https://zod.dev/) | 配置校验 |
| [pnpm](https://pnpm.io/) | 包管理（Monorepo） |

## 包结构

Spaceflow 采用 Monorepo 结构，主要包含以下包：

| 包名 | 说明 |
|------|------|
| `@spaceflow/core` | 核心能力库，提供 Git Provider、LLM Proxy、Logger 等基础模块 |
| `@spaceflow/cli` | CLI 入口，包含所有内置命令 |
| `@spaceflow/review` | AI 代码审查 Extension |
| `@spaceflow/publish` | 版本发布 Extension |
| `@spaceflow/ci-scripts` | 自定义脚本执行 Extension |
| `@spaceflow/ci-shell` | Shell 命令执行 Extension |
| `@spaceflow/period-summary` | 周期总结 Extension |

## 适用场景

- 需要在 CI 中集成 AI 代码审查的团队
- 需要统一管理多个仓库 CI/CD 流程的组织
- 希望将 AI 编程工具的技能和规范标准化分发的团队
- 需要自动化版本发布和变更日志生成的项目
