# Review 模块

Review 是 spaceflow 的核心模块，提供基于 LLM 的自动化代码审查功能。支持在 GitHub Actions CI 环境中运行，也可在本地命令行使用。

## 目录结构

```text
review/
├── index.ts                      # 模块导出入口
├── review.module.ts              # NestJS 模块定义
├── review.command.ts             # CLI 命令定义
├── review.service.ts             # 核心审查服务
├── review.service.spec.ts        # 审查服务单元测试
├── issue-verify.service.ts       # 历史问题验证服务
├── issue-verify.service.spec.ts  # 验证服务单元测试
├── deletion-impact.service.ts    # 删除代码影响分析服务
├── deletion-impact.service.spec.ts # 删除分析服务单元测试
├── parse-title-options.ts        # PR 标题参数解析
├── parse-title-options.spec.ts   # 标题解析单元测试
```

## 模块依赖

```text
ReviewModule
├── ConfigModule          # 配置管理
├── GitProviderModule      # Git Provider 适配器
├── ClaudeSetupModule     # Claude CLI 配置
├── ReviewSpecModule      # 审查规范加载
├── ReviewReportModule    # 审查报告格式化
├── GitSdkModule          # Git 命令封装
└── LlmProxyModule        # LLM 统一代理（支持 OpenAI/Claude/Gemini）
```

## 核心功能

### 1. ReviewCommand

CLI 命令入口，支持以下参数：

| 参数                              | 简写 | 说明                                  |
| --------------------------------- | ---- | ------------------------------------- |
| `--dry-run`                       | `-d` | 仅打印将要执行的操作，不实际提交评论  |
| `--ci`                            | `-c` | 在 CI 环境中运行                      |
| `--pr-number <number>`            | `-p` | PR 编号                               |
| `--base <ref>`                    | `-b` | 基准分支/tag                          |
| `--head <ref>`                    |      | 目标分支/tag                          |
| `--verbose [level]`               | `-v` | 详细输出 (1: 过程日志, 2: 含提示词)   |
| `--includes <patterns...>`        | `-i` | 文件 glob 过滤模式                    |
| `--llm-mode <mode>`               | `-l` | LLM 模式: claude-code, openai, gemini |
| `--files <files...>`              | `-f` | 仅审查指定文件                        |
| `--commits <commits...>`          |      | 仅审查指定 commits                    |
| `--verify-fixes`                  |      | 验证历史问题是否已修复                |
| `--no-verify-fixes`               |      | 禁用历史问题验证                      |
| `--verify-concurrency <n>`        |      | 验证并发数（默认 10）                 |
| `--analyze-deletions`             |      | 分析删除代码影响                      |
| `--deletion-only`                 |      | 仅执行删除代码分析                    |
| `--deletion-analysis-mode <mode>` |      | 删除分析模式: openai, claude-code     |
| `--output-format <format>`        | `-o` | 输出格式: markdown, terminal, json    |
| `--generate-description`          |      | 使用 AI 生成 PR 功能描述              |

**环境变量**：

- `GITHUB_TOKEN`: GitHub API Token
- `GITHUB_REPOSITORY`: 仓库名称 (owner/repo 格式)
- `GITHUB_REF_NAME`: 当前分支名称
- `GITHUB_EVENT_PATH`: 事件文件路径

### 2. ReviewService

核心审查服务，主要功能：

#### 2.1 审查流程

```text
getContextFromEnv()     # 从环境变量/配置构建上下文
        ↓
    execute()           # 执行审查主流程
        ↓
┌───────────────────────────────────────┐
│ 1. 加载审查规范 (ReviewSpec)           │
│ 2. 获取 PR/分支变更信息                │
│ 3. 过滤文件 (files/commits/includes)   │
│ 4. 获取文件内容并构建行号-commit 映射   │
│ 5. 构建审查提示词                      │
│ 6. 并行调用 LLM 审查各文件             │
│ 7. 过滤/格式化审查结果                 │
│ 8. 验证历史问题修复状态                │
│ 9. 提交/更新 PR 评论                   │
│ 10. 可选：删除代码影响分析             │
└───────────────────────────────────────┘
```

