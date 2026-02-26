# 核心模块

`@spaceflow/core` 提供了一系列共享模块，Extension 可以直接导入使用。在新架构中，不再使用 NestJS 依赖注入，而是直接实例化或通过 `SpaceflowContext` 获取服务。

## 模块总览

| 模块         | 说明                                    |
| ------------ | --------------------------------------- |
| Git Provider | Git 平台适配（GitHub / Gitea / GitLab） |
| Git SDK      | Git 命令封装                            |
| LLM Proxy    | 多 LLM 统一代理                         |
| Logger       | 日志系统（Plain / TUI）                 |
| 飞书 SDK     | 飞书开放平台 API                        |
| Storage      | 本地存储（支持 TTL）                    |
| Parallel     | 并行执行工具                            |
| i18n         | 国际化                                  |

## Git Provider

Git 平台适配器，支持 GitHub、Gitea 和 GitLab。

```typescript
import { GitProviderService } from "@spaceflow/core";

const gitProvider = new GitProviderService();

// 获取 PR diff
const diff = await gitProvider.getPullRequestDiff(prNumber);

// 创建 PR 评论
await gitProvider.createPullRequestComment(prNumber, body);

// 创建行内审查评论
await gitProvider.createReviewComment(prNumber, {
  path: "src/index.ts",
  line: 42,
  body: "建议优化此处逻辑",
});

// 更新 PR 信息
await gitProvider.updatePullRequest(prNumber, { title, body });
```

### 支持的平台

| 平台   | 环境变量                            | 说明       |
| ------ | ----------------------------------- | ---------- |
| GitHub | `GITHUB_TOKEN`                      | GitHub API |
| Gitea  | `GITEA_TOKEN`, `GITEA_SERVER_URL`   | Gitea API  |
| GitLab | `GITLAB_TOKEN`, `GITLAB_SERVER_URL` | GitLab API |

平台类型通过 `GIT_PROVIDER_TYPE` 环境变量或配置文件的 `gitProvider.provider` 指定。

## Git SDK

Git 命令封装，提供常用 Git 操作。

```typescript
import { GitSdkService } from "@spaceflow/core";

const gitSdk = new GitSdkService();

const diff = await gitSdk.diff("HEAD~1", "HEAD");
const log = await gitSdk.log({ maxCount: 10 });
const status = await gitSdk.status();
```

### 主要方法

| 方法       | 说明           |
| ---------- | -------------- |
| `diff()`   | 获取代码差异   |
| `log()`    | 获取提交历史   |
| `status()` | 获取工作区状态 |
| `add()`    | 暂存文件       |
| `commit()` | 提交更改       |
| `push()`   | 推送到远程     |
| `fetch()`  | 获取远程更新   |

## LLM Proxy

多 LLM 统一代理，支持 OpenAI 和 Claude。

```typescript
import { LlmProxyService } from "@spaceflow/core";

const llm = new LlmProxyService();

const result = await llm.chat({
  messages: [
    { role: "system", content: "你是一个代码分析助手" },
    { role: "user", content: "分析以下代码..." },
  ],
});
console.log(result.content);
```

### 支持的模型

| 模式     | 环境变量                                | 说明       |
| -------- | --------------------------------------- | ---------- |
| `openai` | `OPENAI_API_KEY`, `OPENAI_API_BASE_URL` | OpenAI API |
| `claude` | `ANTHROPIC_API_KEY`                     | Claude API |

通过 `LLM_PROVIDER` 环境变量或命令行 `-l` 参数指定模式。

## Logger

日志系统，支持 Plain 和 TUI 两种模式。

```typescript
import { LoggerService } from "@spaceflow/core";

const logger = new LoggerService();

logger.info("操作开始");
logger.debug("调试信息");
logger.warn("警告");
logger.error("错误");
```

也可通过 `SpaceflowContext` 使用内置的输出服务：

```typescript
run: async (args, options, ctx) => {
  ctx.output.info("信息");
  ctx.output.success("成功");
  ctx.output.warn("警告");
  ctx.output.error("错误");
  ctx.output.debug("调试");
};
```

### 日志级别

| 级别    | 说明                   |
| ------- | ---------------------- |
| `error` | 错误，始终显示         |
| `warn`  | 警告，始终显示         |
| `info`  | 信息，默认显示         |
| `debug` | 调试，`-v` 时显示      |
| `trace` | 详细跟踪，`-vv` 时显示 |

## 飞书 SDK

飞书开放平台 API 封装。

```typescript
import { FeishuSdkService } from "@spaceflow/core";

const feishu = new FeishuSdkService();

await feishu.sendMessage({
  chatId: "oc_xxx",
  content: message,
});
```

### 环境变量

| 变量                | 说明         |
| ------------------- | ------------ |
| `FEISHU_APP_ID`     | 飞书应用 ID  |
| `FEISHU_APP_SECRET` | 飞书应用密钥 |

## Storage

本地存储，支持 TTL（过期时间）。通过 `SpaceflowContext` 使用：

```typescript
run: async (args, options, ctx) => {
  // 存储数据，TTL 1小时
  await ctx.storage.set("cache-key", { data: "value" }, 3600);

  // 读取数据
  const cached = await ctx.storage.get<MyData>("cache-key");

  // 删除数据
  await ctx.storage.del("cache-key");
};
```

## Parallel

并行执行工具，支持并发控制。

```typescript
import { ParallelService } from "@spaceflow/core";

const parallel = new ParallelService();

const results = await parallel.run(
  files,
  async (file) => {
    return processFile(file);
  },
  { concurrency: 5 },
);
```

## i18n

国际化工具函数。

```typescript
import { t, addLocaleResources } from "@spaceflow/core";

// 注册翻译资源
addLocaleResources("my-ext", {
  "zh-CN": { greeting: "你好" },
  en: { greeting: "Hello" },
});

// 使用翻译
const message = t("my-ext:greeting"); // "你好" 或 "Hello"
```

详细说明请参考 [i18n 国际化](/advanced/i18n)。
