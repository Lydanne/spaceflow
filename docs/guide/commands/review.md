# review — 代码审查

`review` 是 Spaceflow 的核心命令，提供基于 LLM 的自动化代码审查能力。支持多轮审查、修复验证、行级评论、删除代码分析等功能，可在终端和 CI 中运行。

## 安装

```bash
spaceflow install @spaceflow/review
```

## 基本用法

```bash
# 审查指定 PR
spaceflow review -p <pr-number>

# 审查两个分支之间的差异
spaceflow review -b <base-branch> --head <head-branch>

# 使用指定 LLM 模式
spaceflow review -p 123 -l openai

# 审查指定文件
spaceflow review -p 123 -f src/index.ts

# 仅刷新状态（不执行 LLM 审查）
spaceflow review -p 123 --flush
```

## 审查流程

一次完整的 Review 分为以下阶段：

### 1. 准备阶段

```text
上下文构建 → 规则加载 → 变更文件获取 → 文件内容获取
```

- **上下文构建**：合并命令行参数、PR 标题参数、配置文件，确定 owner/repo/prNumber/llmMode 等
- **规则加载**：从 `references` 配置的本地目录或远程 Git 仓库加载审查规范（Review Spec），自动去重
- **变更文件获取**：通过 Git Provider API 获取 PR 的变更文件列表和 commits
- **文件内容获取**：获取每个变更文件的最新内容（带行号），作为 LLM 审查的输入

### 2. 文件过滤

变更文件会经过多层过滤，确保只审查相关文件：

1. **files 过滤**：`-f` 指定的文件白名单
2. **commits 过滤**：`--commits` 指定的 commit 范围
3. **includes 过滤**：glob 模式匹配（如 `*/**/*.ts`），同时过滤文件和 commits
4. **规则匹配**：按文件扩展名匹配适用的审查规则

### 3. LLM 审查

```text
构建审查提示词 → 并发调用 LLM → 解析审查结果
```

- 按文件拆分，为每个文件构建独立的 system prompt 和 user prompt
- 注入与该文件匹配的审查规则
- 如果是多轮审查（Round > 1），上一轮的审查结果会注入到提示词中，避免重复发现
- 并发调用 LLM（默认并发数 10），支持超时和自动重试

### 4. 结果处理

LLM 返回的原始结果会经过多步处理：

1. **includes 过滤**：过滤掉不匹配规则 includes 的问题
2. **规则存在性过滤**：过滤掉引用了不存在规则的问题
3. **override 过滤**：应用规则的 severity override（可将某些规则降级为 warn 或关闭）
4. **变更行过滤**：只保留属于本次 PR commits 变更行的问题，排除 merge commit 引入的代码
5. **格式化**：统一问题格式，填充代码片段
6. **去重**：与历史问题对比，跳过已存在的重复问题

### 5. 历史问题处理（多轮审查）

在 CI 模式下，如果 PR 已有上一轮审查结果：

1. **变更文件失效**：如果某文件在本次推送中被修改，该文件的历史问题会被标记为无效（可配置）
2. **修复验证**（`verifyFixes` 开启时）：使用 LLM 逐个验证未修复的历史问题，判断代码变更是否修复了该问题
3. **问题合并**：历史问题 + 新发现问题 = 完整问题列表
4. **作者归属**：根据 commit 信息为每个问题填充作者

### 6. 报告发布

- **PR 评论**：发布或更新 PR 上的审查评论，包含问题概览、文件摘要、统计信息
- **行级评论**（`lineComments` 开启时）：在代码行上添加行内评论
- **终端输出**：在控制台输出审查结果

如果同时启用了删除代码分析，会在审查完成后进行第二次报告更新。

## 多轮审查

Review 支持在同一 PR 上进行多轮审查，每次推送新代码触发新一轮审查。

```text
Round 1: PR 创建 → 发现 5 个问题
Round 2: 开发者修复代码并推送 → 验证 3 个已修复 + 发现 1 个新问题
Round 3: 继续修复 → 验证全部修复
```

**轮次机制**：

- 当前轮次 = 上一轮 + 1，从 PR 评论中的结构化数据自动读取
- 每一轮的新问题会标记 `round` 编号
- 上一轮的历史问题作为上下文注入 LLM 提示词，避免重复发现