#### 2.2 审查结果 Schema

```typescript
interface ReviewResult {
  success: boolean;
  description: string; // PR 功能描述
  issues: ReviewIssue[]; // 发现的问题列表
  summary: FileSummary[]; // 各文件审查总结
  deletionImpact?: DeletionImpactResult; // 删除代码影响
  round: number; // 审查轮次
}

interface ReviewIssue {
  file: string; // 文件路径
  line: string; // 行号 (如 "123" 或 "123-125")
  ruleId: string; // 规则 ID
  specFile: string; // 规则来源文件
  reason: string; // 问题描述
  suggestion?: string; // 修改建议
  severity?: "error" | "warn"; // 严重程度
  commit?: string; // 相关 commit SHA
  code?: string; // 问题代码片段
  date?: string; // 发现时间
  fixed?: string; // 修复时间
  valid?: "true" | "false"; // 问题有效性
  round?: number; // 发现轮次
}
```

#### 2.3 关键方法

| 方法                          | 说明                           |
| ----------------------------- | ------------------------------ |
| `getContextFromEnv()`         | 从环境变量和配置构建审查上下文 |
| `execute()`                   | 执行完整审查流程               |
| `executeDeletionOnly()`       | 仅执行删除代码分析             |
| `buildReviewPrompt()`         | 为每个文件构建审查提示词       |
| `runLLMReview()`              | 调用 LLM 执行审查              |
| `callLLM()`                   | 并行审查多个文件               |
| `reviewSingleFile()`          | 审查单个文件                   |
| `getFileContents()`           | 获取文件内容并构建行号映射     |
| `buildLineCommitMap()`        | 构建行号到 commit 的映射       |
| `filterDuplicateIssues()`     | 过滤重复问题                   |
| `postOrUpdateReviewComment()` | 发布/更新 PR 评论              |
| `generatePrDescription()`     | AI 生成 PR 功能描述            |

### 3. IssueVerifyService

历史问题验证服务，用于检查之前发现的问题是否已被修复。

#### 3.1 验证流程

```text
verifyIssueFixes()
        ↓
┌─────────────────────────────────────┐
│ 1. 跳过已修复/无效的问题             │
│ 2. 检查文件是否已删除               │
│ 3. 并行调用 LLM 验证各问题          │
│ 4. 更新问题的 fixed/valid 状态      │
└─────────────────────────────────────┘
```

#### 3.2 验证结果

```typescript
interface VerifyResult {
  fixed: boolean; // 问题是否已修复
  valid: boolean; // 问题是否有效（非误报）
  reason: string; // 判断依据
}
```

### 4. DeletionImpactService

删除代码影响分析服务，评估删除代码可能带来的风险。

#### 4.1 分析流程

```text
analyzeDeletionImpact()
        ↓
┌─────────────────────────────────────┐
│ 1. 获取删除的代码块                  │
│    - Git Provider API 模式：从 PR diff 获取 │
│    - Git Diff 模式：本地 git 命令    │
│ 2. 查找代码引用关系 (git grep)       │
│ 3. 调用 LLM 分析影响                 │
│    - OpenAI 模式：标准 chat          │
│    - Claude Agent 模式：可用工具     │
└─────────────────────────────────────┘
```

#### 4.2 风险等级

| 等级     | 说明                         |
| -------- | ---------------------------- |
| `high`   | 可能导致编译错误或运行时异常 |
| `medium` | 可能影响部分功能行为         |
| `low`    | 影响较小                     |
| `none`   | 无影响（清理无用代码）       |

#### 4.3 分析结果

