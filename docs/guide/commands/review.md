# review — 代码审查

`review` 是 Spaceflow 的核心命令，提供基于 LLM 的自动化代码审查能力。

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
```

## 功能特性

### AI 代码审查

- 自动分析 PR 中的代码变更
- 基于审查规范（Review Spec）生成结构化审查意见
- 支持行内评论，直接在 PR 的代码行上添加审查意见

### PR 描述生成

启用 `generateDescription` 后，自动根据代码变更生成 PR 描述：

```bash
spaceflow review -p 123 --generate-description
```

### 删除代码分析

分析删除代码的潜在影响：

```bash
spaceflow review -p 123 --analyze-deletions
```

### 修复验证

验证 AI 提出的修复建议是否正确：

```bash
spaceflow review -p 123 --verify-fixes
```

## 支持的 LLM

| 模式 | 说明 | 环境变量 |
|------|------|----------|
| `openai` | OpenAI API（GPT-4o 等） | `OPENAI_API_KEY`, `OPENAI_BASE_URL` |
| `claude` | Anthropic Claude API | `ANTHROPIC_API_KEY` |
| `claude-code` | Claude Code Agent | `CLAUDE_CODE_BASE_URL`, `CLAUDE_CODE_AUTH_TOKEN` |
| `open-code` | OpenCode SDK | `OPENCODE_API_KEY` |

## 审查规范

Review 命令会加载 `references` 配置中指定的审查规范文件，用于指导 AI 审查。

```json
{
  "review": {
    "references": [
      "./references",
      "https://github.com/your-org/review-spec"
    ]
  }
}
```

支持本地目录和远程 Git 仓库 URL。详见 [Review Spec 规范](/reference/review-spec)。

## 配置

```json
{
  "review": {
    "references": ["./references"],
    "includes": ["*/**/*.ts", "!*/**/*.spec.*"],
    "generateDescription": true,
    "lineComments": true,
    "verifyFixes": true,
    "analyzeDeletions": false,
    "concurrency": 10,
    "retries": 3
  }
}
```

## 命令行选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--pr <number>` | `-p` | PR 编号 |
| `--base <branch>` | `-b` | 基准分支 |
| `--head <branch>` | | 目标分支 |
| `--llm-mode <mode>` | `-l` | LLM 模式 |
| `--generate-description` | | 生成 PR 描述 |
| `--line-comments` | | 生成行内评论 |
| `--analyze-deletions` | | 分析删除代码 |
| `--verify-fixes` | | 验证修复建议 |
| `--dry-run` | | 试运行，不实际提交评论 |
| `--concurrency <n>` | | 并发数 |
| `--verbose` | `-v` | 详细日志 |
