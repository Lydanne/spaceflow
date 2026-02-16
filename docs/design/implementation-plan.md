# Spaceflow 架构重构实施计划

> 基于 [architecture-v2.md](./architecture-v2.md) 的详细实施步骤

## 概览

| 阶段 | 内容 | 预计时间 | 依赖 |
|------|------|----------|------|
| 1 | CLI 内联构建（快速止血） | 1-2 天 | 无 |
| 2 | core 去 NestJS + 定义新接口 | 3-4 天 | 阶段 1 |
| 3 | CLI 去 NestJS | 3-5 天 | 阶段 2 |
| 4 | 迁移扩展 | 2.5-5 天 | 阶段 3 |

**总计**：10-16 天

---

## 阶段 1：CLI 内联构建（快速止血）

**目标**：解决全局安装多实例问题，不改业务代码

### 1.1 修改 CLI rspack 配置

**文件**：`packages/cli/rspack.config.mjs`

```javascript
// 当前 externals（需要移除）
externals: [
  { "@spaceflow/core": "module @spaceflow/core" },
  { "@nestjs/common": "module @nestjs/common" },
  // ...
]

// 改为：只排除 Node.js 内置模块
externals: [
  /^node:/,
]
```

### 1.2 验证步骤

```bash
# 1. 重新构建 CLI
cd packages/cli && pnpm build

# 2. 检查 bundle 大小（预期增大到 ~5MB）
ls -lh dist/cli.js

# 3. 全局安装测试
pnpm link --global

# 4. 在工作区目录测试
cd /path/to/some/workspace
space -h
space mcp --verbose
```

### 1.3 完成标准

- [ ] `space -h` 在任意目录正常输出帮助
- [ ] `space mcp` 能正确加载扩展的 MCP 工具
- [ ] 无 `UnknownDependenciesException` 错误

---

## 阶段 2：core 去 NestJS + 定义新接口

**目标**：core 变成纯工具库，定义新的扩展接口

### 2.1 新增类型定义

**新建文件**：`packages/core/src/extension-system/types.ts`

```typescript
// SpaceflowContext, CommandDefinition, ExtensionDefinition, 
// ServiceDefinition, McpToolDefinition, McpServerDefinition
// 详见 architecture-v2.md 2.3.1 节
```

**新建文件**：`packages/core/src/extension-system/define-extension.ts`

```typescript
export function defineExtension(def: ExtensionDefinition): ExtensionDefinition {
  return def;
}

export function defineMcpServer(def: McpServerDefinition): McpServerDefinition {
  return def;
}
```

### 2.2 配置系统重构

**修改文件**：`packages/core/src/config/config-reader.service.ts`

- 移除 `@Injectable()` 装饰器
- 移除对 `ConfigService` 的依赖
- 改为直接读取 `readConfigSync()` 的结果

**新建文件**：`packages/core/src/config/config-reader.ts`

```typescript
export class ConfigReader {
  private config: Record<string, unknown>;
  private schemas = new Map<string, ZodSchema>();

  constructor() {
    this.config = readConfigSync();
  }

  get<T>(key: string): T | undefined { /* ... */ }
  getPluginConfig<T>(key: string): T | undefined { /* ... */ }
  registerSchema(key: string, schema: ZodSchema): void { /* ... */ }
}
```

**新建文件**：`packages/core/src/config/load-env.ts`

```typescript
import { config } from "dotenv";

export function loadEnvFiles(paths: string[]): void {
  for (const p of paths.reverse()) {
    config({ path: p, override: false });
  }
}
```

### 2.3 服务去装饰器

需要修改的服务文件（按依赖顺序）：

