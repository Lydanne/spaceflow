# Extension 系统

Spaceflow 的所有功能命令都以 Extension 形式组织。Extension 分为**内置命令**和**外部扩展**两类，但都使用相同的 `defineExtension()` API 定义。

## Extension 类型

### 内置命令

内置在 `@spaceflow/core` 中，无需安装即可使用：

| 命令        | 说明                 |
| ----------- | -------------------- |
| `install`   | 安装 Extension       |
| `uninstall` | 卸载 Extension       |
| `update`    | 更新 Extension       |
| `build`     | 构建 Extension       |
| `dev`       | 开发模式             |
| `create`    | 创建 Extension 模板  |
| `list`      | 列出已安装 Extension |
| `clear`     | 清理缓存             |
| `commit`    | AI 智能提交          |
| `setup`     | 初始化配置           |
| `schema`    | 生成 JSON Schema     |
| `mcp`       | MCP 服务             |
| `runx`      | 运行外部命令         |

### 外部扩展

独立的 npm 包，需要通过 `spaceflow install` 安装：

| Extension      | 包名                        | 说明           |
| -------------- | --------------------------- | -------------- |
| review         | `@spaceflow/review`         | AI 代码审查    |
| publish        | `@spaceflow/publish`        | 版本发布       |
| scripts        | `@spaceflow/scripts`        | 自定义脚本执行 |
| shell          | `@spaceflow/shell`          | Shell 命令执行 |
| review-summary | `@spaceflow/review-summary` | 审查总结       |

## Extension 生命周期

```text
install → 注册到配置文件 → CLI 启动时 dynamic import → ExtensionLoader 注册 → Commander 构建 → 可用
```

1. **安装** — `spaceflow install <package>` 下载依赖并注册
2. **注册** — 写入配置文件的 `dependencies` 字段
3. **加载** — CLI 壳子生成 `.spaceflow/bin/index.js`，动态 import 所有扩展
4. **注册** — `ExtensionLoader` 接收 `ExtensionDefinition`，注册命令和服务
5. **构建** — `exec()` 函数将所有命令添加到 Commander.js 程序
6. **执行** — 用户通过 `spaceflow <command>` 调用

## 定义 Extension

使用 `defineExtension()` 函数定义扩展，这是一个纯函数式 API：

```typescript
import { defineExtension } from "@spaceflow/core";

export default defineExtension({
  name: "hello",
  version: "1.0.0",
  description: "示例扩展",
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
      ],
      run: async (args, options, ctx) => {
        const name = args[0] || "World";
        ctx.output.info(`${options.greeting}, ${name}!`);
      },
    },
  ],
});
```

### ExtensionDefinition

| 字段                 | 类型                      | 必填 | 说明                                 |
| -------------------- | ------------------------- | ---- | ------------------------------------ |
| `name`               | `string`                  | ✅   | 扩展名称                             |
| `commands`           | `CommandDefinition[]`     | ✅   | 命令列表                             |
| `version`            | `string`                  | ❌   | 版本号                               |
| `description`        | `string`                  | ❌   | 扩展描述                             |
| `configKey`          | `string`                  | ❌   | 对应配置文件中的配置路径             |
| `configSchema`       | `() => ZodSchema`         | ❌   | 配置 Schema 工厂函数                 |
| `configDependencies` | `string[]`                | ❌   | 依赖的其他扩展配置 key               |
| `tools`              | `McpToolDefinition[]`     | ❌   | MCP 工具列表                         |
| `resources`          | `McpResourceDefinition[]` | ❌   | MCP 资源列表                         |
| `services`           | `ServiceDefinition[]`     | ❌   | 服务定义列表                         |
| `onInit`             | `(ctx) => Promise`        | ❌   | 初始化钩子（所有服务注册完毕后调用） |
| `onDestroy`          | `(ctx) => Promise`        | ❌   | 销毁钩子（CLI 退出前调用）           |

### CommandDefinition

| 字段              | 类型                           | 必填 | 说明                                  |
| ----------------- | ------------------------------ | ---- | ------------------------------------- |
| `name`            | `string`                       | ✅   | 命令名称                              |
| `description`     | `string`                       | ✅   | 命令描述                              |
| `run`             | `(args, opts, ctx) => Promise` | ✅   | 执行函数                              |
| `aliases`         | `string[]`                     | ❌   | 命令别名                              |
| `arguments`       | `string`                       | ❌   | 位置参数，如 `"<name>"` 或 `"[file]"` |
| `argsDescription` | `Record<string, string>`       | ❌   | 参数描述映射                          |
| `options`         | `OptionDefinition[]`           | ❌   | 命令选项                              |
| `subcommands`     | `CommandDefinition[]`          | ❌   | 子命令                                |

### SpaceflowContext

命令的 `run` 函数接收 `SpaceflowContext` 作为第三个参数，提供运行时服务访问：

```typescript
interface SpaceflowContext {
  readonly cwd: string; // 当前工作目录（优先 SPACEFLOW_CWD 环境变量）
  readonly config: IConfigReader; // 配置读取
  readonly output: IOutputService; // 输出服务（info/success/warn/error/debug）
  readonly storage: IStorageService; // 存储服务
  getService<T>(key: string): T; // 获取已注册的服务
  hasService(key: string): boolean; // 检查服务是否存在
  registerService(key: string, service: unknown): void; // 注册服务
}
```

## package.json 中的 spaceflow 配置

Extension 的 `package.json` 中通过 `spaceflow` 字段声明导出类型：

```json
{
  "spaceflow": {
    "type": "flow",
    "entry": "."
  }
}
```

多导出格式：

```json
{
  "spaceflow": {
    "exports": {
      "review": { "type": "flow", "entry": "." },
      "review-rules": { "type": "skill", "entry": "./skills" },
      "review-mcp": { "type": "mcp", "entry": "." }
    }
  }
}
```

导出类型：

| 类型      | 说明               | 安装行为                                   |
| --------- | ------------------ | ------------------------------------------ |
| `flow`    | CLI 子命令（默认） | 注册为 `spaceflow <command>`               |
| `skill`   | 技能文件           | 复制到编辑器的 `skills/` 目录              |
| `command` | 编辑器命令         | 生成 `.md` 文件到编辑器的 `commands/` 目录 |
| `mcp`     | MCP 工具           | 由 `spaceflow mcp` 统一聚合                |

## 管理命令

```bash
# 安装
spaceflow install @spaceflow/review

# 卸载
spaceflow uninstall @spaceflow/review

# 更新
spaceflow update

# 列出
spaceflow list
```

## 开发 Extension

请参考 [扩展开发指南](/advanced/plugin-development) 了解如何创建自定义 Extension。