```typescript
interface DeletionImpactResult {
  impacts: DeletionImpact[];
  summary: string;
}

interface DeletionImpact {
  file: string; // 被删除代码所在文件
  deletedCode: string; // 删除代码摘要
  riskLevel: "high" | "medium" | "low" | "none";
  affectedFiles: string[]; // 可能受影响的文件
  reason: string; // 影响分析说明
  suggestion?: string; // 建议处理方式
}
```

### 5. parseTitleOptions

从 PR 标题解析命令参数，支持在标题末尾添加 `[/ai-review ...]` 格式的参数。

**示例**：

```text
feat: 添加新功能 [/ai-review -l openai -v 2]
```

**支持的参数**：

- `-l, --llm-mode <mode>`: LLM 模式
- `-v, --verbose [level]`: 详细输出级别
- `-d, --dry-run`: 仅打印不执行
- `-i, --includes <pattern>`: 文件过滤模式
- `--verify-fixes` / `--no-verify-fixes`: 历史问题验证
- `--analyze-deletions`: 分析删除代码
- `--deletion-only`: 仅执行删除分析
- `--deletion-analysis-mode <mode>`: 删除分析模式

## 配置项

在 `spaceflow.json` 中配置：

```javascript
module.exports = {
  review: {
    // LLM 模式：claude-code, openai, gemini
    llmMode: "openai",

    // 文件过滤模式
    includes: ["**/*.ts", "**/*.js"],

    // 是否验证历史问题
    verifyFixes: true,
    verifyFixesConcurrency: 10,

    // 删除代码分析
    analyzeDeletions: false,
    deletionAnalysisMode: "openai",

    // 并发和超时配置
    concurrency: 5,
    timeout: 60000,
    retries: 0,
    retryDelay: 1000,

    // 是否生成 PR 描述
    generateDescription: false,

    // 是否启用行级评论
    lineComments: false,

    // OpenAI 配置
    openai: {
      apiKey: "sk-xxx",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    },

    // Claude Code 配置
    claudeCode: {
      // Claude CLI 配置
    },
  },
};
```

## 使用示例

### CI 环境

```yaml
# .github/workflows/ai-review.yml
name: AI Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Review
        run: npx spaceflow review --ci -l openai
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 本地命令行

```bash
# 审查 PR
npx spaceflow review -p 123 -l openai

# 审查两个分支之间的差异
npx spaceflow review -b main --head feature/xxx -l openai

# 仅审查指定文件
npx spaceflow review -f src/app.ts -l openai

# 详细输出
npx spaceflow review -p 123 -l openai -v 2

# 仅分析删除代码
npx spaceflow review -p 123 --deletion-only -l openai
```

## 审查规范

审查规范文件位于 `.spaceflow/review-spec/` 目录，使用 Markdown 格式定义规则。

详见 [ReviewSpec 模块文档](../../shared/review-spec/README.md)。

## 输出格式

### Markdown 格式（PR 评论）

包含以下部分：

- PR 功能描述
- 问题列表（按严重程度分组）
- 各文件审查总结
- 删除代码影响分析（如启用）
- 隐藏的 JSON 数据（用于增量审查）

### Terminal 格式

彩色终端输出，适合本地调试。

### JSON 格式

结构化 JSON 输出，适合程序处理。

## 增量审查

AI Review 支持增量审查，即在同一个 PR 上多次运行时：

1. **问题去重**：不会重复报告已存在的问题
2. **修复验证**：自动验证历史问题是否已修复
3. **轮次追踪**：记录每个问题的发现轮次
4. **评论更新**：更新而非新增评论

## 注意事项

1. **Token 限制**：单个文件审查的提示词长度受 LLM token 限制
2. **并发控制**：可通过 `concurrency` 配置控制并行审查数量
3. **超时处理**：可通过 `timeout` 配置单文件审查超时时间
4. **重试机制**：可通过 `retries` 和 `retryDelay` 配置重试策略
