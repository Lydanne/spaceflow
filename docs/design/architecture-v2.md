# Spaceflow 架构重设计方案 v2

> 目标：去除 NestJS 依赖，简化架构，解决全局安装时的模块多实例问题

## 1. 当前架构问题分析

### 1.1 核心矛盾

当前架构使用 NestJS 作为基础框架，带来以下问题：

| 问题               | 影响                                                                                                     | 根因                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **ESM 多实例**     | 全局安装 CLI 在工作区目录下执行时，扩展加载的 `@nestjs/common` 与 CLI 的版本不一致，导致 DI token 不匹配 | ESM 模块解析从文件路径向上查找 `node_modules`，全局 CLI 和本地扩展解析到不同版本 |
| **启动慢**         | 每次执行 `space -h` 都要初始化完整 DI 容器                                                               | NestJS 设计用于长运行 Web 服务，不适合 CLI 场景                                  |
| **错误吞没**       | NestJS `ExceptionsZone` 默认静默 `process.exit(1)`                                                       | 需要手动配置 `abortOnError: false`                                               |
| **扩展开发门槛高** | 开发者必须理解 Module/Injectable/Provider 概念                                                           | NestJS DI 概念对 CLI 扩展来说过于复杂                                            |
| **包体积大**       | `@spaceflow/cli` 全局安装拉取 1400+ 个包                                                                 | NestJS 及其依赖链庞大                                                            |

### 1.2 当前依赖关系

```text
@spaceflow/cli
  ├── @spaceflow/core (workspace:*)
  ├── @nestjs/common (peer)
  ├── @nestjs/config (peer)
  ├── @nestjs/core (peer)
  ├── nest-commander (peer)
  └── reflect-metadata (peer)

@spaceflow/core
  ├── @nestjs/common
  ├── @nestjs/config
  ├── @nestjs/core
  ├── nest-commander
  └── 30+ 其他依赖

extensions/*
  ├── @spaceflow/core (peer)
  ├── @nestjs/common (peer)
  ├── @nestjs/config (peer)
  └── nest-commander (peer)
```

### 1.3 NestJS 在当前项目中的实际用途

| 用途                                     | 使用频率             | 替代难度 |
| ---------------------------------------- | -------------------- | -------- |
| `@Injectable()` + 构造函数注入           | 高（~20 个 service） | 低       |
| `@Module({ imports, providers })`        | 高（每个扩展一个）   | 低       |
| `ConfigService.get()`                    | 高                   | 低       |
| `@Command` + `@Option` + `CommandRunner` | 高（每个命令）       | 低       |
| `forRoot()` / `forFeature()` 动态模块    | 中                   | 中       |
| `DynamicModule`                          | 中                   | 中       |

**结论**：NestJS 的核心价值（DI、模块化）可以用更轻量的方案替代。

---

## 2. 新架构设计

### 2.1 设计原则

1. **CLI 优先**：为 CLI 场景优化，而非 Web 服务
2. **零运行时依赖冲突**：CLI 打包为单一 bundle，不依赖外部 `node_modules`
3. **扩展开发简单**：扩展只需导出一个对象，不需要理解 DI 概念
4. **配置模式不变**：保持 `.spaceflow/`、`spaceflowrc`、`spaceflow.json` 的配置方式
5. **渐进式迁移**：可以分阶段实施，不需要一次性重写

### 2.2 新包结构

```
@spaceflow/core（纯工具库，无框架依赖）
  ├── 共享服务（纯 class，无装饰器）
  │   ├── GitProviderService
  │   ├── LlmProxyService
  │   ├── FeishuSdkService
  │   ├── StorageService
  │   └── OutputService
  ├── 配置系统（纯函数）
  │   ├── readConfigSync()
  │   ├── writeConfigSync()
  │   ├── createConfigLoader()
  │   └── getEnvFilePaths()
  ├── 工具函数
  │   ├── spaceflow-dir
  │   ├── source-utils
  │   ├── package-manager
  │   └── git-sdk
  ├── rspack 构建配置
  └── 类型定义

@spaceflow/cli（独立 bundle，不依赖外部 node_modules）
  ├── 命令框架（基于 commander.js）
  ├── 扩展加载器
  ├── 服务容器（轻量 DI）
  ├── 内置命令
  ├── i18n（CLI 自己的翻译）
  └── 构建时内联所有依赖

extensions/*（轻量扩展）
  ├── 导出 defineExtension() 定义
  ├── 依赖 @spaceflow/core（工具库）
  ├── 各自的 i18n 翻译
  └── 不依赖任何框架
```

### 2.3 核心概念

#### 2.3.1 扩展接口（新）