| 文件 | 改动 |
|------|------|
| `shared/output/output.service.ts` | 移除 `@Injectable()` |
| `shared/storage/storage.service.ts` | 移除 `@Injectable()`、`@Inject()`，构造函数改为接收 config |
| `shared/git-sdk/git-sdk.service.ts` | 移除 `@Injectable()` |
| `shared/git-provider/git-provider.service.ts` | 移除 `@Injectable()`、`@Inject()`，构造函数改为接收 config |
| `shared/llm-proxy/llm-proxy.service.ts` | 移除 `@Injectable()`、`@Inject()`，构造函数改为接收 config |
| `shared/llm-proxy/adapters/*.adapter.ts` | 移除 `@Injectable()` |
| `shared/feishu-sdk/feishu-sdk.service.ts` | 移除 `@Injectable()`、`@Inject()` |
| `shared/claude-setup/claude-setup.service.ts` | 移除 `@Injectable()` |
| `config/schema-generator.service.ts` | 移除 `@Injectable()` |

### 2.4 移除 NestJS 模块

删除以下文件：

- `shared/storage/storage.module.ts`
- `shared/output/output.module.ts`
- `shared/git-provider/git-provider.module.ts`
- `shared/git-sdk/git-sdk.module.ts`
- `shared/llm-proxy/llm-proxy.module.ts`
- `shared/feishu-sdk/feishu-sdk.module.ts`
- `shared/claude-setup/claude-setup.module.ts`
- `config/config-reader.module.ts`
- `app.module.ts`

### 2.5 更新导出

**修改文件**：`packages/core/src/index.ts`

```typescript
// 移除 NestJS 重导出
// export { Module, Injectable, Inject, Global } from "@nestjs/common";
// export { ConfigModule, ConfigService } from "@nestjs/config";
// export { Command, CommandRunner, Option, SubCommand } from "nest-commander";

// 新增
export * from "./extension-system/types";
export * from "./extension-system/define-extension";
export { ConfigReader } from "./config/config-reader";
export { loadEnvFiles } from "./config/load-env";
```

### 2.6 更新 package.json

**修改文件**：`packages/core/package.json`

```json
{
  "dependencies": {
    // 移除
    // "@nestjs/common": "catalog:",
    // "@nestjs/config": "catalog:",
    // "@nestjs/core": "catalog:",
    // "nest-commander": "catalog:",
    // "reflect-metadata": "catalog:",
    
    // 新增
    "dotenv": "^16.4.5"
  }
}
```

### 2.7 验证步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 构建 core
cd packages/core && pnpm build

# 3. 类型检查
pnpm tsc --noEmit

# 4. 运行测试
pnpm test
```

### 2.8 完成标准

- [ ] core 构建成功，无 NestJS 依赖
- [ ] 所有类型定义导出正确
- [ ] 现有测试通过（可能需要调整 mock）

---

## 阶段 3：CLI 去 NestJS

**目标**：CLI 使用 commander.js，实现 ServiceContainer

### 3.1 新建 ServiceContainer

**新建文件**：`packages/cli/src/container/service-container.ts`

```typescript
// 实现 SpaceflowContext 接口
// 详见 architecture-v2.md 2.3.2 节
```

### 3.2 新建 ExtensionLoader

**新建文件**：`packages/cli/src/extension-loader/extension-loader.ts`

```typescript
// 加载 defineExtension 格式的扩展
// 注册扩展服务到 container
// 调用 onInit 钩子
```

### 3.3 重写 CLI 入口

**修改文件**：`packages/cli/src/cli.ts`

```typescript
// 详见 architecture-v2.md 3.2 节
import { Command } from "commander";
// ...
```

### 3.4 迁移内置命令

需要迁移的内置命令（按复杂度排序）：

| 命令 | 文件 | 复杂度 |
|------|------|--------|
| version | `commands/version/` | 低 |
| list | `commands/list/` | 低 |
| schema | `commands/schema/` | 低 |
| clear | `commands/clear/` | 低 |
| install | `commands/install/` | 中 |
| uninstall | `commands/uninstall/` | 中 |
| update | `commands/update/` | 中 |
| create | `commands/create/` | 中 |
| build | `commands/build/` | 中 |
| dev | `commands/dev/` | 中 |
| commit | `commands/commit/` | 中 |
| setup | `commands/setup/` | 中 |
| runx | `commands/runx/` | 中 |
| mcp | `commands/mcp/` | 高 |

**迁移模板**：

```typescript
// 旧版 (NestJS)
@Command({ name: "list", description: "..." })
export class ListCommand extends CommandRunner {
  constructor(private readonly service: ListService) { super(); }
  async run() { /* ... */ }
}