**行级评论**每轮都会发布一条 `🚀 Spaceflow Review · Round N` 状态：

- 本轮新发现的问题数和 error/warn 分布
- 上轮问题的回顾统计（已修复、已解决、无效、待处理）
- 即使本轮无新问题，也会发布 Round 状态（显示 `✅ 未发现新问题`）

## 问题生命周期

每个审查问题有以下状态流转：

```text
发现 → 待处理 (pending)
                ├→ AI 验证已修复 (fixed)
                ├→ 用户手动 resolve (resolved)
                ├→ 👎 标记无效 (invalid)
                └→ 文件变更失效 (invalidated)
```

**状态判定方式**：

| 状态         | 判定方式                                              |
| ------------ | ----------------------------------------------------- |
| **fixed**    | LLM 验证代码变更修复了该问题，自动标记 `fixed` 时间戳 |
| **resolved** | 用户在 PR 评论中手动 resolve 该条审查意见             |
| **invalid**  | 用户对行级评论添加 👎 reaction                        |
| **pending**  | 以上均未触发，问题仍待处理                            |

## 修复验证

修复验证使用 LLM 读取最新代码，判断历史问题是否已被修复。在两个场景下触发：

- **常规审查**（`--verify-fixes` 开启时）：每轮审查验证上一轮的未修复问题，使用已获取的文件内容和规则
- **PR 合并/flush**（始终执行）：PR 关闭或 `--flush` 时，自动获取最新文件内容和审查规则，对所有未修复问题做最终验证

验证过程：

1. 筛选未修复且有效的问题
2. 获取问题所在文件的最新内容
3. 查找问题对应的审查规则定义
4. 调用 LLM 判断代码是否修复了该问题
5. 如果已修复，标记 `fixed` 时间戳

## 审查报告

### 统计指标

| 指标      | 说明                                  |
| --------- | ------------------------------------- |
| 总问题数  | 所有轮次累计发现的问题总数            |
| ✅ 已修复 | AI 验证确认已通过代码修复的问题       |
| 🟢 已解决 | 用户手动 resolve 的问题               |
| ❌ 无效   | 通过 👎 reaction 标记为无效的问题     |
| ⚠️ 待处理 | 未修复、未解决、未标记无效的问题      |
| 修复率    | `已修复 / 总问题数 × 100%`            |
| 解决率    | `(已修复 + 已解决) / 总问题数 × 100%` |

### 文件概览

审查概览表按文件汇总问题状态，区分三种标记：

- 🟢 已修复
- 🔴 error 级别未修复
- 🟡 warn 级别未修复

### 数据持久化

审查结果以 Base64 编码的 JSON 嵌入 PR 评论中，包含完整的 `ReviewResult`（问题列表、统计、摘要等）。每次新一轮审查会解析上一次的评论数据，实现跨轮次的状态持续跟踪。

## 功能特性

### PR 描述生成

启用 `generateDescription` 后，自动根据代码变更和文件内容生成 PR 功能描述：

```bash
spaceflow review -p 123 --generate-description
```

### 删除代码分析

分析删除代码的潜在影响，检测是否有未处理的引用或依赖：

```bash
spaceflow review -p 123 --analyze-deletions
```

### PR 标题参数

在 CI 模式下，可以通过 PR 标题传递参数，格式为 `[/review <args>]`：

```text
feat: 新增用户模块 [/review -l openai -v 2 --verify-fixes]
```

支持的参数与命令行选项一致。命令行参数优先级 > PR 标题参数 > 配置文件。

### 状态刷新模式

`--flush` 模式不执行 LLM 审查，仅执行状态同步和最终验证：

1. 从现有 PR 评论中读取历史问题
2. 同步评论 resolve 状态
3. 同步 reactions（👍/👎）
4. LLM 验证未修复问题（始终执行）
5. 重新计算统计并更新 PR 评论

PR 关闭事件（`closed`）也会自动触发此模式。

## 支持的 LLM

| 模式          | 说明                                   | 环境变量                                            |
| ------------- | -------------------------------------- | --------------------------------------------------- |
| `openai`      | OpenAI 兼容 API（GPT-4o、DeepSeek 等） | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| `claude`      | Anthropic Claude API                   | `ANTHROPIC_API_KEY`                                 |
| `claude-code` | Claude Code Agent                      | `CLAUDE_CODE_BASE_URL`, `CLAUDE_CODE_AUTH_TOKEN`    |
| `open-code`   | OpenCode SDK                           | `OPENCODE_API_KEY`                                  |
| `gemini`      | Google Gemini API                      | `GEMINI_API_KEY`                                    |