```typescript
// @spaceflow/core 导出

/**
 * 命令定义
 */
interface CommandDefinition {
  /** 命令名称 */
  name: string;
  /** 命令描述 */
  description: string;
  /** 命令别名 */
  aliases?: string[];
  /** 位置参数，如 "<source>" 或 "[target]" */
  arguments?: string;
  /** 参数描述 */
  argsDescription?: Record<string, string>;
  /** 命令选项 */
  options?: OptionDefinition[];
  /** 子命令 */
  subcommands?: CommandDefinition[];
  /** 执行函数 */
  run: (
    args: string[],
    options: Record<string, unknown>,
    ctx: SpaceflowContext,
  ) => Promise<void>;
}

/**
 * 选项定义
 */
interface OptionDefinition {
  /** 选项标志，如 "-d, --dry-run" */
  flags: string;
  /** 选项描述 */
  description: string;
  /** 默认值 */
  default?: unknown;
  /** 解析函数 */
  parse?: (value: string, previous: unknown) => unknown;
}

/**
 * 统一上下文（命令和 MCP 共用）
 *
 * 所有服务通过字符串 key 获取，避免 class 引用跨 bundle 不匹配的问题。
 * CLI 在启动时注册所有核心服务，扩展通过 ctx 访问。
 */
interface SpaceflowContext {
  /** 配置读取 */
  readonly config: ConfigReader;
  /** 输出服务 */
  readonly output: OutputService;
  /** 存储服务 */
  readonly storage: StorageService;
  /**
   * 获取已注册的服务实例（使用字符串 key）
   *
   * 核心服务 key 约定：
   * - "gitProvider" → GitProviderService
   * - "llmProxy"    → LlmProxyService
   * - "feishuSdk"   → FeishuSdkService
   * - "gitSdk"      → GitSdkService
   * - "claudeSetup" → ClaudeSetupService
   *
   * 扩展服务 key 约定："{extConfigKey}.{serviceName}"
   * 如 "review.specService" → ReviewSpecService
   */
  getService<T = unknown>(key: string): T;
}

/**
 * 服务工厂定义
 * 扩展通过此声明自己提供的服务及其依赖
 */
interface ServiceDefinition {
  /** 服务 key（在 SpaceflowContext.getService 中使用） */
  key: string;
  /**
   * 工厂函数，接收 ctx 返回服务实例
   * CLI 在扩展加载后调用此函数创建实例并注册到容器
   */
  factory: (ctx: SpaceflowContext) => unknown;
}

/**
 * 扩展定义
 */
interface ExtensionDefinition {
  /** 扩展名称 */
  name: string;
  /** 扩展版本 */
  version?: string;
  /** 扩展描述 */
  description?: string;
  /** 配置 key */
  configKey?: string;
  /** 配置 schema（zod） */
  configSchema?: () => ZodSchema;
  /** 依赖的其他扩展配置 */
  configDependencies?: string[];
  /** 提供的命令 */
  commands: CommandDefinition[];
  /** 提供的 MCP 服务（可选） */
  mcp?: McpServerDefinition;
  /** 提供的服务及工厂函数（可选） */
  services?: ServiceDefinition[];
  /** 初始化钩子（所有服务注册完毕后调用） */
  onInit?: (ctx: SpaceflowContext) => Promise<void>;
  /** 销毁钩子 */
  onDestroy?: (ctx: SpaceflowContext) => Promise<void>;
}

/**
 * 定义扩展的工厂函数
 */
function defineExtension(definition: ExtensionDefinition): ExtensionDefinition;
```

> **设计要点**：所有服务通过字符串 key 获取，而非 class 引用。这样即使 CLI（bundle）和扩展（动态加载）使用了不同版本的 `@spaceflow/core`，服务查找基于字符串匹配，不受 class 引用不一致的影响。

#### 2.3.2 服务容器（轻量 DI）

不使用 NestJS 的完整 DI 容器，而是使用简单的服务注册表。
所有服务统一使用**字符串 key** 注册和获取，避免跨 bundle class 引用不匹配。

