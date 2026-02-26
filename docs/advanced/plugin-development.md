# 扩展开发指南

本指南介绍如何开发自定义 Spaceflow Extension。

## 前置知识

- TypeScript 基础
- [Commander.js](https://github.com/tj/commander.js) CLI 命令概念（可选）
- [Zod](https://zod.dev/) Schema 定义（可选，用于配置校验）

## 快速开始

### 使用模板创建

```bash
# 创建命令型 Extension
spaceflow create command my-extension

# 创建 MCP Server 型 Extension
spaceflow create mcp my-mcp

# 创建技能型 Extension
spaceflow create skills my-skill
```

### 手动创建

```bash
mkdir spaceflow-plugin-hello
cd spaceflow-plugin-hello
pnpm init
pnpm add -D @spaceflow/cli typescript @types/node
```

## 目录结构

```text
spaceflow-plugin-hello/
├── src/
│   ├── hello.service.ts       # 业务逻辑
│   └── index.ts               # Extension 入口（defineExtension）
├── package.json
├── tsconfig.json
└── README.md
```

## Extension 入口

使用 `defineExtension()` 定义扩展，这是一个纯函数式 API：

```typescript
// src/index.ts
import { defineExtension } from "@spaceflow/core";
import { HelloService } from "./hello.service";

export default defineExtension({
  name: "hello",
  version: "1.0.0",
  description: "示例 Extension",
  configKey: "hello",

  commands: [
    {
      name: "hello",
      description: "打招呼命令",
      arguments: "[name]",
      options: [
        {
          flags: "-g, --greeting <greeting>",
          description: "自定义问候语",
          default: "Hello",
        },
        {
          flags: "-v, --verbose",
          description: "详细输出",
        },
      ],
      run: async (args, options, ctx) => {
        const helloService = new HelloService();
        const name = args[0] || "World";
        const greeting = (options.greeting as string) || "Hello";
        ctx.output.info(helloService.greet(greeting, name));
      },
    },
  ],
});
```

## 业务逻辑

```typescript
// src/hello.service.ts
export class HelloService {
  greet(greeting: string, name: string): string {
    return `${greeting}, ${name}!`;
  }
}
```

## 使用 SpaceflowContext

命令的 `run` 函数接收 `SpaceflowContext`，提供运行时能力：

```typescript
run: async (args, options, ctx) => {
  // 读取配置
  const config = ctx.config.getPluginConfig<MyConfig>("hello");

  // 输出
  ctx.output.info("信息");
  ctx.output.success("成功");
  ctx.output.warn("警告");
  ctx.output.error("错误");

  // 存储
  await ctx.storage.set("key", { data: "value" });
  const data = await ctx.storage.get<MyData>("key");

  // 获取其他已注册的服务
  if (ctx.hasService("myService")) {
    const svc = ctx.getService<MyService>("myService");
  }
};
```

## 注册服务

Extension 可以通过 `services` 字段注册可被其他扩展使用的服务：

```typescript
export default defineExtension({
  name: "hello",
  commands: [
    /* ... */
  ],
  services: [
    {
      key: "hello.service",
      factory: (ctx) => new HelloService(ctx),
    },
  ],
});
```

其他扩展可通过 `ctx.getService("hello.service")` 获取。

## 配置 Schema

使用 Zod 定义配置 Schema，提供类型校验和 JSON Schema 自动生成：

```typescript
import { defineExtension, z } from "@spaceflow/core";

export default defineExtension({
  name: "hello",
  configKey: "hello",
  configSchema: () =>
    z.object({
      greeting: z.string().default("Hello").describe("默认问候语"),
      maxRetries: z.number().default(3).describe("最大重试次数"),
    }),
  commands: [
    {
      name: "hello",
      description: "打招呼命令",
      run: async (args, options, ctx) => {
        const config = ctx.config.getPluginConfig<{ greeting: string }>(
          "hello",
        );
        ctx.output.info(config?.greeting || "Hello");
      },
    },
  ],
});
```

运行 `spaceflow schema` 后，`hello` 的配置会自动出现在 JSON Schema 中。

## 生命周期钩子

```typescript
export default defineExtension({
  name: "hello",
  commands: [
    /* ... */
  ],

  // 所有服务注册完毕后调用
  onInit: async (ctx) => {
    ctx.output.debug("hello extension initialized");
  },

  // CLI 退出前调用
  onDestroy: async (ctx) => {
    ctx.output.debug("hello extension destroyed");
  },
});
```

## MCP 工具

Extension 可以同时提供 CLI 命令和 MCP 工具：

```typescript
import { defineExtension, z } from "@spaceflow/core";

export default defineExtension({
  name: "hello",
  commands: [
    /* ... */
  ],
  mcp: {
    name: "hello-tools",
    version: "1.0.0",
    description: "Hello MCP 工具集",
    tools: [
      {
        name: "greet",
        description: "生成问候语",
        inputSchema: z.object({
          name: z.string().describe("名字"),
        }),
        handler: async (input, ctx) => {
          const { name } = input as { name: string };
          return { content: [{ type: "text", text: `Hello, ${name}!` }] };
        },
      },
    ],
  },
});
```

## package.json 规范

```json
{
  "name": "@spaceflow/plugin-hello",
  "version": "1.0.0",
  "description": "Spaceflow Hello Extension",
  "main": "./dist/index.js",
  "type": "module",
  "scripts": {
    "build": "spaceflow build",
    "dev": "spaceflow dev"
  },
  "devDependencies": {
    "@spaceflow/cli": "workspace:*"
  },
  "peerDependencies": {
    "@spaceflow/core": "workspace:*"
  },
  "spaceflow": {
    "type": "flow",
    "entry": "."
  }
}
```

### 多导出格式

如果 Extension 同时提供命令、技能和 MCP：

```json
{
  "spaceflow": {
    "exports": {
      "hello": { "type": "flow", "entry": "." },
      "hello-skills": { "type": "skill", "entry": "./skills" },
      "hello-mcp": {
        "type": "mcp",
        "entry": ".",
        "mcp": { "command": "node", "args": ["dist/mcp.js"] }
      }
    }
  }
}
```

## 构建与发布

### 构建

```bash
spaceflow build
```

Extension 使用 Rspack 构建，默认配置会自动处理 TypeScript 编译和打包。

### 本地测试

在配置文件中使用 `link:` 引用本地 Extension：

```json
{
  "dependencies": {
    "@spaceflow/plugin-hello": "link:./path/to/plugin-hello"
  }
}
```

然后运行 `spaceflow install` 即可加载。

### 发布到 npm

```bash
npm publish
```

用户安装：

```bash
spaceflow install @spaceflow/plugin-hello
```
