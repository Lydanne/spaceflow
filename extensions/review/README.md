# @spaceflow/review

Spaceflow AI 代码审查插件，使用 LLM 对 PR 代码进行自动审查。支持 OpenAI、Claude Code、Gemini 等多种 LLM 模式。

## 安装

```bash
pnpm spaceflow install @spaceflow/review
```

## 功能特性

- **多 LLM 支持** — OpenAI、Claude Code、Gemini 可选
- **行级评论** — 在 PR 中精确定位问题代码行
- **增量审查** — 多次运行时自动去重，追踪问题修复状态
- **删除代码分析** — 评估删除代码可能带来的风险
- **AI 生成 PR 描述** — 自动总结 PR 功能变更
- **审查规范** — 支持自定义 Markdown 格式的审查规则
- **远程规范引用** — 支持从远程仓库 URL 拉取审查规范

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
```

## 命令行参数

| 参数 | 简写 | 说明 |
| --- | --- | --- |
| `--pr-number <number>` | `-p` | PR 编号 |
| `--base <ref>` | `-b` | 基准分支/tag |
| `--head <ref>` | | 目标分支/tag |
| `--llm-mode <mode>` | `-l` | LLM 模式（`openai` / `claude-code` / `gemini`） |
| `--files <files...>` | `-f` | 仅审查指定文件 |
| `--commits <commits...>` | | 仅审查指定 commits |
| `--includes <patterns...>` | `-i` | 文件 glob 过滤模式 |
| `--verbose [level]` | `-v` | 详细输出（1: 过程日志，2: 含提示词） |
| `--dry-run` | `-d` | 仅打印将要执行的操作 |
| `--ci` | `-c` | 在 CI 环境中运行 |
| `--verify-fixes` | | 验证历史问题是否已修复 |
| `--no-verify-fixes` | | 禁用历史问题验证 |
| `--analyze-deletions` | | 分析删除代码影响 |
| `--deletion-only` | | 仅执行删除代码分析 |
| `--deletion-analysis-mode <mode>` | | 删除分析模式（`openai` / `claude-code`） |
| `--generate-description` | | 使用 AI 生成 PR 功能描述 |
| `--output-format <format>` | `-o` | 输出格式（`markdown` / `terminal` / `json`） |

## 配置

在 `spaceflow.json` 中配置 `review` 字段：

```json
{
  "review": {
    "includes": ["*/**/*.ts", "!*/**/*.spec.*", "!*/**/*.config.*"],
    "references": ["./references"],
    "generateDescription": true,
    "lineComments": true,
    "verifyFixes": true,
    "analyzeDeletions": false,
    "concurrency": 5,
    "retries": 3,
    "retryDelay": 1000
  }
}
```

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

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `GITHUB_TOKEN` | GitHub API Token |
| `GITHUB_REPOSITORY` | 仓库名称（`owner/repo` 格式） |
| `OPENAI_BASE_URL` | OpenAI API 地址 |
| `OPENAI_API_KEY` | OpenAI API Key |
| `OPENAI_MODEL` | OpenAI 模型名称 |

## 许可证

[MIT](../../LICENSE)