```typescript
// CLI 内部实现

class ServiceContainer implements SpaceflowContext {
  private services = new Map<string, unknown>();
  private factories = new Map<string, (ctx: SpaceflowContext) => unknown>();

  // SpaceflowContext 快捷属性
  get config(): ConfigReader {
    return this.getService("config");
  }
  get output(): OutputService {
    return this.getService("output");
  }
  get storage(): StorageService {
    return this.getService("storage");
  }

  /** 注册服务实例 */
  register(key: string, instance: unknown): void {
    this.services.set(key, instance);
  }

  /** 注册懒加载工厂（首次 getService 时创建） */
  registerFactory(
    key: string,
    factory: (ctx: SpaceflowContext) => unknown,
  ): void {
    this.factories.set(key, factory);
  }

  /** 获取服务（字符串 key） */
  getService<T = unknown>(key: string): T {
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }
    if (this.factories.has(key)) {
      const instance = this.factories.get(key)!(this);
      this.services.set(key, instance);
      this.factories.delete(key);
      return instance as T;
    }
    throw new Error(`Service "${key}" not found`);
  }

  /**
   * 注册扩展提供的服务
   * 在扩展加载后，CLI 遍历 ext.services 调用此方法
   */
  registerExtensionServices(services: ServiceDefinition[]): void {
    for (const svc of services) {
      this.registerFactory(svc.key, svc.factory);
    }
  }
}
```

#### 2.3.3 配置系统（保持不变）

配置系统的核心逻辑保持不变，只是去掉 NestJS 的 `registerAs`：

```typescript
// @spaceflow/core

/**
 * 配置读取器
 */
class ConfigReader {
  private config: Record<string, unknown>;
  private schemas: Map<string, ZodSchema> = new Map();

  constructor() {
    this.config = readConfigSync();
  }

  /** 获取配置 */
  get<T>(key: string): T | undefined {
    return this.config[key] as T;
  }

  /** 获取插件配置（带验证） */
  getPluginConfig<T>(key: string): T | undefined {
    const schema = this.schemas.get(key);
    const raw = this.config[key];
    if (!schema || !raw) return raw as T;
    return schema.parse(raw) as T;
  }

  /** 注册配置 schema */
  registerSchema(key: string, schema: ZodSchema): void {
    this.schemas.set(key, schema);
  }
}
```

### 2.4 扩展示例（新 vs 旧）

#### 旧版（NestJS）

```typescript
// scripts.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GitProviderModule, ciConfig } from "@spaceflow/core";
import { ScriptsCommand } from "./scripts.command";
import { ScriptsService } from "./scripts.service";

@Module({
  imports: [ConfigModule.forFeature(ciConfig), GitProviderModule.forFeature()],
  providers: [ScriptsCommand, ScriptsService],
})
export class ScriptsModule {}

// scripts.command.ts
import { Command, CommandRunner, Option } from "nest-commander";

@Command({
  name: "script",
  description: "执行脚本",
  arguments: "<script>",
})
export class ScriptsCommand extends CommandRunner {
  constructor(private readonly scriptsService: ScriptsService) {
    super();
  }

  async run(params: string[], options: { dryRun: boolean }): Promise<void> {
    // ...
  }

  @Option({ flags: "-d, --dry-run", description: "试运行模式" })
  parseDryRun(val: boolean): boolean {
    return val;
  }
}

// index.ts
import type { SpaceflowExtension } from "@spaceflow/core";
import { ScriptsModule } from "./scripts.module";

export class ScriptsExtension implements SpaceflowExtension {
  getMetadata() {
    return {
      name: "@spaceflow/scripts",
      commands: ["script"],
      configKey: "ci",
    };
  }
  getModule() {
    return ScriptsModule;
  }
}
export default ScriptsExtension;
```

#### 新版（无 NestJS）

```typescript
// index.ts
import { defineExtension } from "@spaceflow/core";
import { z } from "zod";
import { t } from "./i18n";
import type { GitProviderService } from "@spaceflow/core";

const CiConfigSchema = z.object({
  repository: z.string().optional(),
  refName: z.string().optional(),
});

type CiConfig = z.infer<typeof CiConfigSchema>;

export default defineExtension({
  name: "@spaceflow/scripts",
  version: "0.19.3",
  description: "脚本执行插件",
  configKey: "ci",
  configSchema: () => CiConfigSchema,

  commands: [
    {
      name: "script",
      description: t("description"),
      arguments: "<script>",
      argsDescription: { script: t("argsDescription.script") },
      options: [{ flags: "-d, --dry-run", description: t("options.dryRun") }],

      async run(args, options, ctx) {
        const script = args.join(" ");
        if (!script) {
          ctx.output.error(t("noScript"));
          process.exit(1);
        }

        // 通过字符串 key 获取服务，而非 class 引用
        const gitProvider = ctx.getService<GitProviderService>("gitProvider");
        const ciConfig = ctx.config.getPluginConfig<CiConfig>("ci");

        const [owner, repo] = ciConfig!.repository!.split("/");
        const branch = ciConfig!.refName!;

        if (!options.dryRun) {
          await gitProvider.lockBranch(owner, repo, branch);
        }

        eval(script);

        if (!options.dryRun) {
          await gitProvider.unlockBranch(owner, repo, branch);
        }
      },
    },
  ],
});
```