// 新版 (defineExtension)
export const listCommand: CommandDefinition = {
  name: "list",
  description: "...",
  async run(args, options, ctx) {
    // 直接使用 ctx，不需要 DI
  },
};
```

### 3.5 更新 package.json

**修改文件**：`packages/cli/package.json`

```json
{
  "dependencies": {
    // 新增
    "commander": "^12.1.0",
    
    // 移除 peerDependencies
  },
  "peerDependencies": {
    // 全部移除
  }
}
```

### 3.6 更新 rspack 配置

**修改文件**：`packages/cli/rspack.config.mjs`

```javascript
// 确保内联所有依赖
externals: [/^node:/],
```

### 3.7 验证步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 构建 CLI
cd packages/cli && pnpm build

# 3. 本地测试
node dist/cli.js -h
node dist/cli.js list
node dist/cli.js mcp --verbose

# 4. 全局安装测试
pnpm link --global
space -h
```

### 3.8 完成标准

- [ ] CLI 构建成功，无 NestJS 依赖
- [ ] 所有内置命令正常工作
- [ ] `space mcp` 能加载扩展（此时扩展仍是旧格式，需要兼容层或先迁移）

---

## 阶段 4：迁移扩展

**目标**：所有扩展迁移到 `defineExtension` 格式

### 4.1 迁移顺序

| 扩展 | 复杂度 | service 数量 | MCP |
|------|--------|--------------|-----|
| ci-scripts | 低 | 1 | 无 |
| ci-shell | 低 | 1 | 无 |
| publish | 中 | 2 | 无 |
| period-summary | 中 | 1 | 无 |
| review | 高 | 6 | 有 |

### 4.2 迁移模板

**旧版结构**：

```
extensions/ci-scripts/
  ├── src/
  │   ├── ci-scripts.module.ts      # 删除
  │   ├── ci-scripts.command.ts     # 合并到 index.ts
  │   ├── ci-scripts.service.ts     # 保留，去装饰器
  │   └── index.ts                  # 重写
  └── package.json                  # 更新
```

**新版结构**：

```
extensions/ci-scripts/
  ├── src/
  │   ├── ci-scripts.service.ts     # 纯 class
  │   ├── i18n.ts                   # 扩展自己的 i18n
  │   ├── locales/
  │   │   ├── zh-cn.json
  │   │   └── en.json
  │   └── index.ts                  # defineExtension
  └── package.json                  # 更新
```

### 4.3 扩展 package.json 更新

```json
{
  "peerDependencies": {
    // 移除所有 @nestjs/* 和 nest-commander
    "@spaceflow/core": "workspace:*"
  }
}
```

### 4.4 ci-scripts 迁移示例

**`extensions/ci-scripts/src/index.ts`**：

```typescript
import { defineExtension } from "@spaceflow/core";
import { z } from "zod";
import { t } from "./i18n";
import { CiScriptsService } from "./ci-scripts.service";
import type { GitProviderService } from "@spaceflow/core";

const CiConfigSchema = z.object({
  repository: z.string().optional(),
  refName: z.string().optional(),
});

export default defineExtension({
  name: "@spaceflow/ci-scripts",
  version: "0.19.3",
  configKey: "ci",
  configSchema: () => CiConfigSchema,

  services: [
    {
      key: "ci.service",
      factory: (ctx) => new CiScriptsService(
        ctx.getService<GitProviderService>("gitProvider"),
        ctx.config,
      ),
    },
  ],

  commands: [
    {
      name: "ci-script",
      description: t("description"),
      arguments: "<script>",
      options: [
        { flags: "-d, --dry-run", description: t("options.dryRun") },
      ],
      async run(args, options, ctx) {
        const service = ctx.getService<CiScriptsService>("ci.service");
        await service.execute(args.join(" "), options);
      },
    },
  ],
});
```

