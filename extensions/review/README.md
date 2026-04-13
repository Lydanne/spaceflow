# @spaceflow/review

[![npm version](https://img.shields.io/npm/v/@spaceflow/review?color=blue)](https://www.npmjs.com/package/@spaceflow/review)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow AI 代码审查扩展，使用 LLM 对 PR 代码进行自动审查。支持 OpenAI、Claude Code、Gemini、Open Code 等多种 LLM 模式。

## 安装

```bash
pnpm spaceflow install @spaceflow/review
```

## 功能特性

- **多 LLM 支持** — OpenAI、Claude Code、Gemini、Open Code 可选
- **行级评论** — 在 PR 中精确定位问题代码行
- **增量审查** — 多次运行时自动去重，追踪问题修复状态
- **删除代码分析** — 评估删除代码可能带来的风险
- **AI 生成 PR 描述** — 自动总结 PR 功能变更
- **审查规范** — 支持自定义 Markdown 格式的审查规则
- **远程规范引用** — 支持从远程仓库 URL 拉取审查规范
- **系统规则** — 不依赖 LLM 的静态检查（如单文件行数上限）
- **本地审查** — 审查未提交或暂存区的代码，无需 PR
- **MCP 工具** — 提供 `list_rules`、`get_rules_for_file` 等工具供 AI 编辑器使用
- **问题阻断** — 存在未解决问题时以非零退出码退出，适用于 CI 门禁

## 使用

```bash
# 审查 PR
spaceflow review -p 123 -l openai

# 审查两个分支之间的差异
spaceflow review -b main --head feature/xxx -l openai

# 仅审查指定文件
spaceflow review -f src/app.ts -l openai

# 详细输出（含提示词）
spaceflow review -p 123 -l openai -vv

# 仅分析删除代码
spaceflow review -p 123 --deletion-only -l openai

# 本地审查（未提交的代码）
spaceflow review --local -l openai

# 仅审查暂存区代码
spaceflow review --local staged -l openai

# 仅刷新状态（同步 reactions、resolved 等）
spaceflow review --flush

# 存在 error 级别未解决问题时非零退出
spaceflow review -p 123 --fail-on-issues -l openai
```

## 命令行参数

| 参数                              | 简写 | 说明                                                         |
| --------------------------------- | ---- | ------------------------------------------------------------ |
| `--pr-number <number>`            | `-p` | PR 编号                                                      |
| `--base <ref>`                    | `-b` | 基准分支/tag                                                 |
| `--head <ref>`                    |      | 目标分支/tag                                                 |
| `--llm-mode <mode>`               | `-l` | LLM 模式（`openai` / `claude-code` / `gemini` / `open-code`） |
| `--files <files...>`              | `-f` | 仅审查指定文件                                               |
| `--commits <commits...>`          |      | 仅审查指定 commits                                           |
| `--includes <patterns...>`        | `-i` | 文件 glob 过滤模式                                           |
| `--verbose [level]`               | `-v` | 详细输出（1: 过程日志，2: 含提示词）                         |
| `--dry-run`                       | `-d` | 仅打印将要执行的操作                                         |
| `--ci`                            | `-c` | 在 CI 环境中运行                                             |
| `--verify-fixes`                  |      | 验证历史问题是否已修复                                       |
| `--no-verify-fixes`               |      | 禁用历史问题验证                                             |
| `--analyze-deletions`             |      | 分析删除代码影响                                             |
| `--deletion-only`                 |      | 仅执行删除代码分析                                           |
| `--deletion-analysis-mode <mode>` |      | 删除分析 LLM 模式（`openai` / `claude-code`）               |
| `--generate-description`          |      | 使用 AI 生成 PR 功能描述                                     |
| `--output-format <format>`        | `-o` | 输出格式（`markdown` / `terminal` / `json`）                 |
| `--local [mode]`                  |      | 本地审查模式（`uncommitted` / `staged`，默认 `uncommitted`） |
| `--no-local`                      |      | 禁用本地模式                                                 |
| `--show-all`                      |      | 显示所有问题，不过滤非变更行的问题                           |
| `--flush`                         |      | 仅刷新状态（同步 reactions、resolved 等），不执行 LLM 审查   |
| `--event-action <action>`         |      | PR 事件类型（`opened` / `synchronize` / `closed` 等）        |
| `--fail-on-issues [mode]`         |      | 未解决问题时非零退出（`off` / `warn` / `error` / `warn+error`，默认 `error`） |

## 配置

在 `spaceflow.json` 中配置 `review` 字段：

```json
{
  "review": {
    "includes": ["*/**/*.ts", "!*/**/*.spec.*", "!*/**/*.config.*"],
    "references": ["./references"],
    "llmMode": "openai",
    "generateDescription": true,
    "autoUpdatePrTitle": false,
    "lineComments": true,
    "verifyFixes": true,
    "verifyFixesConcurrency": 10,
    "analyzeDeletions": false,
    "deletionAnalysisMode": "openai",
    "whenModifiedCode": ["function", "class"],
    "rules": {
      "no-console": "warn",
      "no-any": "error"
    },
    "concurrency": 5,
    "retries": 3,
    "retryDelay": 1000,
    "invalidateChangedFiles": "invalidate",
    "duplicateWorkflowResolved": "delete",
    "autoApprove": false,
    "failOnIssues": "off",
    "systemRules": {
      "maxLinesPerFile": [500, "warn"]
    }
  }
}
```

### 配置项说明

| 字段                         | 类型                                     | 默认值         | 说明                                                                   |
| ---------------------------- | ---------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| `includes`                   | `string[]`                               | —              | 文件 glob 过滤模式                                                     |
| `references`                 | `string[]`                               | —              | 审查规范来源（本地路径或远程仓库 URL）                                 |
| `llmMode`                    | `string`                                 | `"openai"`     | 默认 LLM 模式                                                          |
| `generateDescription`        | `boolean`                                | `false`        | AI 生成 PR 功能描述                                                     |
| `autoUpdatePrTitle`          | `boolean`                                | `false`        | 自动更新 PR 标题                                                        |
| `lineComments`               | `boolean`                                | `false`        | 在 PR 中发布行级评论                                                    |
| `verifyFixes`                | `boolean`                                | `false`        | 验证历史问题是否已修复                                                  |
| `verifyFixesConcurrency`     | `number`                                 | `10`           | 验证并发数                                                              |
| `analyzeDeletions`           | `boolean \| "ci" \| "pr" \| "terminal"`  | `false`        | 删除代码分析（`true`: 始终启用，`"ci"`: 仅 CI，`"pr"`: 仅 PR，`"terminal"`: 仅终端） |
| `deletionAnalysisMode`       | `string`                                 | `"openai"`     | 删除分析 LLM 模式                                                       |
| `whenModifiedCode`           | `string[]`                               | —              | 代码结构过滤（`"function"` / `"class"` / `"interface"` / `"type"` / `"method"`） |
| `rules`                      | `Record<string, "off" \| "warn" \| "error">` | —        | 逐规则严重级别覆盖                                                      |
| `concurrency`                | `number`                                 | `5`            | LLM 并发审查数                                                          |
| `retries`                    | `number`                                 | `0`            | 失败重试次数                                                            |
| `retryDelay`                 | `number`                                 | `1000`         | 重试间隔（ms）                                                          |
| `invalidateChangedFiles`     | `"invalidate" \| "keep" \| "off"`        | `"invalidate"` | 变更文件历史问题处理策略                                                |
| `duplicateWorkflowResolved`  | `"off" \| "skip" \| "delete"`            | `"delete"`     | 重复 workflow 处理策略                                                  |
| `autoApprove`                | `boolean`                                | `false`        | 所有问题解决后自动提交 APPROVE review                                    |
| `failOnIssues`               | `"off" \| "warn" \| "error" \| "warn+error"` | `"off"`  | 问题阻断模式                                                            |
| `systemRules`                 | `object`                                 | —              | 系统规则（不依赖 LLM 的静态检查）                                       |
| `systemRules.maxLinesPerFile`| `[number, "off" \| "warn" \| "error"]`  | —              | 单文件最大审查行数，超过时跳过 LLM 并生成系统问题                       |

## MCP 工具

本扩展提供以下 MCP 工具，可在 AI 编辑器（如 Cursor、Windsurf）中使用：

| 工具名                 | 说明                                       | 参数                                            |
| ---------------------- | ------------------------------------------ | ----------------------------------------------- |
| `list_rules`           | 列出所有审查规则                           | —                                               |
| `get_rules_for_file`   | 获取指定文件适用的审查规则                 | `filePath`, `includeExamples?`                  |
| `get_rule_detail`      | 获取单条规则的详细信息                     | `ruleId`                                        |
| `get_rules_from_dir`   | 从指定目录加载审查规则                     | `dirPath`, `includeExamples?`                   |

规则搜索目录包括：`review.references` 配置路径、`.claude/skills`、`.cursor/skills`、`review-specs`。

## PR 标题参数

支持在 PR 标题末尾添加参数覆盖默认配置：

```text
feat: 添加新功能 [/ai-review -l openai -v 2]
```

## CI 工作流示例

```yaml
name: AI Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm spaceflow review --ci -l openai
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### CI 门禁示例

存在 `error` 级别未解决问题时阻止合并：

```yaml
      - run: pnpm spaceflow review --ci -l openai --fail-on-issues
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## 环境变量

### Git Provider

| 变量                | 说明                          |
| ------------------- | ----------------------------- |
| `GITHUB_TOKEN`      | GitHub API Token              |
| `GITHUB_REPOSITORY` | 仓库名称（`owner/repo` 格式） |
| `GITEA_TOKEN`       | Gitea API Token               |
| `GITEA_REPOSITORY`  | Gitea 仓库名称                 |
| `GITLAB_TOKEN`      | GitLab API Token              |
| `GITLAB_REPOSITORY` | GitLab 仓库名称                |

### OpenAI

| 变量              | 说明            |
| ----------------- | --------------- |
| `OPENAI_BASE_URL` | OpenAI API 地址 |
| `OPENAI_API_KEY`  | OpenAI API Key  |
| `OPENAI_MODEL`    | OpenAI 模型名称 |

### Claude Code

| 变量                | 说明             |
| ------------------- | ---------------- |
| `ANTHROPIC_API_KEY` | Anthropic API Key |

### Gemini

| 变量               | 说明           |
| ------------------ | -------------- |
| `GEMINI_API_KEY`   | Gemini API Key |

## 许可证

[MIT](../../LICENSE)