**对比**：

- 旧版：3 个文件，~100 行，需要理解 Module/Injectable/Command/CommandRunner
- 新版：1 个文件，~60 行，只需理解 `defineExtension` 接口
- **关键变化**：`ctx.getService<GitProviderService>("gitProvider")` 用字符串 key + type-only import，class 引用仅用于类型推断，不影响运行时

---

## 3. CLI 架构

### 3.1 启动流程

```
space <command> [options]
       │
       ▼
  ┌─────────────────┐
  │   cli.ts        │
  │   (入口)        │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 1. 初始化 i18n  │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 2. 加载配置     │
  │ readConfigSync()│
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 3. 初始化服务   │
  │ ServiceContainer│
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 4. 加载扩展     │
  │ ExtensionLoader │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 5. 注册命令     │
  │ commander.js    │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 6. 解析并执行   │
  │ program.parse() │
  └─────────────────┘
```

### 3.2 CLI 入口（新）

```typescript
// packages/cli/src/cli.ts
import { Command } from "commander";
import { initCliI18n, t } from "./i18n";
import {
  ConfigReader,
  OutputService,
  StorageService,
  GitProviderService,
  LlmProxyService,
  loadEnvFiles,
  getEnvFilePaths,
} from "@spaceflow/core";
import { ServiceContainer } from "./container";
import { ExtensionLoader } from "./extension-loader";
import { internalExtensions } from "./internal-extensions";

async function main() {
  // 1. 加载 .env 文件（替代 @nestjs/config 的 envFilePath）
  loadEnvFiles(getEnvFilePaths());

  // 2. 初始化 CLI 自身的 i18n
  initCliI18n();

  // 3. 加载配置
  const configReader = new ConfigReader();

  // 4. 初始化服务容器（注册核心服务）
  const container = new ServiceContainer();
  container.register("config", configReader);
  container.register("output", new OutputService());
  container.registerFactory(
    "storage",
    (ctx) => new StorageService(ctx.config.get("storage")),
  );
  container.registerFactory(
    "gitProvider",
    (ctx) => new GitProviderService(ctx.config.get("gitProvider")),
  );
  container.registerFactory(
    "llmProxy",
    (ctx) => new LlmProxyService(ctx.config.get("llm")),
  );

  // 5. 加载扩展 → 注册扩展服务 → 调用 onInit
  const extensionLoader = new ExtensionLoader(container);
  extensionLoader.registerInternal(internalExtensions);
  await extensionLoader.discoverAndLoad();

  // 6. 创建 CLI 程序
  const program = new Command();
  program
    .name("space")
    .description(t("cli.description"))
    .version(require("../package.json").version);

  // 7. 注册所有命令
  for (const ext of extensionLoader.getExtensions()) {
    for (const cmd of ext.commands) {
      registerCommand(program, cmd, container);
    }
  }

  // 8. 解析并执行
  await program.parseAsync(process.argv);
}

function registerCommand(
  program: Command,
  cmd: CommandDefinition,
  container: ServiceContainer,
) {
  const command = program.command(cmd.name).description(cmd.description);

  if (cmd.arguments) {
    command.argument(cmd.arguments, cmd.argsDescription);
  }

  for (const opt of cmd.options || []) {
    command.option(opt.flags, opt.description, opt.default);
  }

  // container 本身实现了 SpaceflowContext，直接作为 ctx 传入
  command.action(async (...args) => {
    const options = args[args.length - 2];
    const params = args.slice(0, -2);
    await cmd.run(params, options, container);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 3.3 构建配置

CLI 构建时内联所有依赖，生成单一 bundle：

```javascript
// packages/cli/rspack.config.mjs
export default {
  entry: "./src/cli.ts",
  output: {
    filename: "cli.js",
    path: "./dist",
  },
  target: "node",
  externals: [
    // 只排除 Node.js 内置模块
    /^node:/,
    // 不排除任何 npm 包，全部内联
  ],
  // ...
};
```

**效果**：

- `dist/cli.js` 包含所有代码（CLI + core + commander + 其他依赖）
- 全局安装时只有一个 JS 文件，无模块解析问题
- 扩展加载时，CLI 提供统一的服务实例

---

## 4. 服务设计

### 4.1 服务分类

| 类别         | 示例                                        | 初始化时机 | 生命周期   |
| ------------ | ------------------------------------------- | ---------- | ---------- |
| **核心服务** | ConfigReader, OutputService, StorageService | CLI 启动时 | 全局单例   |
| **按需服务** | GitProviderService, LlmProxyService         | 首次使用时 | 懒加载单例 |
| **扩展服务** | ReviewService, PublishService               | 扩展加载时 | 扩展作用域 |

### 4.2 服务实现（无装饰器）

```typescript
// @spaceflow/core

