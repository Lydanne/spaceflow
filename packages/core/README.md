# @spaceflow/core

[![npm version](https://img.shields.io/npm/v/@spaceflow/core?color=blue)](https://www.npmjs.com/package/@spaceflow/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow 核心运行时，包含 CLI 运行时引擎、13 个内置命令、扩展系统和共享模块。

## 安装

```bash
pnpm add @spaceflow/core
```

## 核心职责

- **CLI 运行时** — `exec()` 入口函数，初始化 i18n、ServiceContainer、ExtensionLoader，构建 Commander 命令树
- **13 个内置命令** — install、uninstall、build、dev、create、update、list、clear、runx、schema、commit、setup、mcp
- **扩展系统** — `defineExtension()` 纯函数式 API、类型定义（`ExtensionDefinition`、`CommandDefinition`、`SpaceflowContext`）
- **共享模块** — Git、LLM、Logger、Storage 等服务

## 快速上手

```typescript
// 扩展开发 — 使用 defineExtension 定义扩展
import { defineExtension, t } from "@spaceflow/core";

export default defineExtension({
  name: "my-extension",
  commands: [
    {
      name: "hello",
      description: "Say hello",
      run: async (args, options, ctx) => {
        ctx.output.info("Hello from my extension!");
      },
    },
  ],
});
```

```typescript
// 共享模块 — 直接导入使用
import {
  GitProviderService,
  GitSdkService,
  LlmProxyService,
  FeishuSdkService,
  LoggerService,
  ParallelService,
} from "@spaceflow/core";
```

## 共享模块

| 模块         | 说明                                      |
| ------------ | ----------------------------------------- |
| Git Provider | Git 平台适配器（GitHub / Gitea / GitLab） |
| Git SDK      | Git 命令操作封装                          |
| LLM Proxy    | 多 LLM 统一代理（OpenAI、Claude）         |
| Logger       | 日志系统（TUI / Plain 双模式）            |
| Feishu SDK   | 飞书 API 操作封装                         |
| Storage      | 通用存储服务（支持 TTL）                  |
| Parallel     | 并行执行工具                              |
| i18n         | 国际化（i18next）                         |

## 目录结构

```text
core/
├── src/
│   ├── cli-runtime/         # CLI 运行时引擎
│   │   ├── exec.ts          # exec() 入口
│   │   ├── service-container.ts  # DI 容器
│   │   ├── extension-loader.ts   # 扩展加载器
│   │   └── internal-extensions.ts # 内置扩展注册
│   ├── commands/            # 13 个内置命令
│   │   ├── build/
│   │   ├── clear/
│   │   ├── commit/
│   │   ├── create/
│   │   ├── dev/
│   │   ├── install/
│   │   ├── list/
│   │   ├── mcp/
│   │   ├── runx/
│   │   ├── schema/
│   │   ├── setup/
│   │   ├── uninstall/
│   │   └── update/
│   ├── config/              # 配置管理（Zod Schema）
│   ├── extension-system/    # 扩展系统核心
│   │   ├── types.ts         # ExtensionDefinition 等类型
│   │   ├── define-extension.ts  # defineExtension 工厂函数
│   │   └── extension.interface.ts # package.json spaceflow 字段解析
│   ├── locales/             # 国际化资源（en + zh-cn）
│   └── shared/              # 共享模块
│       ├── git-provider/    # Git 平台适配器
│       ├── git-sdk/         # Git 命令封装
│       ├── llm-proxy/       # LLM 统一代理
│       ├── feishu-sdk/      # 飞书 SDK
│       ├── logger/          # 日志系统（TUI/Plain）
│       ├── parallel/        # 并行执行工具
│       └── storage/         # 通用存储服务
```

## 开发

```bash
# 构建
pnpm run build

# 类型检查
pnpm run type-check
```

## 技术栈

- **Commander.js** — CLI 命令框架
- **ServiceContainer** — 自定义 DI 容器
- **Rspack** — 构建工具
- **i18next** — 国际化
- **Zod** — 配置校验
- **TypeScript** — 类型系统

## 许可证

[MIT](../../LICENSE)
