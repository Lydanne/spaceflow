# 核心模块

`@spaceflow/core` 提供的共享模块，所有 Extension 都可以导入使用。

## 模块总览

| 模块 | 导出 | 说明 |
|------|------|------|
| Git Provider | `GitProviderModule`, `GitProviderService` | Git 平台适配（GitHub / Gitea） |
| Git SDK | `GitSdkModule`, `GitSdkService` | Git 命令封装 |
| LLM Proxy | `LlmProxyModule`, `LlmProxyService` | 多 LLM 统一代理 |
| Feishu SDK | `FeishuSdkModule`, `FeishuSdkService` | 飞书 API |
| Storage | `StorageModule`, `StorageService` | 本地存储 |
| Parallel | `ParallelModule`, `ParallelService` | 并行执行工具 |
| Logger | `Logger` | 日志系统 |
| i18n | `t()`, `initI18n()`, `addLocaleResources()` | 国际化 |
| Config | `loadSpaceflowConfig()` | 配置加载 |

## Git Provider

Git 平台适配器，支持 GitHub 和 Gitea。

```typescript
import { GitProviderModule, GitProviderService } from "@spaceflow/core";

@Module({
  imports: [GitProviderModule.forFeature()],
})
export class MyModule {}

@Injectable()
export class MyService {
  constructor(private readonly gitProvider: GitProviderService) {}

  async createComment(prNumber: number, body: string): Promise<void> {
    await this.gitProvider.createPRComment(prNumber, body);
  }

  async listFiles(prNumber: number): Promise<string[]> {
    const files = await this.gitProvider.getPRFiles(prNumber);
    return files.map((f) => f.filename);
  }
}
```

### 支持的平台

| 平台 | 适配器 | 检测方式 |
|------|--------|----------|
| GitHub | `GithubAdapter` | `GITHUB_TOKEN` 环境变量 |
| Gitea | `GiteaAdapter` | `GITEA_TOKEN` 环境变量 |

默认使用 GitHub。可通过 `GIT_PROVIDER_TYPE` 环境变量显式指定。

## Git SDK

封装常用 Git 命令操作。

```typescript
import { GitSdkModule, GitSdkService } from "@spaceflow/core";

@Injectable()
export class MyService {
  constructor(private readonly gitSdk: GitSdkService) {}

  async getChanges(): Promise<string> {
    return this.gitSdk.diff("main", "HEAD");
  }

  async getCurrentBranch(): Promise<string> {
    return this.gitSdk.currentBranch();
  }
}
```

## LLM Proxy

多 LLM 统一代理，支持 OpenAI、Claude、Claude Code、OpenCode 等。

```typescript
import { LlmProxyModule, LlmProxyService } from "@spaceflow/core";

@Injectable()
export class MyService {
  constructor(private readonly llm: LlmProxyService) {}

  async analyze(code: string): Promise<string> {
    const result = await this.llm.chat({
      messages: [
        { role: "system", content: "你是一个代码分析助手" },
        { role: "user", content: `分析以下代码:\n${code}` },
      ],
    });
    return result.content;
  }
}
```

## Logger

日志系统，支持 Plain 模式（CI/管道）和 TUI 模式（终端交互）。

```typescript
import { Logger } from "@spaceflow/core";

const logger = new Logger("my-extension");
await logger.init(); // 加载 TUI 渲染器

// 基础日志
logger.info("信息");
logger.success("成功");
logger.warn("警告");
logger.error("错误");

// Spinner
const spinner = logger.spin("处理中...");
spinner.update("仍在处理...");
spinner.succeed("处理完成");

// 进度条
const progress = logger.progress({ total: 100, label: "下载" });
progress.update(50);
progress.finish();

// 子 Logger
const child = logger.child("compile");
child.info("编译中..."); // 输出: [my-extension:compile] 编译中...
```

### 日志级别

| 级别 | 说明 |
|------|------|
| `silent` | 不输出任何日志 |
| `info` | 默认级别 |
| `verbose` | 详细日志（`-v`） |
| `debug` | 调试日志（`-vv`） |

## Feishu SDK

飞书 API 封装，支持发送消息。

```typescript
import { FeishuSdkModule, FeishuSdkService } from "@spaceflow/core";

@Injectable()
export class MyService {
  constructor(private readonly feishu: FeishuSdkService) {}

  async notify(chatId: string, message: string): Promise<void> {
    await this.feishu.sendMessage(chatId, message);
  }
}
```

需要配置环境变量 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`。

## Storage

本地存储服务。

```typescript
import { StorageModule, StorageService } from "@spaceflow/core";

@Injectable()
export class MyService {
  constructor(private readonly storage: StorageService) {}

  async saveData(key: string, data: unknown): Promise<void> {
    await this.storage.set(key, data);
  }

  async loadData<T>(key: string): Promise<T | undefined> {
    return this.storage.get<T>(key);
  }
}
```

## Parallel

并行执行工具，支持并发控制。

```typescript
import { ParallelModule, ParallelService } from "@spaceflow/core";

@Injectable()
export class MyService {
  constructor(private readonly parallel: ParallelService) {}

  async processFiles(files: string[]): Promise<void> {
    await this.parallel.run(
      files,
      async (file) => {
        // 处理单个文件
      },
      { concurrency: 10 },
    );
  }
}
```