/**
 * Git Provider 服务
 */
export class GitProviderService {
  private config: GitProviderConfig;
  private client: GiteaClient | GitHubClient;

  constructor(config: GitProviderConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  private createClient() {
    switch (this.config.provider) {
      case "gitea":
        return new GiteaClient(this.config);
      case "github":
        return new GitHubClient(this.config);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  async lockBranch(owner: string, repo: string, branch: string) {
    return this.client.lockBranch(owner, repo, branch);
  }

  async unlockBranch(owner: string, repo: string, branch: string) {
    return this.client.unlockBranch(owner, repo, branch);
  }
}
```

### 4.3 服务注册与生命周期

```typescript
// CLI 内部 - ExtensionLoader.discoverAndLoad()

async discoverAndLoad(): Promise<void> {
  const extensions = await this.loadAllExtensions();

  for (const ext of extensions) {
    // 1. 注册扩展的配置 schema
    if (ext.configKey && ext.configSchema) {
      this.container.config.registerSchema(ext.configKey, ext.configSchema());
    }

    // 2. 注册扩展提供的服务（懒加载工厂）
    if (ext.services) {
      this.container.registerExtensionServices(ext.services);
    }
  }

  // 3. 所有服务注册完毕后，调用 onInit 钩子
  for (const ext of extensions) {
    if (ext.onInit) {
      await ext.onInit(this.container);
    }
  }
}
```

**扩展服务示例**（review 扩展有多个互相依赖的服务）：

```typescript
// extensions/review/src/index.ts
export default defineExtension({
  name: "@spaceflow/review",
  configKey: "review",

  services: [
    {
      key: "review.specService",
      factory: (ctx) => new ReviewSpecService(ctx.config),
    },
    {
      key: "review.reportService",
      factory: (ctx) =>
        new ReviewReportService(
          ctx.getService("review.specService"),
          ctx.getService("llmProxy"),
          ctx.config,
        ),
    },
  ],

  commands: [
    /* ... */
  ],
  mcp: defineMcpServer({
    tools: [
      {
        name: "list_rules",
        async handler(input, ctx) {
          // MCP 和命令使用同一个 ctx，服务获取方式一致
          const specService =
            ctx.getService<ReviewSpecService>("review.specService");
          return specService.listRules();
        },
      },
    ],
  }),
});
```

> **注意**：服务 factory 中的依赖是懒加载的。`ctx.getService("llmProxy")` 在 factory 被调用时才真正创建 `LlmProxyService` 实例。因此即使声明顺序不对，只要最终所有服务都注册了就不会出问题。

---

## 5. i18n 设计

### 5.1 各库自管理

每个包管理自己的翻译资源：

```text
@spaceflow/core
  └── locales/
      ├── zh-cn.json  # core 的翻译
      └── en.json

@spaceflow/cli
  └── locales/
      ├── zh-cn.json  # CLI 内置命令的翻译
      └── en.json

extensions/review
  └── locales/
      ├── zh-cn.json  # review 扩展的翻译
      └── en.json
```

### 5.2 初始化时序

i18n 的关键问题是：`t()` 在模块加载时（`defineExtension` 对象字面量中）就被调用，
此时 i18n 必须已经初始化。

**时序保证**：

```text
1. CLI 启动 → loadEnvFiles() → 环境变量就绪
2. CLI 调用 initCoreI18n()  → core 的翻译 + 语言检测完成
3. CLI 调用 initCliI18n()   → CLI 自身翻译注册
4. CLI 动态 import 扩展     → 扩展模块顶层的 initI18n() 执行
                             → 扩展的 t() 在 defineExtension 对象中求值 ✅
```

**核心规则**：`initCoreI18n()` 必须在任何扩展 `import` 之前调用。
这与当前架构中 `initI18n()` 在 `cli.ts` 顶部调用的模式一致。

### 5.3 翻译函数

```typescript
// @spaceflow/core 提供基础 i18n 引擎

import i18next from "i18next";
import { detectLocale } from "./locale-detect";

let coreInitialized = false;

/**
 * 初始化 core i18n 引擎（CLI 启动时调用一次）
 * 创建 i18next 实例、检测语言、加载 core 的翻译
 */
export function initCoreI18n(lang?: string): void {
  if (coreInitialized) return;
  const lng = lang || detectLocale();
  void i18next.init({
    lng,
    fallbackLng: "zh-CN",
    defaultNS: "core",
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  });
  // 注册 core 自身的翻译
  addLocaleResources("core", { "zh-CN": coreZhCN, en: coreEn });
  coreInitialized = true;
}

/**
 * 注册命名空间翻译资源（各包各自调用）
 */
export function addLocaleResources(
  ns: string,
  resources: Record<string, Record<string, unknown>>,
): void {
  if (!coreInitialized) initCoreI18n();
  for (const [lng, translations] of Object.entries(resources)) {
    i18next.addResourceBundle(lng, ns, translations, true, true);
  }
}

/** 翻译函数（全局可用） */
export function t(key: string, options?: object): string {
  if (!coreInitialized) initCoreI18n();
  return i18next.t(key, options) as string;
}
```

```typescript
// extensions/review/src/i18n.ts
// 扩展自管理翻译，模块顶层注册（import 时执行）
import { addLocaleResources, t as coreT } from "@spaceflow/core";
import zhCN from "./locales/zh-cn.json";
import en from "./locales/en.json";

addLocaleResources("review", { "zh-CN": zhCN, en });

/** 扩展内部使用的翻译函数，自动加 namespace 前缀 */
export function t(key: string, options?: object): string {
  return coreT(`review:${key}`, options);
}
```

---

## 6. MCP 支持设计

### 6.1 当前 MCP 实现分析

当前 MCP 实现依赖 NestJS：

```typescript
// 当前：使用 @McpServer 和 @McpTool 装饰器
@McpServer({ name: "review-mcp", version: "1.0.0" })
export class ReviewMcp {
  constructor(
    private readonly specService: ReviewSpecService, // NestJS DI 注入
    private readonly configReader: ConfigReaderService,
  ) {}

  @McpTool({ name: "list_rules", description: "获取规则", dto: ListRulesInput })
  async listRules(input: ListRulesInput) {
    // ...
  }
}
```

**问题**：

- `@McpServer` 内部调用 `@Injectable()`，依赖 NestJS
- MCP 服务通过 `ModuleRef.get()` 从 NestJS 容器获取实例
- 工具参数使用 `@ApiProperty` + `class-validator`，依赖 Swagger 元数据

### 6.2 新 MCP 设计

#### 6.2.1 MCP 工具定义

```typescript
// @spaceflow/core 导出

/**
 * MCP 工具定义
 */
interface McpToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数 schema（zod） */
  inputSchema?: ZodSchema;
  /** 执行函数（使用与命令相同的 SpaceflowContext） */
  handler: (input: unknown, ctx: SpaceflowContext) => Promise<unknown>;
}

/**
 * MCP 服务定义
 */
interface McpServerDefinition {
  /** 服务名称 */
  name: string;
  /** 服务版本 */
  version?: string;
  /** 服务描述 */
  description?: string;
  /** 提供的工具 */
  tools: McpToolDefinition[];
}

/**
 * 定义 MCP 服务的工厂函数
 */
function defineMcpServer(definition: McpServerDefinition): McpServerDefinition;
```

> **设计要点**：MCP 工具的 handler 使用与命令相同的 `SpaceflowContext`，不再有单独的 `McpContext`。
> 这意味着 MCP 工具可以像命令一样访问 `ctx.config`、`ctx.output`、`ctx.getService("key")`。

#### 6.2.2 扩展中定义 MCP

在 `ExtensionDefinition` 中增加 `mcp` 字段：

```typescript
interface ExtensionDefinition {
  name: string;
  version?: string;
  description?: string;
  configKey?: string;
  configSchema?: () => ZodSchema;

  /** 提供的命令 */
  commands: CommandDefinition[];

  /** 提供的 MCP 服务（新增） */
  mcp?: McpServerDefinition;

  /** 提供的服务类（可选） */
  services?: ServiceDefinition[];
}
```

#### 6.2.3 扩展示例（新）

```typescript
// extensions/review/src/index.ts
import { defineExtension, defineMcpServer, z } from "@spaceflow/core";
import { ReviewSpecService } from "./review-spec.service";

const ListRulesInputSchema = z.object({
  cwd: z.string().optional().describe("项目目录"),
});

export default defineExtension({
  name: "@spaceflow/review",
  version: "0.29.3",
  configKey: "review",

  commands: [
    // ... 命令定义
  ],

  // MCP 服务定义
  mcp: defineMcpServer({
    name: "review-mcp",
    version: "1.0.0",
    description: "代码审查规则查询服务",

    tools: [
      {
        name: "list_rules",
        description: "获取所有审查规则",
        inputSchema: ListRulesInputSchema,
        async handler(input, ctx) {
          const specService = ctx.getService(ReviewSpecService);
          const reviewConfig = ctx.config.getPluginConfig("review");

          const cwd = input.cwd || process.cwd();
          const specDirs = await getSpecDirs(cwd, reviewConfig, specService);
          const rules = await specService.listRules(specDirs);

          return { rules };
        },
      },
      {
        name: "get_rules_for_file",
        description: "获取指定文件适用的规则",
        inputSchema: z.object({
          filePath: z.string().describe("文件路径"),
          cwd: z.string().optional(),
        }),
        async handler(input, ctx) {
          const specService = ctx.getService(ReviewSpecService);
          // ...
          return { rules };
        },
      },
    ],
  }),

  // 扩展提供的服务
  services: [{ class: ReviewSpecService }],
});
```

### 6.3 CLI MCP 命令实现

```typescript
// packages/cli/src/commands/mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export const mcpCommand: CommandDefinition = {
  name: "mcp",
  description: "启动 MCP Server",
  options: [
    { flags: "-v, --verbose", description: "详细输出" },
    { flags: "--inspector", description: "启动 MCP Inspector" },
  ],

  async run(args, options, ctx) {
    const extensionLoader = ctx.getService(ExtensionLoader);
    const extensions = extensionLoader.getExtensions();

    // 收集所有扩展的 MCP 工具
    const allTools: Array<{ tool: McpToolDefinition; ext: LoadedExtension }> =
      [];

    for (const ext of extensions) {
      if (ext.mcp?.tools) {
        for (const tool of ext.mcp.tools) {
          allTools.push({ tool, ext });
        }
      }
    }

    if (allTools.length === 0) {
      ctx.output.error("没有找到 MCP 工具");
      process.exit(1);
    }

    // 创建 MCP Server
    const server = new McpServer({ name: "spaceflow", version: "1.0.0" });

    // 注册所有工具
    for (const { tool, ext } of allTools) {
      // container 实现了 SpaceflowContext，MCP 和命令使用同一个 ctx
      server.tool(
        tool.name,
        tool.description,
        tool.inputSchema ? zodToMcpSchema(tool.inputSchema) : {},
        async (input) => {
          try {
            const result = await tool.handler(input, ctx);
            return {
              content: [
                {
                  type: "text",
                  text:
                    typeof result === "string"
                      ? result
                      : JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${error instanceof Error ? error.message : error}`,
                },
              ],
              isError: true,
            };
          }
        },
      );
    }

    // 启动 stdio 传输
    const transport = new StdioServerTransport();
    await server.connect(transport);

    if (options.verbose) {
      console.error(`MCP Server started with ${allTools.length} tools`);
    }
  },
};
```

### 6.4 MCP 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      space mcp                               │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              ExtensionLoader                         │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │    │
│  │  │ review  │  │ publish │  │  ...    │              │    │
│  │  │  .mcp   │  │  .mcp   │  │  .mcp   │              │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘              │    │
│  └───────┼────────────┼────────────┼───────────────────┘    │
│          │            │            │                         │
│          ▼            ▼            ▼                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 MCP Server                           │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │    │
│  │  │list_rules  │ │get_rule    │ │publish_pkg │       │    │
│  │  └────────────┘ └────────────┘ └────────────┘       │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              StdioServerTransport                    │    │
│  │                   (stdin/stdout)                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Claude / Cursor     │
              │   (MCP Client)        │
              └───────────────────────┘
```

### 6.5 MCP 设计对比

| 方面       | 旧版（NestJS）                     | 新版（无框架）               |
| ---------- | ---------------------------------- | ---------------------------- |
| 定义方式   | `@McpServer` + `@McpTool` 装饰器   | `defineMcpServer()` 工厂函数 |
| 参数验证   | `@ApiProperty` + `class-validator` | `zod` schema                 |
| 依赖注入   | NestJS `ModuleRef.get()`           | `ctx.getService()`           |
| 服务实例化 | NestJS DI 容器                     | ServiceContainer             |
| 代码量     | ~50 行/MCP 服务                    | ~30 行/MCP 服务              |

---

## 7. 迁移计划

### 7.1 阶段一：CLI 内联构建（1-2 天）

**目标**：解决全局安装多实例问题，不改代码

1. 修改 CLI 的 rspack 配置，移除 `@spaceflow/core` 和 `@nestjs/*` 的 externals
2. CLI 构建时内联所有依赖
3. 测试全局安装

**风险**：低，只改构建配置

### 7.2 阶段二：core 去 NestJS + 定义新接口（3-4 天）

**目标**：core 去除 NestJS 依赖，定义新的扩展接口

1. 在 core 中定义 `defineExtension`、`defineMcpServer`、`SpaceflowContext`、`ServiceDefinition` 等类型
2. core 中的服务去除 `@Injectable()`、`@Module()` 等装饰器，改为纯 class + 构造函数接收配置
3. 移除 `forRoot()`、`forFeature()` 模式
4. 配置系统去除 `registerAs()`，改为纯函数 `readConfigSync()` + `ConfigReader` class
5. 新增 `loadEnvFiles()` 函数替代 `@nestjs/config` 的 `.env` 加载

**风险**：中，需要修改所有服务，但逻辑不变只是去装饰器

### 7.3 阶段三：CLI 去 NestJS（3-5 天）

**目标**：CLI 内部去除 NestJS，使用 commander.js

1. 用 commander.js 替换 nest-commander
2. 实现 `ServiceContainer`（实现 `SpaceflowContext` 接口）
3. 重写 `ExtensionLoader`（加载 `defineExtension` 格式的扩展）
4. 迁移内置命令到新格式
5. 配置 rspack 内联所有依赖

**风险**：中，需要重写 CLI 核心逻辑

### 7.4 阶段四：迁移扩展（每个扩展 0.5-1 天）

**目标**：将现有扩展迁移到 `defineExtension` 接口

1. 按复杂度排序：ci-scripts → ci-shell → publish → review-summary → period-summary
2. 每个扩展：去除 NestJS 装饰器 → 改用 `defineExtension` → 声明 `services` 工厂 → 各自管理 i18n
3. 每个扩展迁移后单独测试

**风险**：中，review 扩展最复杂（6 个 service + MCP），其他较简单

---

## 8. 兼容性考虑

### 8.1 配置兼容

- `.spaceflow/` 目录结构不变
- `.spaceflowrc`、`spaceflow.json` 格式不变
- 环境变量读取方式不变
- 配置优先级不变

### 8.2 API 兼容

core 导出的工具函数保持不变：

- `readConfigSync()`
- `writeConfigSync()`
- `getSpaceflowDir()`
- `detectPackageManager()`
- 等等

---

## 9. 预期收益

| 指标               | 当前          | 预期           |
| ------------------ | ------------- | -------------- |
| CLI 全局安装包数量 | ~1400         | ~50            |
| CLI 启动时间       | ~500ms        | ~100ms         |
| 扩展开发代码量     | ~100 行/扩展  | ~50 行/扩展    |
| 扩展开发学习成本   | 需理解 NestJS | 只需理解接口   |
| 全局安装兼容性     | ❌ 多实例问题 | ✅ 单一 bundle |

---

## 10. 已确定的设计决策

1. **服务依赖注入** → 通过 `ServiceDefinition.factory(ctx)` 工厂函数，接收 `SpaceflowContext` 从中获取依赖。服务工厂懒加载，依赖顺序无关。

2. **扩展间通信** → 所有服务统一注册到 `ServiceContainer`，扩展通过 `ctx.getService("extName.serviceName")` 访问其他扩展的服务。

3. **MCP 支持** → 扩展定义中增加 `mcp` 字段（详见第 6 章），使用与命令相同的 `SpaceflowContext`。

4. **测试策略** → 去除 NestJS 后，服务是纯 class，直接 `new Service(mockConfig)` 实例化测试。不再需要 `@nestjs/testing` 的 `TestingModule`，用 vitest 的 `vi.mock()` 即可。

5. **服务获取方式** → 统一使用字符串 key（而非 class 引用），避免跨 bundle 的 class 引用不匹配问题。扩展中可用 `import type` 获取类型提示。

---

## 11. 错误处理策略

### 11.1 扩展加载失败

- 单个扩展加载失败不影响其他扩展，输出警告后继续
- 扩展的 `onInit` 抛出异常时，该扩展的命令不注册，但其他扩展正常工作

### 11.2 命令执行失败

- `cmd.run()` 抛出异常时，CLI 捕获并输出错误信息，然后 `process.exit(1)`
- 扩展不应直接调用 `process.exit()`，而是抛出异常由 CLI 统一处理

### 11.3 服务创建失败

- `getService(key)` 找不到服务时抛出明确的 `ServiceNotFoundError`
- factory 执行失败时，包装为 `ServiceCreationError` 并包含原始错误

---

## 12. 附录

### 12.1 参考项目

- **commander.js**：Node.js CLI 框架标准选择
- **tsyringe**：轻量 DI 容器（可选）
- **cosmiconfig**：配置文件加载（可选）
- **esbuild/rspack**：打包工具

### 12.2 相关文档

- [Commander.js 文档](https://github.com/tj/commander.js)
- [tsyringe 文档](https://github.com/microsoft/tsyringe)
- [Rspack 文档](https://rspack.dev/)