## 审查规范

Review 命令会加载 `references` 配置中指定的审查规范文件，用于指导 AI 审查：

```json
{
  "review": {
    "references": ["./references", "https://github.com/your-org/review-spec"]
  }
}
```

支持本地目录和远程 Git 仓库 URL。规则文件按 `specFile` 名称去重，后加载的覆盖先加载的。

详见 [Review Spec 规范](/reference/review-spec)。

## 配置

```json
{
  "review": {
    "references": ["./references"],
    "includes": ["*/**/*.ts", "!*/**/*.spec.*"],
    "llmMode": "openai",
    "generateDescription": true,
    "lineComments": true,
    "verifyFixes": true,
    "verifyFixesConcurrency": 10,
    "invalidateChangedFiles": "invalidate",
    "analyzeDeletions": false,
    "concurrency": 10,
    "retries": 3
  }
}
```

| 配置项                   | 类型     | 默认值         | 说明                                            |
| ------------------------ | -------- | -------------- | ----------------------------------------------- |
| `references`             | string[] | `[]`           | 审查规则来源（本地目录或 Git URL）              |
| `includes`               | string[] | —              | 文件过滤 glob 模式                              |
| `llmMode`                | string   | —              | 默认 LLM 模式                                   |
| `generateDescription`    | boolean  | `false`        | 是否生成 PR 描述                                |
| `lineComments`           | boolean  | `false`        | 是否生成行级评论                                |
| `verifyFixes`            | boolean  | `true`         | 是否验证历史问题修复状态                        |
| `verifyFixesConcurrency` | number   | `10`           | 修复验证并发数                                  |
| `invalidateChangedFiles` | string   | `"invalidate"` | 变更文件处理策略：`invalidate` / `keep` / `off` |
| `analyzeDeletions`       | boolean  | `false`        | 是否分析删除代码影响                            |
| `concurrency`            | number   | `10`           | LLM 审查并发数                                  |
| `retries`                | number   | `0`            | LLM 调用失败重试次数                            |

## 命令行选项

| 选项                       | 简写 | 说明                                                         |
| -------------------------- | ---- | ------------------------------------------------------------ |
| `--pr <number>`            | `-p` | PR 编号                                                      |
| `--base <branch>`          | `-b` | 基准分支                                                     |
| `--head <branch>`          |      | 目标分支                                                     |
| `--llm-mode <mode>`        | `-l` | LLM 模式                                                     |
| `--files <path>`           | `-f` | 指定审查文件                                                 |
| `--commits <sha>`          |      | 指定 commit 范围                                             |
| `--includes <pattern>`     | `-i` | 文件过滤 glob 模式                                           |
| `--generate-description`   |      | 生成 PR 描述                                                 |
| `--line-comments`          |      | 生成行级评论                                                 |
| `--analyze-deletions`      |      | 分析删除代码                                                 |
| `--verify-fixes`           |      | 验证修复建议                                                 |
| `--no-verify-fixes`        |      | 禁用修复验证                                                 |
| `--verify-concurrency <n>` |      | 修复验证并发数（默认 10）                                    |
| `--flush`                  |      | 仅刷新状态（同步 reactions、resolved 等并执行 LLM 最终验证） |
| `--show-all`               |      | 显示所有问题，不过滤非变更行                                 |
| `--dry-run`                | `-d` | 试运行，不实际提交评论                                       |
| `--concurrency <n>`        |      | LLM 审查并发数                                               |
| `--verbose`                | `-v` | 详细日志（`-v` 级别 1，`-vv` 级别 2）                        |

## CI 集成

### GitHub Actions

```yaml
name: PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: pr-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx @spaceflow/cli review -p ${{ github.event.pull_request.number }} -l openai -c
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**关键配置**：

- **`concurrency`**：同一 PR 的多次推送会取消前一次审查，避免并发冲突
- **`event-action`**：传入 `${{ github.event.action }}`，当 PR 关闭时自动进入状态刷新模式
- **权限**：需要 `pull-requests: write` 和 `issues: write` 权限用于发布评论
