# @spaceflow/review

[![npm version](https://img.shields.io/npm/v/@spaceflow/review?color=blue)](https://www.npmjs.com/package/@spaceflow/review)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow AI 代码审查扩展，使用 LLM 对 PR 代码进行自动审查。支持 OpenAI、Gemini、Open Code 等多种 LLM 模式。

## 安装

```bash
pnpm spaceflow install @spaceflow/review
```

## 功能特性

- **多 LLM 支持** — OpenAI、Gemini、Open Code 可选
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
| `--llm-mode <mode>`               | `-l` | LLM 模式（`openai` / `gemini` / `open-code`） |
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
| `--deletion-analysis-mode <mode>` |      | 删除分析 LLM 模式（`openai` / `open-code`）                 |
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

规则搜索目录包括：`review.references` 配置路径、`.cursor/skills`、`review-specs`。

## 审查规范格式

审查规范使用 Markdown 文件定义，文件名格式为 `<extensions>.<type>.md`，放置在 `references/` 目录或远程仓库中。

### 文件名约定

```
<extensions>.<type>.md
```

- **extensions** — 适用的文件扩展名，多个用 `&` 连接（如 `js&ts`、`vue`）
- **type** — 规范类别（如 `base`、`file-name`、`nest`）

示例：`js&ts.base.md` → 适用于 `.js` 和 `.ts` 文件的基础规范

### 规则定义格式

每条规则使用 `##` 或 `###` 标题，后跟规则 ID（用反引号方括号包裹）：

```markdown
## 规则标题 `[RuleId]`

规则描述文本...

> - severity `warn`
> - override `[OverriddenRuleId]`
> - includes `*.service.ts` `*.controller.ts`

### Example: 示例标题

#### Good: 正确示例

```typescript
const MAX_COUNT = 100;
```

#### Bad: 错误示例

```typescript
const maxCount = 100;
```
```

### 规则配置项

在规则描述中使用引用块（`>`）声明配置：

| 配置项       | 格式                          | 说明                                                         |
| ------------ | ----------------------------- | ------------------------------------------------------------ |
| `severity`   | `> - severity \`warn\``       | 严重级别（`off` / `warn` / `error`），默认 `error`          |
| `override`   | `> - override \`[RuleId]\``   | 覆盖指定规则（前缀匹配），被覆盖的规则问题会被过滤         |
| `includes`   | `> - includes \`*.ts\` \`*.js\`` | 文件匹配模式，仅对匹配的文件生效，支持 `status|glob` 前缀 |

### Override 机制

Override 允许高优先级规则覆盖低优先级规则，避免重复报告：

- 使用前缀匹配：`override [JsTs.FileName]` 会覆盖 `JsTs.FileName` 及其子规则（如 `JsTs.FileName.UpperCamel`）
- 作用域感知：只有当 issue 文件匹配 override 所在 spec 的 `includes` 时才生效
- 文件级 override 写在规范文件头部（第一个 `##` 规则之前），对所有规则生效

### 远程规范引用

`references` 支持以下格式：

```json
{
  "review": {
    "references": [
      "./references",                                    // 本地目录
      "https://github.com/org/repo/tree/main/specs",     // GitHub 仓库目录
      "https://gitea.example.com/org/repo/src/branch/main/specs"  // Gitea 仓库目录
    ]
  }
}
```

拉取优先级：Git Provider API → tea CLI → git clone 回退 → 本地缓存

## 审查流程

```
1. 解析上下文（PR/分支/本地模式） → ReviewContext
2. 加载审查规范（本地 + 远程） → ReviewSpec[]
3. 获取变更文件和代码内容
4. 系统规则检查（静态，不依赖 LLM）
5. LLM 并行审查（按文件分发，注入匹配的规范）
6. 问题过滤（去重、includes、override、非变更行）
7. 历史问题验证（可选，verifyFixes）
8. 删除代码分析（可选，analyzeDeletions）
9. AI 生成 PR 描述（可选，generateDescription）
10. 输出结果（PR 评论 / 终端 / JSON）
```

### 参数优先级

命令行 > PR 标题参数 > 配置文件 > 默认值

## 问题生命周期

每个审查问题（Issue）有以下状态流转：

```
发现 → 待处理 → 已修复 / 已解决 / 无效
```

| 状态       | 标记        | 说明                                   |
| ---------- | ----------- | -------------------------------------- |
| 待处理     | 🔴/🟡       | 新发现的问题，尚未处理                 |
| 已修复     | 🟢          | AI 验证代码已修改，问题不再存在         |
| 已解决     | ⚪          | 用户手动点击 resolve                    |
| 无效       | ❌          | AI 验证或用户标记为误报                 |

严重级别对应的 Emoji：

| 级别   | Emoji | 说明         |
| ------ | ----- | ------------ |
| error  | 🔴    | 必须修复     |
| warn   | 🟡    | 建议修复     |
| off    | ⚪    | 规则已关闭   |

### 增量审查

多次运行 review 时自动追踪问题状态：

- **轮次（round）** — 每次审查递增，记录问题在哪一轮发现
- **去重** — 相同文件+行号+规则的问题不会重复报告
- **行号追踪** — 代码变更导致行号移动时自动更新 `originalLine`
- **变更文件处理** — `invalidateChangedFiles` 控制变更文件的历史问题是否标记为无效

## Includes 模式语法

`includes` 配置支持 glob 模式和变更类型前缀：

### 基本语法

```json
{
  "includes": ["**/*.ts", "!**/*.spec.ts", "!**/*.config.ts"]
}
```

- `!` 前缀表示排除模式
- 使用 [micromatch](https://github.com/micromatch/micromatch) 匹配

### 变更类型前缀

`<status>|<glob>` 语法，仅匹配指定变更类型的文件：

| 前缀        | 说明   | 示例                      |
| ----------- | ------ | ------------------------- |
| `added\|`    | 新增文件 | `added\|**/*.ts`           |
| `modified\|` | 修改文件 | `modified\|**/*.ts`        |
| `deleted\|`  | 删除文件 | `deleted\|**/*.ts`         |

无前缀则不限变更类型。

> 注意：文件的 status 是相对 base 分支的全量 diff 结果。例如在当前分支首次引入的文件，无论后续多少次 commit 修改，其 status 始终为 `added`。

### whenModifiedCode 过滤

`whenModifiedCode` 配置可进一步缩小审查范围，只关注特定代码结构：

```json
{
  "whenModifiedCode": ["function", "class"]
}
```

支持的类型：`function`、`class`、`interface`、`type`、`method`

配置后，LLM 只会收到匹配代码块范围内的代码，其余代码被裁剪。

## 输出格式

### markdown（默认 PR 模式）

发布为 PR Review Comment，包含：

- 按文件分组的问题列表（含严重级别 Emoji）
- 每个问题的规则 ID、发现时间、开发人员
- 修复建议代码片段
- 文件摘要和统计信息
- 隐藏的 JSON 数据区（用于增量审查状态追踪）

### terminal

终端彩色输出，适合本地审查：

- 🟢 已修复 / 🔴 待处理 error / 🟡 待处理 warn / ⚪ 已解决
- 按文件分组的摘要和问题详情

### json

原始 `ReviewResult` JSON 结构化输出，适合程序化处理：

```json
{
  "success": true,
  "title": "AI 生成的 PR 标题",
  "description": "PR 功能总结",
  "issues": [...],
  "summary": [...],
  "deletionImpact": {...},
  "round": 2,
  "headSha": "abc1234",
  "stats": {
    "total": 10,
    "validTotal": 8,
    "fixed": 3,
    "resolved": 2,
    "invalid": 2,
    "pending": 3,
    "fixRate": 37.5,
    "resolveRate": 25
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

### Gemini

| 变量               | 说明           |
| ------------------ | -------------- |
| `GEMINI_API_KEY`   | Gemini API Key |

## 许可证

[MIT](../../LICENSE)