### 4.5 review 迁移（最复杂）

review 扩展有 6 个 service 和 MCP，需要特别注意：

**服务依赖链**：

```
ReviewSpecService ← ReviewReportService ← ReviewService
                                        ↑
                              LlmProxyService
```

**services 声明**：

```typescript
services: [
  { key: "review.specService", factory: (ctx) => new ReviewSpecService(ctx.config) },
  { key: "review.reportService", factory: (ctx) => new ReviewReportService(
    ctx.getService("review.specService"),
    ctx.getService("llmProxy"),
    ctx.config,
  )},
  { key: "review.issueVerify", factory: (ctx) => new IssueVerifyService(ctx.config) },
  { key: "review.deletionImpact", factory: (ctx) => new DeletionImpactService(ctx.config) },
  { key: "review.service", factory: (ctx) => new ReviewService(
    ctx.getService("review.specService"),
    ctx.getService("review.reportService"),
    ctx.getService("review.issueVerify"),
    ctx.getService("review.deletionImpact"),
    ctx.getService("gitProvider"),
    ctx.getService("llmProxy"),
    ctx.config,
  )},
],

mcp: defineMcpServer({
  name: "review-mcp",
  version: "1.0.0",
  tools: [
    {
      name: "list_rules",
      inputSchema: z.object({ cwd: z.string().optional() }),
      async handler(input, ctx) {
        const specService = ctx.getService<ReviewSpecService>("review.specService");
        return specService.listRules(input.cwd);
      },
    },
    // ... 其他工具
  ],
}),
```

### 4.6 验证步骤（每个扩展）

```bash
# 1. 构建扩展
cd extensions/ci-scripts && pnpm build

# 2. 在 .spaceflow 中安装
cd /path/to/test/project
pnpm add @spaceflow/ci-scripts --filter .spaceflow

# 3. 测试命令
space ci-script "console.log('test')" --dry-run

# 4. 测试 MCP（如果有）
space mcp --verbose
```

### 4.7 完成标准

- [ ] 所有 5 个扩展迁移完成
- [ ] 所有扩展命令正常工作
- [ ] review 扩展的 MCP 工具正常工作
- [ ] 全局安装 CLI 在工作区目录下正常工作

---

## 风险与回滚

### 风险点

1. **阶段 2-3 期间 CLI 不可用**：core 和 CLI 必须同步修改，中间状态无法运行
2. **扩展迁移期间兼容性**：如果需要支持新旧扩展格式混用，需要额外兼容层
3. **测试覆盖不足**：去除 NestJS 后部分测试可能失效

### 回滚策略

- **阶段 1**：直接 revert rspack 配置
- **阶段 2-4**：使用 git branch，整体回滚到迁移前

### 建议

1. 在独立分支进行迁移
2. 阶段 2-4 作为一个整体 PR 合并
3. 迁移完成后发布新的 major 版本（如 1.0.0）

---

## 检查清单

### 阶段 1 完成

- [ ] CLI rspack externals 修改
- [ ] 全局安装测试通过

### 阶段 2 完成

- [ ] 新类型定义文件创建
- [ ] ConfigReader 实现
- [ ] loadEnvFiles 实现
- [ ] 所有服务去装饰器
- [ ] 所有 NestJS 模块删除
- [ ] core 导出更新
- [ ] core package.json 更新
- [ ] core 构建通过
- [ ] core 测试通过

### 阶段 3 完成

- [ ] ServiceContainer 实现
- [ ] ExtensionLoader 实现
- [ ] CLI 入口重写
- [ ] 所有内置命令迁移
- [ ] CLI package.json 更新
- [ ] CLI 构建通过
- [ ] CLI 测试通过

### 阶段 4 完成

- [ ] ci-scripts 迁移
- [ ] ci-shell 迁移
- [ ] publish 迁移
- [ ] period-summary 迁移
- [ ] review 迁移
- [ ] 全局安装集成测试通过
