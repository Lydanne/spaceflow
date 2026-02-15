# 插件开发指南

本指南介绍如何开发自定义 Spaceflow Extension。

## 前置知识

- [NestJS](https://nestjs.com/) 基础（Module、Injectable、依赖注入）
- [nest-commander](https://docs.nestjs.com/recipes/nest-commander) CLI 命令定义
- TypeScript

## 快速开始

### 使用模板创建

```bash
spaceflow create my-extension
```

这会在当前目录下创建一个标准的 Extension 模板。

### 手动创建

```bash
mkdir spaceflow-plugin-hello
cd spaceflow-plugin-hello
pnpm init
pnpm add @spaceflow/core
pnpm add -D typescript @types/node
```

## 目录结构

```text
spaceflow-plugin-hello/
├── src/
│   ├── hello.command.ts       # 命令定义
│   ├── hello.service.ts       # 业务逻辑
│   ├── hello.module.ts        # NestJS 模块
│   ├── locales/               # i18n 资源
│   │   ├── zh-cn/
│   │   │   └── hello.json
│   │   ├── en/
│   │   │   └── hello.json
│   │   └── index.ts
│   └── index.ts               # Extension 入口
├── package.json
├── tsconfig.json
└── README.md
```

## Extension 入口

每个 Extension 必须实现 `SpaceflowExtension` 接口：

```typescript
// src/index.ts
import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
} from "@spaceflow/core";
import { HelloModule } from "./hello.module";
import { helloLocales } from "./locales";

export class HelloExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return {
      name: "hello",
      commands: ["hello"],
      configKey: "hello",
      description: "示例 Extension",
      locales: helloLocales,
    };
  }

  getModule() {
    return HelloModule;
  }
}

export default HelloExtension;
```

## 命令定义

使用 `@Command` 装饰器定义 CLI 命令：

```typescript
// src/hello.command.ts
import { Command, CommandRunner, Option } from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { HelloService } from "./hello.service";

interface HelloOptions {
  readonly name?: string;
}

@Command({
  name: "hello",
  description: t("hello:description"),
})
export class HelloCommand extends CommandRunner {
  constructor(private readonly helloService: HelloService) {
    super();
  }

  async run(_params: string[], options: HelloOptions): Promise<void> {
    const name = options.name ?? "World";
    console.log(this.helloService.greet(name));
  }

  @Option({
    flags: "-n, --name <name>",
    description: t("hello:options.name"),
  })
  parseName(val: string): string {
    return val;
  }
}
```

## 业务逻辑

```typescript
// src/hello.service.ts
import { Injectable } from "@spaceflow/core";

@Injectable()
export class HelloService {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}
```

## NestJS 模块

```typescript
// src/hello.module.ts
import { Module } from "@spaceflow/core";
import { HelloCommand } from "./hello.command";
import { HelloService } from "./hello.service";

@Module({
  providers: [HelloCommand, HelloService],
})
export class HelloModule {}
```

## 使用核心能力

Extension 可以导入 `@spaceflow/core` 提供的共享模块：

```typescript
import { Module } from "@spaceflow/core";
import { GitSdkModule } from "@spaceflow/core";
import { LlmProxyModule } from "@spaceflow/core";

@Module({
  imports: [
    GitSdkModule,       // Git 命令封装
    LlmProxyModule,     // 多 LLM 代理
  ],
  providers: [MyCommand, MyService],
})
export class MyModule {}
```

在 Service 中注入使用：

```typescript
import { Injectable } from "@spaceflow/core";
import { GitSdkService } from "@spaceflow/core";

@Injectable()
export class MyService {
  constructor(private readonly gitSdk: GitSdkService) {}

  async getDiff(): Promise<string> {
    return this.gitSdk.diff("HEAD~1", "HEAD");
  }
}
```

### 可用的核心模块

| 模块 | 说明 |
|------|------|
| `GitProviderModule` | Git 平台适配器（GitHub / Gitea） |
| `GitSdkModule` | Git 命令封装 |
| `LlmProxyModule` | 多 LLM 统一代理 |
| `FeishuSdkModule` | 飞书 API |
| `StorageModule` | 本地存储 |
| `ParallelModule` | 并行执行工具 |

## package.json 规范

```json
{
  "name": "@spaceflow/plugin-hello",
  "version": "1.0.0",
  "description": "Spaceflow Hello Extension",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "@spaceflow/core": "^0.17.0"
  },
  "spaceflow": {
    "commands": ["hello"],
    "configKey": "hello"
  }
}
```

## i18n 支持

在 `locales/` 目录下管理翻译资源：

```typescript
// src/locales/index.ts
import zhCN from "./zh-cn/hello.json";
import en from "./en/hello.json";
import { addLocaleResources } from "@spaceflow/core";

export const helloLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

// Side-effect: 立即注册资源
addLocaleResources("hello", helloLocales);
```

```json
// src/locales/zh-cn/hello.json
{
  "description": "打招呼命令",
  "options.name": "名字"
}
```

```json
// src/locales/en/hello.json
{
  "description": "Say hello",
  "options.name": "Name"
}
```

## 构建与发布

### 构建

```bash
spaceflow build
```

### 本地测试

在 `spaceflow.json` 中使用 `link:` 引用本地 Extension：

```json
{
  "dependencies": {
    "@spaceflow/plugin-hello": "link:./path/to/plugin-hello"
  }
}
```

### 发布到 npm

```bash
npm publish
```

用户安装：

```bash
spaceflow install @spaceflow/plugin-hello
```
