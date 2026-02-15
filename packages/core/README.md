# @spaceflow/core

[![npm version](https://img.shields.io/npm/v/@spaceflow/core?color=blue)](https://www.npmjs.com/package/@spaceflow/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow 核心能力库，提供共享模块、扩展系统基础设施和平台适配层。

## 安装

```bash
pnpm add @spaceflow/core
```

## 共享模块

核心库导出以下共享模块，供扩展开发使用：

| 模块              | 导入路径                          | 说明                                      |
| ----------------- | --------------------------------- | ----------------------------------------- |
| `git-provider`    | `@spaceflow/core`                 | Git 平台适配器（GitHub / Gitea / GitLab） |
| `git-sdk`         | `@spaceflow/core`                 | Git 命令操作封装                          |
| `llm-proxy`       | `@spaceflow/core/llm-proxy`       | 多 LLM 适配器（OpenAI、Claude、Gemini）   |
| `llm-jsonput`     | `@spaceflow/core/llm-jsonput`     | LLM JSON 结构化输出                       |
| `feishu-sdk`      | `@spaceflow/core`                 | 飞书 API 操作封装                         |
| `storage`         | `@spaceflow/core`                 | 通用存储服务                              |
| `logger`          | `@spaceflow/core`                 | 日志系统（TUI / Plain 双模式）            |
| `parallel`        | `@spaceflow/core/parallel`        | 并行执行工具                              |
| `verbose`         | `@spaceflow/core/verbose`         | 日志级别控制                              |
| `editor-config`   | `@spaceflow/core/editor-config`   | 编辑器配置管理                            |
| `source-utils`    | `@spaceflow/core/source-utils`    | 源码工具                                  |
| `package-manager` | `@spaceflow/core/package-manager` | 包管理器抽象                              |
| `rspack-config`   | `@spaceflow/core/rspack-config`   | Rspack 构建配置                           |

## 快速上手

```typescript
import {
  GitProviderService,
  GitSdkService,
  LlmProxyService,
  FeishuSdkService,
  StorageService,
  Logger,

  // NestJS 重导出
  Command,
  CommandRunner,
  Module,
  Injectable,
} from "@spaceflow/core";
```

## 目录结构

```text
core/
├── src/
│   ├── config/              # 配置管理（Zod Schema）
│   ├── extension-system/    # 扩展系统核心
│   ├── locales/             # 国际化资源（i18next）
│   ├── shared/              # 共享模块
│   │   ├── git-provider/    # Git 平台适配器
│   │   │   └── adapters/    # GitHub / Gitea / GitLab 实现
│   │   ├── git-sdk/         # Git 命令封装
│   │   ├── llm-proxy/       # LLM 统一代理
│   │   ├── llm-jsonput/     # JSON 结构化输出
│   │   ├── feishu-sdk/      # 飞书 SDK
│   │   ├── logger/          # 日志系统（TUI/Plain）
│   │   ├── parallel/        # 并行执行工具
│   │   ├── storage/         # 通用存储服务
│   │   ├── editor-config/   # 编辑器配置管理
│   │   ├── verbose/         # 日志级别控制
│   │   ├── source-utils/    # 源码工具
│   │   ├── package-manager/ # 包管理器抽象
│   │   └── rspack-config/   # Rspack 构建配置
│   ├── app.module.ts        # NestJS 根模块
│   └── index.ts             # 库导出入口
└── test/                    # E2E 测试
```

## 开发

```bash
# 构建
pnpm run build

# 测试
pnpm run test

# 代码检查
pnpm run lint

# 代码格式化
pnpm run format
```

## 技术栈

- **NestJS** — 依赖注入框架
- **nest-commander** — CLI 命令框架
- **Rspack** — 构建工具
- **i18next** — 国际化
- **Zod** — 配置校验
- **TypeScript** — 类型系统

## 许可证

[MIT](../../LICENSE)
