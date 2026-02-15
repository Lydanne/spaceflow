# @spaceflow/cli

Spaceflow CLI 核心框架，提供插件系统、内置命令和共享模块。

## 安装

```bash
pnpm add @spaceflow/cli
```

## 使用

### 命令行

```bash
# 使用 spaceflow 或 space 命令
spaceflow <command> [options]
space <command> [options]
```

### 作为库使用

```typescript
import {
  // 插件系统
  SpaceflowPlugin,
  PluginLoaderService,

  // 共享模块
  GitProviderService,
  GitSdkService,
  LlmProxyService,
  FeishuSdkService,
  StorageService,

  // NestJS 重导出
  Command,
  CommandRunner,
  Module,
  Injectable,
} from "@spaceflow/cli";
```

## 内置命令

| 命令         | 描述                  |
| ------------ | --------------------- |
| `install`    | 安装插件（命令/技能） |
| `uninstall`  | 卸载插件              |
| `build`      | 构建插件              |
| `dev`        | 开发模式运行          |
| `create`     | 创建新插件            |
| `list`       | 列出已安装插件        |
| `clear`      | 清理缓存              |
| `runx` / `x` | 执行插件命令          |
| `schema`     | 生成配置 Schema       |
| `commit`     | 智能提交              |
| `setup`      | 初始化配置            |

## 共享模块

核心框架导出以下共享模块，供插件开发使用：

| 模块            | 描述                                  |
| --------------- | ------------------------------------- |
| `git-provider`  | Git 平台适配器（GitHub/Gitea/GitLab） |
| `git-sdk`       | Git 命令操作封装                      |
| `llm-proxy`     | 多 LLM 适配器（OpenAI、Claude 等）    |
| `feishu-sdk`    | 飞书 API 操作封装                     |
| `storage`       | 通用存储服务                          |
| `claude-setup`  | Claude Agent 配置                     |
| `parallel`      | 并行执行工具                          |
| `output`        | 输出服务                              |
| `verbose`       | 日志级别控制                          |
| `editor-config` | 编辑器配置管理                        |
| `llm-jsonput`   | JSON 结构化输出                       |

## 插件开发

### 创建插件

```bash
spaceflow create my-plugin --type command
```

### 插件结构

```typescript
import {
  SpaceflowPlugin,
  Module,
  Command,
  CommandRunner,
} from "@spaceflow/cli";

@Command({ name: "my-command", description: "My command description" })
class MyCommand extends CommandRunner {
  async run(): Promise<void> {
    console.log("Hello from my command!");
  }
}

@Module({ providers: [MyCommand] })
class MyModule {}

export class MyPlugin implements SpaceflowPlugin {
  name = "my-plugin";
  version = "1.0.0";
  module = MyModule;
}
```

## 目录结构

```
core/
├── src/
│   ├── commands/          # 内置命令
│   │   ├── install/       # 插件安装
│   │   ├── uninstall/     # 插件卸载
│   │   ├── build/         # 插件构建
│   │   ├── dev/           # 开发模式
│   │   ├── create/        # 创建插件
│   │   ├── list/          # 列出插件
│   │   ├── clear/         # 清理缓存
│   │   ├── runx/          # 执行命令
│   │   ├── schema/        # Schema 生成
│   │   ├── commit/        # 智能提交
│   │   └── setup/         # 初始化配置
│   ├── shared/            # 共享模块
│   │   ├── git-provider/  # Git Provider 适配器
│   │   ├── git-sdk/       # Git SDK
│   │   ├── llm-proxy/     # LLM 代理
│   │   ├── feishu-sdk/    # 飞书 SDK
│   │   ├── storage/       # 存储服务
│   │   └── ...
│   ├── plugin-system/     # 插件系统核心
│   ├── config/            # 配置管理
│   ├── cli.ts             # CLI 入口
│   └── index.ts           # 库导出
└── test/                  # 测试文件
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run start:dev

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

- **NestJS** - 依赖注入框架
- **nest-commander** - CLI 命令框架
- **rspack** - 构建工具
- **TypeScript** - 类型系统

## 许可证

UNLICENSED
